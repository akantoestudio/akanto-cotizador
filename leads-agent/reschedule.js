const calendar = require('./calendar');
const whatsapp = require('./whatsapp');
const store = require('./store');
const tools = require('./tools');

const CONFIRM_WORDS = ['si', 'listo', 'perfecto', 'dale', 'vale', 'ok', 'okay', 'confirmado', 'sirve'];
const RESCHEDULE_WORDS = ['reagendar', 'reagenda', 'cambiar', 'cambio', 'otra', 'muevelo', 'no puedo', 'no me sirve'];
const PENDING_YES_WORDS = ['si', 'puedo', 'claro', 'listo', 'dale', 'sirve'];
const PENDING_NO_WORDS = ['no puedo', 'no puede', 'no le sirve', 'no funciona', 'imposible', 'no va a poder'];

function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function matchesAny(normalizedText, words) {
  return words.some((w) => normalizedText.includes(normalize(w)));
}

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

// Maneja mensajes que llegan del número de María José: confirmar, pedir reagendar, o elegir
// una de las opciones numeradas que le ofrecimos. No pasa por Claude — es un flujo determinístico.
async function handleMariaJoseMessage(text) {
  const normalized = normalize(text);

  const pending = store.getMostRecentByStatus('rescheduling');
  if (pending) {
    const choice = normalized.match(/^([1-3])\b/) || normalized.match(/opcion\s*([1-3])/);
    if (choice) {
      const index = Number(choice[1]) - 1;
      const option = pending.pendingRescheduleOptions?.[index];
      if (option) {
        const start = new Date(option.start);
        const end = new Date(option.end);
        await calendar.moveEvent(pending.scheduledEvent?.eventId, start, end);
        const horario = formatHorario(start);

        pending.status = 'scheduled';
        pending.scheduledEvent = { ...pending.scheduledEvent, start: start.toISOString(), end: end.toISOString(), horario };
        delete pending.pendingRescheduleOptions;
        store.saveConversation(pending.phone, pending);

        await whatsapp.sendMessage(pending.phone, `¡Buenas noticias! Movimos tu llamada con María José a ${horario}. Cualquier cosa me escribes.`);
        return `Confirmado, quedó movido a ${horario}.`;
      }
    }
    return 'Contesta 1, 2 o 3 para elegir una de las franjas que te propuse.';
  }

  const pendingConfirmation = store.getMostRecentByStatus('pending_confirmation');
  if (pendingConfirmation) {
    // "no"/"sí" sueltos (sin más palabras) no calzan con las frases de la lista — se detectan
    // aparte como palabra completa al inicio del mensaje.
    const no = /^no\b/.test(normalized) || matchesAny(normalized, PENDING_NO_WORDS);
    const yes = !no && (/^s[ií]\b/.test(normalized) || matchesAny(normalized, PENDING_YES_WORDS));
    if (yes) {
      const result = await tools.handlePendingConfirmationReply(pendingConfirmation.phone, true);
      return result ? `Perfecto, quedó confirmada la llamada con ${result.nombre} para ${result.horario}.` : 'Listo.';
    }
    if (no) {
      await tools.handlePendingConfirmationReply(pendingConfirmation.phone, false);
      return 'Entendido, le pido al lead que proponga otra franja.';
    }
    return 'Contesta "sí" si puedes atenderla a esa hora, o "no" si prefieres que busque otro horario.';
  }

  const scheduled = store.getMostRecentByStatus('scheduled');
  if (!scheduled) {
    return 'No tengo ningún agendamiento pendiente de confirmación en este momento.';
  }

  if (matchesAny(normalized, RESCHEDULE_WORDS)) {
    const after = new Date(scheduled.scheduledEvent?.end || Date.now());
    const options = await calendar.findNextFreeSlots(after, 3);
    if (options.length === 0) {
      return 'No encontré franjas libres próximas para reagendar — revisa el calendario manualmente.';
    }
    scheduled.status = 'rescheduling';
    scheduled.pendingRescheduleOptions = options.map((o) => ({ start: o.start.toISOString(), end: o.end.toISOString() }));
    store.saveConversation(scheduled.phone, scheduled);

    const listado = options.map((o, i) => `${i + 1}. ${formatHorario(o.start)}`).join('\n');
    return `Estas son las próximas franjas libres:\n${listado}\nContesta con el número de la que prefieras.`;
  }

  if (matchesAny(normalized, CONFIRM_WORDS)) {
    scheduled.status = 'completed';
    store.saveConversation(scheduled.phone, scheduled);
    return 'Perfecto, quedó confirmado.';
  }

  return 'No te entendí — contesta "sí" para confirmar o "reagendar" si prefieres otra franja.';
}

module.exports = { handleMariaJoseMessage };
