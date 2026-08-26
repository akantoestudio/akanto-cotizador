const store = require('./store');
const channels = require('./channels');
const calendar = require('./calendar');

const CHECK_INTERVAL_MS = 60 * 1000;
const REMINDER_MINUTES_BEFORE = 10;

function formatHorario(date) {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: calendar.TIMEZONE,
  }).format(date);
}

// Revisa las llamadas agendadas y le avisa a María José por WhatsApp ~10 minutos antes de
// cada una. state.scheduledEvent.reminderSent evita mandarlo más de una vez por llamada.
async function checkUpcomingCalls() {
  const now = Date.now();
  for (const state of store.listConversations()) {
    if (state.status !== 'scheduled' || !state.scheduledEvent || state.scheduledEvent.reminderSent) continue;

    const minutesUntil = (new Date(state.scheduledEvent.start).getTime() - now) / 60000;
    if (minutesUntil > REMINDER_MINUTES_BEFORE || minutesUntil <= 0) continue;

    const nombre = state.collected?.nombre || 'un lead';
    const contacto = channels.contactLabel(state);
    try {
      await channels.notifyMariaJose(
        `Recordatorio: tienes una llamada en ${REMINDER_MINUTES_BEFORE} minutos con ${nombre} (${contacto}) — ${formatHorario(new Date(state.scheduledEvent.start))}.`
      );
      state.scheduledEvent.reminderSent = true;
      store.saveConversation(state.phone, state);
    } catch (e) {
      console.error('[reminders] error enviando recordatorio', e);
    }
  }
}

function start() {
  setInterval(() => {
    checkUpcomingCalls().catch((e) => console.error('[reminders] error en chequeo periódico', e));
  }, CHECK_INTERVAL_MS);
}

module.exports = { start, checkUpcomingCalls };
