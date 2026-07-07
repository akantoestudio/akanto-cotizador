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

function defaultConversation(phone) {
  const now = new Date().toISOString();
  return {
    phone: sanitizePhone(phone),
    status: 'in_progress', // in_progress | pending_confirmation | scheduled | rescheduling | escalated | completed
    messages: [],
    collected: {},
    createdAt: now,
    updatedAt: now,
  };
}

function getConversation(phone) {
  const file = filePathFor(phone);
  if (!fs.existsSync(file)) return defaultConversation(phone);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return defaultConversation(phone);
  }
}

function saveConversation(phone, state) {
  state.phone = sanitizePhone(phone);
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePathFor(phone), JSON.stringify(state, null, 2));
  return state;
}

function appendMessage(phone, role, content) {
  const state = getConversation(phone);
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

module.exports = {
  getConversation,
  saveConversation,
  appendMessage,
  sanitizePhone,
  getMostRecentByStatus,
  listConversations,
};
