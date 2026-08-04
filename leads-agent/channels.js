const whatsapp = require('./whatsapp');
const manychat = require('./manychat');

const CONTACT_LABELS = {
  whatsapp: 'WhatsApp',
  'whatsapp-manychat': 'WhatsApp',
  instagram: 'Instagram',
};

// Envía un mensaje al lead por el canal donde está la conversación. Instagram y el WhatsApp de
// prueba conectado a ManyChat ("whatsapp-manychat") se entregan vía ManyChat (ver manychat.js)
// — evita depender de la revisión de permisos de Meta para mensajería de Instagram. El WhatsApp
// de producción ("whatsapp") sigue yendo directo por nuestra propia integración con Meta,
// intacta, mientras se valida el canal de ManyChat.
// Las notificaciones a María José siempre van por WhatsApp directo, no pasan por aquí.
async function sendToLead(conversationState, text) {
  if (conversationState.channel === 'instagram') {
    return manychat.sendMessage(conversationState.phone, text, 'instagram');
  }
  if (conversationState.channel === 'whatsapp-manychat') {
    return manychat.sendMessage(conversationState.phone, text, 'whatsapp');
  }
  return whatsapp.sendMessage(conversationState.phone, text);
}

function contactLabel(conversationState) {
  const label = CONTACT_LABELS[conversationState.channel] || CONTACT_LABELS.whatsapp;
  return `${label}: ${conversationState.phone}`;
}

module.exports = { sendToLead, contactLabel };
