const calendar = require('./calendar');
const sheets = require('./sheets');
const channels = require('./channels');
const store = require('./store');

const TIPO_LABELS = {
  consultorio: 'consultorio',
  espacio_comercial: 'espacio comercial',
  mobiliario: 'mobiliario',
};

const toolDefinitions = [
  {
    name: 'submit_qualified_lead',
    description:
      'Envía los datos del lead ya calificado (tipo de proyecto, m², ciudad y franjas de ' +
      'disponibilidad) para que el sistema intente agendar la llamada con María José. Llamar ' +
      'solo cuando los 3 datos del proyecto y al menos 1 franja de disponibilidad concreta ya ' +
      'fueron dados por el lead.',
    input_schema: {
      type: 'object',
      properties: {
        tipo_proyecto: {
          type: 'string',
          description:
            'Tipo de proyecto del lead, tal cual lo respondió. Usa "consultorio" o ' +
            '"espacio_comercial" cuando aplique; si el lead dice algo distinto (mobiliario/muebles, ' +
            'apartamento, vivienda, etc.), usa una versión corta de su respuesta tal cual.',
        },
        m2: {
          type: 'string',
          description:
            'Metros cuadrados aproximados del espacio (como texto, ej. "45"). Si el lead no lo ' +
            'sabe, quiere asesoría, o aún está buscando el local/espacio, usa una nota breve en ' +
            'vez de un número (ej. "no sabe, quiere asesoría" o "buscando local aún").',
        },
        ciudad: { type: 'string', description: 'Ciudad donde está ubicado el proyecto.' },
        franjas_disponibilidad: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD, calculada a partir de "hoy".' },
              hora_inicio: { type: 'string', description: 'Hora de inicio en formato HH:MM (24h), hora de Bogotá.' },
              hora_fin: { type: 'string', description: 'Hora de fin en formato HH:MM (24h), opcional.' },
            },
            required: ['fecha', 'hora_inicio'],
          },
          description: 'Entre 1 y 3 franjas concretas propuestas por el lead, en orden de preferencia.',
        },
      },
      required: ['tipo_proyecto', 'm2', 'ciudad', 'franjas_disponibilidad'],
    },
  },
  {
    name: 'submit_contact_phone',
    description:
      'Guarda el número de teléfono de contacto que dio el lead después de agendar la llamada, ' +
      'cuando no teníamos su dato de contacto real guardado de antes. Llamar solo después de ' +
      'que submit_qualified_lead ya haya agendado la llamada.',
    input_schema: {
      type: 'object',
      properties: {
        telefono: { type: 'string', description: 'Número de teléfono de contacto, tal cual lo dio el lead.' },
      },
      required: ['telefono'],
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Escala la conversación a un humano cuando hay tono de urgencia o molestia, o el lead ' +
      'ya tiene el proyecto avanzado y quiere cerrar directamente. Detiene la calificación automática.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Motivo breve de la escalación.' },
      },
      required: ['motivo'],
    },
  },
];

function formatHorario(start) {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: calendar.TIMEZONE,
  }).format(start);
}

function formatM2(m2) {
  const value = String(m2).trim();
  return /^\d+([.,]\d+)?$/.test(value) ? `${value} m²` : value;
}

function etiquetaCanal(state) {
  return state.channel === 'instagram' ? 'Instagram' : 'WhatsApp';
}

// Descripción del evento de Calendar: tipo/m²/ciudad en la primera línea y debajo cómo contactar
// al lead. El teléfono real se le pide DESPUÉS de agendar, así que al crear el evento casi
// siempre está pendiente — queda marcado así y se completa solo cuando el lead lo da (ver
// handleSubmitContactPhone), para que María José no tenga que buscarlo en la conversación.
function descripcionEvento({ tipoLabel, m2, ciudad, contacto, telefono, canal }) {
  const lineas = [`${tipoLabel}, ${formatM2(m2)}, ${ciudad}.`];
  if (telefono) {
    lineas.push(`Teléfono: ${telefono} (${canal})`);
  } else {
    lineas.push(`Contacto: ${contacto}`, 'Teléfono: pendiente — se le pidió al lead, se agrega aquí cuando lo dé.');
  }
  return lineas.join('\n');
}

function formatFecha(date) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: calendar.TIMEZONE,
  }).format(date);
}

// Crea el evento + fila de Sheets y marca la conversación como agendada. Usado tanto al
// agendar directo (franja libre) como al confirmar una franja que chocaba (ver más abajo).
async function finalizeBooking({ phone, start, end, tipoLabel, m2, ciudad, nombre, contacto }) {
  // El teléfono ya puede estar guardado si el lead lo dio mientras esperábamos que María José
  // confirmara una franja que chocaba (flujo pending_confirmation).
  const previo = store.getConversation(phone);
  const createdEvent = await calendar.createEvent({
    start,
    end,
    summary: `Llamada con ${nombre} — ${tipoLabel}`,
    description: descripcionEvento({
      tipoLabel,
      m2,
      ciudad,
      contacto,
      telefono: previo.collected?.telefono_contacto,
      canal: etiquetaCanal(previo),
    }),
  });

  const horario = formatHorario(start);

  await sheets.appendLeadRow({
    fecha: formatFecha(new Date()),
    nombre,
    tipoProyecto: tipoLabel,
    m2,
    ciudad,
    horario,
    estado: 'Agendado',
  });

  const state = store.getConversation(phone);
  state.status = 'scheduled';
  state.scheduledEvent = { start: start.toISOString(), end: end.toISOString(), horario, eventId: createdEvent.id || null };
  delete state.pendingConfirmation;
  store.saveConversation(phone, state);

  return horario;
}

async function handleSubmitQualifiedLead(input, context) {
  const { phone, leadName } = context;
  const tipoLabel = TIPO_LABELS[input.tipo_proyecto] || input.tipo_proyecto;

  const existing = store.getConversation(phone);
  const contacto = channels.contactLabel(existing);
  const nombre = leadName || `Lead sin nombre (${contacto})`;

  if (existing.status === 'scheduled' && existing.scheduledEvent) {
    // Ya se agendó antes en esta conversación — evita duplicar el evento/fila si el modelo
    // vuelve a invocar la tool (ej. tras un mensaje de seguimiento del lead).
    return { agendado: true, horario: existing.scheduledEvent.horario, ya_agendado: true };
  }

  const state = store.getConversation(phone);
  state.collected = { ...state.collected, ...input, nombre };
  store.saveConversation(phone, state);

  const enHorarioLaboral = (input.franjas_disponibilidad || []).filter(calendar.isWithinBusinessHours);
  if (enHorarioLaboral.length === 0) {
    store.saveConversation(phone, state);
    return { agendado: false, razon: 'fuera_de_horario_laboral' };
  }

  const conAnticipacion = enHorarioLaboral.filter((slot) => calendar.hasMinimumNotice(slot));
  if (conAnticipacion.length === 0) {
    store.saveConversation(phone, state);
    return { agendado: false, razon: 'muy_poco_tiempo_de_anticipacion' };
  }

  const slot = await calendar.findMatchingSlot(conAnticipacion);

  if (!slot) {
    // Ninguna de las franjas propuestas está libre en el calendario de María José — en vez de
    // rechazar, le preguntamos directamente si puede atender la primera de todas formas.
    const proposed = calendar.slotToRange(conAnticipacion[0]);
    const horarioPropuesto = formatHorario(proposed.start);

    state.status = 'pending_confirmation';
    state.pendingConfirmation = {
      start: proposed.start.toISOString(),
      end: proposed.end.toISOString(),
      horario: horarioPropuesto,
      tipoLabel,
      m2: input.m2,
      ciudad: input.ciudad,
      nombre,
      contacto,
    };
    store.saveConversation(phone, state);

    if (process.env.MARIA_JOSE_WHATSAPP_NUMBER) {
      await channels.notifyMariaJose(
        `¿Podrías atender una llamada con ${nombre} el ${horarioPropuesto} aunque tengas algo más agendado a esa hora? Es sobre ${tipoLabel} en ${input.ciudad}. Contesta sí o no.`,
        process.env.MANYCHAT_FLOW_CONFIRMACION_DISPONIBILIDAD && {
          flowNs: process.env.MANYCHAT_FLOW_CONFIRMACION_DISPONIBILIDAD,
          campos: { recordatorio_nombre: nombre, recordatorio_horario: horarioPropuesto, confirmacion_tipo: tipoLabel, confirmacion_ciudad: input.ciudad },
        }
      );
    }

    return { agendado: false, razon: 'confirmando_con_maria_jose', horario_propuesto: horarioPropuesto };
  }

  const horario = await finalizeBooking({
    phone,
    start: slot.start,
    end: slot.end,
    tipoLabel,
    m2: input.m2,
    ciudad: input.ciudad,
    nombre,
    contacto,
  });

  if (process.env.MARIA_JOSE_WHATSAPP_NUMBER) {
    // El teléfono se le pide al lead justo después de agendar, así que casi siempre todavía no
    // está — se lo avisamos aparte (con el número) apenas lo dé, ver handleSubmitContactPhone.
    const telefono = store.getConversation(phone).collected?.telefono_contacto;
    const lineaTelefono = telefono ? ` Teléfono: ${telefono}.` : ' Teléfono: pendiente, te lo mando apenas el lead lo dé.';
    await channels.notifyMariaJose(
      `Quedó agendado: ${horario} con ${nombre} — ${tipoLabel}, ${input.ciudad}.${lineaTelefono} ¿Te sirve o prefieres reagendar?`
    );
  }

  return { agendado: true, horario };
}

// Llamado desde reschedule.js cuando María José responde sí/no a una franja que chocaba con
// su calendario. Si confirma, agenda de una vez y avisa al lead directamente (no hay turno de
// Claude activo en ese momento). Si no, libera la conversación para que el lead proponga otra franja.
async function handlePendingConfirmationReply(phone, confirmed) {
  const state = store.getConversation(phone);
  const pending = state.pendingConfirmation;
  if (!pending) return null;

  if (confirmed) {
    const horario = await finalizeBooking({
      phone,
      start: new Date(pending.start),
      end: new Date(pending.end),
      tipoLabel: pending.tipoLabel,
      m2: pending.m2,
      ciudad: pending.ciudad,
      nombre: pending.nombre,
      contacto: pending.contacto,
    });
    // Mismo criterio que agent.js: un @usuario de Instagram guardado en contactoReal no cuenta
    // como teléfono — solo collected.telefono_contacto, que viene de submit_contact_phone.
    const pideTelefono = !state.collected?.telefono_contacto
      ? ' Una última cosa — ¿me compartes un número de teléfono de contacto, por si hace falta comunicarnos por otro medio?'
      : '';
    const mensajeConfirmacion = `¡Buenas noticias, ${pending.nombre}! La arquitecta María José confirmó y quedó agendada tu llamada para ${horario}. ¡Nos vemos pronto!${pideTelefono}`;
    await channels.sendToLead(state, mensajeConfirmacion);
    // Sin esto, Claude no ve en el historial que ya se envió este mensaje (incluida la
    // pregunta del teléfono) — lo trataría como si nunca se hubiera preguntado nada.
    store.appendMessage(phone, 'assistant', mensajeConfirmacion, state.channel);
    return { confirmed: true, horario, nombre: pending.nombre, telefono: state.collected?.telefono_contacto };
  }

  state.status = 'in_progress';
  delete state.pendingConfirmation;
  store.saveConversation(phone, state);
  const mensajeReagendar = `Ese horario finalmente no le funcionó a la arquitecta María José. ¿Me das 2-3 franjas alternativas (día y hora) para intentar de nuevo?`;
  await channels.sendToLead(state, mensajeReagendar);
  store.appendMessage(phone, 'assistant', mensajeReagendar, state.channel);
  return { confirmed: false, nombre: pending.nombre };
}

async function handleSubmitContactPhone(input, context) {
  const { phone, leadName } = context;
  const state = store.getConversation(phone);
  state.collected = { ...state.collected, telefono_contacto: input.telefono };
  state.contactoReal = input.telefono;
  store.saveConversation(phone, state);

  const datos = state.collected;
  const evento = state.scheduledEvent;
  const nombre = datos.nombre || leadName || channels.contactLabel(state);

  // Si la llamada ya está agendada, el evento de Calendar se creó antes de tener el teléfono —
  // lo actualizamos para que María José lo vea ahí mismo, sin ir a buscarlo a la conversación.
  // Un fallo de Calendar no debe impedir el aviso de abajo (ni al revés).
  let calendarActualizado = false;
  if (evento?.eventId && datos.tipo_proyecto && datos.m2 && datos.ciudad) {
    try {
      await calendar.updateEventDescription(
        evento.eventId,
        descripcionEvento({
          tipoLabel: TIPO_LABELS[datos.tipo_proyecto] || datos.tipo_proyecto,
          m2: datos.m2,
          ciudad: datos.ciudad,
          contacto: channels.contactLabel(state),
          telefono: input.telefono,
          canal: etiquetaCanal(state),
        })
      );
      calendarActualizado = true;
    } catch (e) {
      console.error('[tools] no se pudo agregar el teléfono al evento de Calendar', e);
    }
  }

  if (process.env.MARIA_JOSE_WHATSAPP_NUMBER) {
    // Mensaje autosuficiente: nombre + teléfono + cuándo es la llamada, para que no haga falta
    // abrir la conversación para saber de quién es el número.
    const cuando = evento?.horario ? ` — llamada ${evento.horario}` : '';
    const base = `Teléfono de ${nombre}: ${input.telefono}${cuando}`;
    // El horario ("…4:00 p. m.") ya termina en punto — evita el doble punto.
    const enCalendario = calendarActualizado ? ' Ya quedó también en el evento del calendario.' : '';
    await channels.notifyMariaJose(`${base}${base.endsWith('.') ? '' : '.'}${enCalendario}`);
  }

  return { guardado: true };
}

async function handleEscalateToHuman(input, context) {
  const { phone, leadName } = context;
  const state = store.getConversation(phone);
  state.status = 'escalated';
  state.escalation = { motivo: input.motivo, ts: new Date().toISOString() };
  store.saveConversation(phone, state);

  if (process.env.MARIA_JOSE_WHATSAPP_NUMBER) {
    await channels.notifyMariaJose(
      `Un lead necesita atención humana (${input.motivo}). Contacto: ${channels.contactLabel(state)}${leadName ? ' — ' + leadName : ''}.`
    );
  }

  return { escalado: true };
}

const toolHandlers = {
  submit_qualified_lead: handleSubmitQualifiedLead,
  submit_contact_phone: handleSubmitContactPhone,
  escalate_to_human: handleEscalateToHuman,
};

module.exports = { toolDefinitions, toolHandlers, handlePendingConfirmationReply };
