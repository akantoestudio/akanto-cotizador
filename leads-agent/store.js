const fs = require('fs');
const path = require('path');

const LEADS_DIR = path.join(__dirname, '..', 'data', 'leads');
if (!fs.existsSync(LEADS_DIR)) fs.mkdirSync(LEADS_DIR, { recursive: true });

function sanitizePhone(phone) {
  return String(phone).replace(/[^0-9]/g, '');
}

function filePathFor(phone) {
  return path.join(LEADS_DIR, `${sanitizePhone(phone)}.json`);
}

function defaultConversation(phone, channel = 'whatsapp') {
  const now = new Date().toISOString();
  return {
    phone: sanitizePhone(phone),
    channel, // 'whatsapp' | 'instagram' — determina por dónde se le responde al lead
    status: 'in_progress', // in_progress | pending_confirmation | scheduled | rescheduling | escalated | completed
    messages: [],
    collected: {},
    createdAt: now,
    updatedAt: now,
  };
}

function getConversation(phone, channel = 'whatsapp') {
  const file = filePathFor(phone);
  if (!fs.existsSync(file)) return defaultConversation(phone, channel);
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!state.channel) state.channel = 'whatsapp'; // conversaciones creadas antes de soportar canales
    return state;
  } catch (e) {
    return defaultConversation(phone, channel);
  }
}

function saveConversation(phone, state) {
  state.phone = sanitizePhone(phone);
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePathFor(phone), JSON.stringify(state, null, 2));
  return state;
}

function appendMessage(phone, role, content, channel = 'whatsapp') {
  const state = getConversation(phone, channel);
  state.messages.push({ role, content, ts: new Date().toISOString() });
  return saveConversation(phone, state);
}

// Usado por reschedule.js: encuentra la conversación más reciente en un estado dado (ej.
// 'scheduled' o 'rescheduling'), asumiendo que solo hay una en curso a la vez con María José.
function getMostRecentByStatus(status) {
  const files = fs.readdirSync(LEADS_DIR).filter((f) => f.endsWith('.json'));
  let best = null;
  for (const f of files) {
    try {
      const state = JSON.parse(fs.readFileSync(path.join(LEADS_DIR, f), 'utf8'));
      if (state.status === status && (!best || state.updatedAt > best.updatedAt)) {
        best = state;
      }
    } catch (e) {
      // ignora archivos corruptos
    }
  }
  return best;
}

// Lista todas las conversaciones, más recientes primero. Usado por el panel de administración.
function listConversations() {
  const files = fs.readdirSync(LEADS_DIR).filter((f) => f.endsWith('.json'));
  const conversations = [];
  for (const f of files) {
    try {
      conversations.push(JSON.parse(fs.readFileSync(path.join(LEADS_DIR, f), 'utf8')));
    } catch (e) {
      // ignora archivos corruptos
    }
  }
  return conversations.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

// --- Ventana de mensajería de 24h de WhatsApp Business ---
// Pasadas 24h desde el último mensaje real que nos mandó un contacto, Meta bloquea cualquier
// mensaje de texto libre — solo se puede reabrir la conversación con un "message template"
// pre-aprobado (que ManyChat no soporta vía sendContent, ver manychat.js). Esto registra cuándo
// nos escribió María José / el respaldo, para poder avisar ANTES de un envío automático
// (recordatorios, notificaciones) que probablemente no vaya a llegar.
const VENTANA_MENSAJERIA_HORAS = 24;

// Llamar cada vez que un número autorizado (María José, respaldo) nos escribe de verdad —
// una reacción (👏, etc.) no cuenta, se filtra antes de llegar acá.
function registrarMensajeEntrante(phone) {
  const state = getConversation(phone);
  state.lastInboundAt = new Date().toISOString();
  saveConversation(phone, state);
}

function horasDesdeUltimoMensaje(phone) {
  const state = getConversation(phone);
  if (!state.lastInboundAt) return Infinity; // nunca registrado — tratamos como ventana cerrada
  return (Date.now() - new Date(state.lastInboundAt).getTime()) / (1000 * 60 * 60);
}

function dentroDeVentanaMensajeria(phone) {
  return horasDesdeUltimoMensaje(phone) < VENTANA_MENSAJERIA_HORAS;
}

module.exports = {
  getConversation,
  saveConversation,
  appendMessage,
  sanitizePhone,
  getMostRecentByStatus,
  listConversations,
  registrarMensajeEntrante,
  dentroDeVentanaMensajeria,
};
