const calendar = require('./calendar');
const sheets = require('./sheets');
const whatsapp = require('./whatsapp');
const store = require('./store');

const TIPO_LABELS = {
  consultorio: 'consultorio',
  espacio_comercial: 'espacio comercial',
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
          enum: ['consultorio', 'espacio_comercial'],
          description: 'Tipo de proyecto del lead.',
        },
        m2: { type: 'number', description: 'Metros cuadrados aproximados del espacio.' },
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

function formatFecha(date) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: calendar.TIMEZONE,
  }).format(date);
}

async function handleSubmitQualifiedLead(input, context) {
  const { phone, leadName } = context;
  const tipoLabel = TIPO_LABELS[input.tipo_proyecto] || input.tipo_proyecto;
  const contacto = `WhatsApp: ${phone}`;
  const nombre = leadName || 'Lead sin nombre en WhatsApp';

  const slot = await calendar.findMatchingSlot(input.franjas_disponibilidad);

  const state = store.getConversation(phone);
  state.collected = { ...state.collected, ...input, nombre };

  if (!slot) {
    store.saveConversation(phone, state);
    return { agendado: false, razon: 'ninguna_franja_libre' };
  }

  const createdEvent = await calendar.createEvent({
    start: slot.start,
    end: slot.end,
    summary: `Llamada con ${nombre} — ${tipoLabel}`,
    description: `${tipoLabel}, ${input.m2} m², ${input.ciudad}. Contacto: ${contacto}`,
  });

  const horario = formatHorario(slot.start);

  await sheets.appendLeadRow({
    fecha: formatFecha(new Date()),
    nombre,
    tipoProyecto: tipoLabel,
    m2: input.m2,
    ciudad: input.ciudad,
    horario,
    estado: 'Agendado',
  });

  state.status = 'scheduled';
  state.scheduledEvent = {
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    horario,
    eventId: createdEvent.id || null,
  };
  store.saveConversation(phone, state);

  if (process.env.MARIA_JOSE_WHATSAPP_NUMBER) {
    await whatsapp.sendMessage(
      process.env.MARIA_JOSE_WHATSAPP_NUMBER,
      `Quedó agendado: ${horario} con ${nombre} — ${tipoLabel}, ${input.ciudad}. ¿Te sirve o prefieres reagendar?`
    );
  }

  return { agendado: true, horario };
}

async function handleEscalateToHuman(input, context) {
  const { phone, leadName } = context;
  const state = store.getConversation(phone);
  state.status = 'escalated';
  state.escalation = { motivo: input.motivo, ts: new Date().toISOString() };
  store.saveConversation(phone, state);

  if (process.env.MARIA_JOSE_WHATSAPP_NUMBER) {
    await whatsapp.sendMessage(
      process.env.MARIA_JOSE_WHATSAPP_NUMBER,
      `Un lead necesita atención humana (${input.motivo}). Contacto: WhatsApp ${phone}${leadName ? ' — ' + leadName : ''}.`
    );
  }

  return { escalado: true };
}

const toolHandlers = {
  submit_qualified_lead: handleSubmitQualifiedLead,
  escalate_to_human: handleEscalateToHuman,
};

module.exports = { toolDefinitions, toolHandlers };
