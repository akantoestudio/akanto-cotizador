const manychat = require('./manychat');

const CONTACT_LABELS = {
  whatsapp: 'WhatsApp',
  'whatsapp-manychat': 'WhatsApp',
  instagram: 'Instagram',
};

// Envía un mensaje al lead por el canal donde está la conversación. WhatsApp e Instagram se
// entregan vía ManyChat (ver manychat.js) — evita depender de la revisión de permisos de Meta
// para mensajería. "whatsapp-manychat" queda como alias por conversaciones viejas guardadas
// antes de simplificar el nombre del canal a "whatsapp".
async function sendToLead(conversationState, text) {
  const manychatChannel = conversationState.channel === 'instagram' ? 'instagram' : 'whatsapp';
  return manychat.sendMessage(conversationState.phone, text, manychatChannel);
}

// Notifica a María José por WhatsApp — siempre por su número fijo, sin importar de qué
// conversación viene el aviso.
function notifyMariaJose(text) {
  return manychat.sendMessage(process.env.MARIA_JOSE_WHATSAPP_NUMBER, text, 'whatsapp');
}

// Usa el dato de contacto real (teléfono de WhatsApp o @usuario de Instagram) cuando lo
// tenemos guardado — conversationState.phone es el ID interno de suscriptor de ManyChat, no
// sirve para que un humano contacte al lead por fuera del bot.
function contactLabel(conversationState) {
  const label = CONTACT_LABELS[conversationState.channel] || CONTACT_LABELS.whatsapp;
  const dato = conversationState.contactoReal || conversationState.phone;
  return `${label}: ${dato}`;
}

module.exports = { sendToLead, notifyMariaJose, contactLabel };
