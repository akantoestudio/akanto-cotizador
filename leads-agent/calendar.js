const { google } = require('googleapis');

const TIMEZONE = 'America/Bogota';
const BOGOTA_UTC_OFFSET = '-05:00'; // Colombia no observa horario de verano
const EVENT_DURATION_MINUTES = 60;
const BUSINESS_DAYS = [1, 2, 3, 4, 5]; // lunes(1) a viernes(5) — domingo=0, sábado=6
const BUSINESS_HOUR_START = 9; // 9:00am
const BUSINESS_HOUR_END = 17; // usado para generar sugerencias de reagendamiento (última hora en punto: 4:00pm)
const BUSINESS_LAST_CALL_MINUTES = 16 * 60 + 30; // 4:30pm — hora de inicio más tardía permitida

function isConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 && process.env.GOOGLE_CALENDAR_ID);
}

function getAuth() {
  const json = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8');
  const credentials = JSON.parse(json);
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
}

function getCalendarClient() {
  return google.calendar({ version: 'v3', auth: getAuth() });
}

// slot: { fecha: 'YYYY-MM-DD', hora_inicio: 'HH:MM', hora_fin?: 'HH:MM' }
function slotToRange(slot) {
  const start = new Date(`${slot.fecha}T${slot.hora_inicio}:00${BOGOTA_UTC_OFFSET}`);
  const end = slot.hora_fin
    ? new Date(`${slot.fecha}T${slot.hora_fin}:00${BOGOTA_UTC_OFFSET}`)
    : new Date(start.getTime() + EVENT_DURATION_MINUTES * 60000);
  return { start, end };
}

// Recibe hasta 3 franjas candidatas (ya estructuradas por el agente) y devuelve
// la primera que esté libre en el calendario de María José, o null si ninguna lo está.
async function findMatchingSlot(candidateSlots) {
  if (!candidateSlots || candidateSlots.length === 0) return null;

  if (!isConfigured()) {
    console.log('[calendar:dry-run] sin credenciales de Google — se asume libre la primera franja candidata', candidateSlots[0]);
    return { ...slotToRange(candidateSlots[0]), source: candidateSlots[0] };
  }

  const calendar = getCalendarClient();
  const ranges = candidateSlots.map(slotToRange);
  const timeMin = ranges.reduce((min, r) => (r.start < min ? r.start : min), ranges[0].start);
  const timeMax = ranges.reduce((max, r) => (r.end > max ? r.end : max), ranges[0].end);

  const fb = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: TIMEZONE,
      items: [{ id: process.env.GOOGLE_CALENDAR_ID }],
    },
  });
  const busy = fb.data.calendars?.[process.env.GOOGLE_CALENDAR_ID]?.busy || [];

  for (let i = 0; i < ranges.length; i++) {
    const { start, end } = ranges[i];
    const overlaps = busy.some((b) => new Date(b.start) < end && new Date(b.end) > start);
    if (!overlaps) return { start, end, source: candidateSlots[i] };
  }
  return null;
}

async function createEvent({ start, end, summary, description }) {
  if (!isConfigured()) {
    console.log('[calendar:dry-run] crear evento', { summary, start, end });
    return { dryRun: true, id: null, htmlLink: null };
  }
  const calendar = getCalendarClient();
  const res = await calendar.events.insert({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    requestBody: {
      summary,
      description,
      start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
      end: { dateTime: end.toISOString(), timeZone: TIMEZONE },
    },
  });
  return res.data;
}

async function moveEvent(eventId, start, end) {
  if (!isConfigured() || !eventId) {
    console.log('[calendar:dry-run] mover evento', { eventId, start, end });
    return { dryRun: true };
  }
  const calendar = getCalendarClient();
  const res = await calendar.events.patch({
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    eventId,
    requestBody: {
      start: { dateTime: start.toISOString(), timeZone: TIMEZONE },
      end: { dateTime: end.toISOString(), timeZone: TIMEZONE },
    },
  });
  return res.data;
}

// Convierte un instante a sus componentes de fecha/día-de-semana/hora en hora de Bogotá.
function bogotaParts(date) {
  const b = new Date(date.getTime() - 5 * 60 * 60 * 1000);
  return {
    year: b.getUTCFullYear(),
    month: b.getUTCMonth(),
    date: b.getUTCDate(),
    day: b.getUTCDay(),
    minutesSinceMidnight: b.getUTCHours() * 60 + b.getUTCMinutes(),
  };
}

// Horario corporativo: lunes a viernes, 9:00am a 4:30pm (última hora de inicio permitida).
function isWithinBusinessHours(slot) {
  const { start } = slotToRange(slot);
  const parts = bogotaParts(start);
  if (!BUSINESS_DAYS.includes(parts.day)) return false;
  return parts.minutesSinceMidnight >= BUSINESS_HOUR_START * 60 && parts.minutesSinceMidnight <= BUSINESS_LAST_CALL_MINUTES;
}

function fechaStr(year, month, date) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
}

// Busca las próximas `count` franjas libres de 1 hora en horario laboral (L-V, 9am-6pm)
// después de `after`. Usada cuando María José pide reagendar.
async function findNextFreeSlots(after, count = 3) {
  const daysToScan = 10;
  const candidateSlots = [];
  for (let d = 0; d < daysToScan; d++) {
    const dayDate = new Date(after.getTime() + d * 24 * 60 * 60 * 1000);
    const parts = bogotaParts(dayDate);
    if (parts.day === 0 || parts.day === 6) continue; // fines de semana
    const fecha = fechaStr(parts.year, parts.month, parts.date);
    for (let hour = BUSINESS_HOUR_START; hour < BUSINESS_HOUR_END; hour++) {
      const slot = slotToRange({ fecha, hora_inicio: `${String(hour).padStart(2, '0')}:00` });
      if (slot.start > after) candidateSlots.push(slot);
    }
  }
  if (candidateSlots.length === 0) return [];

  if (!isConfigured()) {
    return candidateSlots.slice(0, count);
  }

  const calendar = getCalendarClient();
  const fb = await calendar.freebusy.query({
    requestBody: {
      timeMin: candidateSlots[0].start.toISOString(),
      timeMax: candidateSlots[candidateSlots.length - 1].end.toISOString(),
      timeZone: TIMEZONE,
      items: [{ id: process.env.GOOGLE_CALENDAR_ID }],
    },
  });
  const busy = fb.data.calendars?.[process.env.GOOGLE_CALENDAR_ID]?.busy || [];

  const results = [];
  for (const slot of candidateSlots) {
    const overlaps = busy.some((b) => new Date(b.start) < slot.end && new Date(b.end) > slot.start);
    if (!overlaps) results.push(slot);
    if (results.length >= count) break;
  }
  return results;
}

module.exports = {
  isConfigured,
  findMatchingSlot,
  createEvent,
  moveEvent,
  findNextFreeSlots,
  slotToRange,
  isWithinBusinessHours,
  TIMEZONE,
};
