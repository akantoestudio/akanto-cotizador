const whatsapp = require('./whatsapp');
const instagram = require('./instagram');

const CONTACT_LABELS = { whatsapp: 'WhatsApp', instagram: 'Instagram' };

// Envía un mensaje al lead por el canal donde está la conversación (WhatsApp o Instagram).
// Las notificaciones a María José siempre van por WhatsApp directo, no pasan por aquí.
async function sendToLead(conversationState, text) {
  if (conversationState.channel === 'instagram') {
    return instagram.sendMessage(conversationState.phone, text);
  }
  return whatsapp.sendMessage(conversationState.phone, text);
}

function contactLabel(conversationState) {
  const label = CONTACT_LABELS[conversationState.channel] || CONTACT_LABELS.whatsapp;
  return `${label}: ${conversationState.phone}`;
}

module.exports = { sendToLead, contactLabel };
