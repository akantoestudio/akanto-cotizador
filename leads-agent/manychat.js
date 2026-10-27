const MANYCHAT_SEND_URL = 'https://api.manychat.com/fb/sending/sendContent';
const MANYCHAT_SET_FIELDS_URL = 'https://api.manychat.com/fb/subscriber/setCustomFields';
const MANYCHAT_SEND_FLOW_URL = 'https://api.manychat.com/fb/sending/sendFlow';

function isConfigured() {
  return Boolean(process.env.MANYCHAT_API_KEY);
}

async function sendMessage(subscriberId, text, channel = 'instagram') {
  if (!isConfigured()) {
    console.log(`[manychat:dry-run] → ${subscriberId} (${channel}): ${text}`);
    return { dryRun: true };
  }
  const res = await fetch(MANYCHAT_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MANYCHAT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscriber_id: subscriberId,
      data: {
        version: 'v2',
        // Sin "type" acá, ManyChat no sabe por qué canal enviar el mensaje y cae en una
        // validación de Messenger que rechaza el envío con el error 3011 ("necesita un tag"),
        // incluso para respuestas inmediatas dentro de la ventana.
        content: { type: channel, messages: [{ type: 'text', text }] },
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[manychat] error enviando mensaje', res.status, JSON.stringify(data));
    throw new Error(`ManyChat send failed: ${res.status}`);
  }
  console.log(`[manychat] enviado a ${subscriberId} (${channel})`, JSON.stringify(data));
  return data;
}

// Llena los campos personalizados de un suscriptor (por nombre, no hace falta el ID numérico)
// — se usa para pasarle a una plantilla de WhatsApp los datos reales antes de dispararla con
// sendFlow (ver más abajo). Máximo 20 campos por llamada según la API de ManyChat.
async function setCustomFields(subscriberId, campos) {
  const fields = Object.entries(campos || {}).map(([field_name, field_value]) => ({ field_name, field_value }));
  if (fields.length === 0) return { skipped: true };
  if (!isConfigured()) {
    console.log(`[manychat:dry-run] setCustomFields → ${subscriberId}:`, JSON.stringify(campos));
    return { dryRun: true };
  }
  const res = await fetch(MANYCHAT_SET_FIELDS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MANYCHAT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscriber_id: subscriberId, fields }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[manychat] error seteando custom fields', res.status, JSON.stringify(data));
    throw new Error(`ManyChat setCustomFields failed: ${res.status}`);
  }
  return data;
}

// Dispara un Flow de ManyChat (identificado por su flow_ns) para un suscriptor — es el único
// método que sí puede mandar una plantilla de WhatsApp aprobada fuera de la ventana de 24h
// (sendContent, arriba, NO puede; ver leads-agent/mediaAck.js y store.js para el resto del
// contexto de la ventana de 24h). El Flow debe tener como primer paso un "Enviar mensaje" con
// esa plantilla seleccionada — ver README para cómo se armaron los flows de recordatorio y
// confirmación de disponibilidad.
async function sendFlow(subscriberId, flowNs) {
  if (!isConfigured()) {
    console.log(`[manychat:dry-run] sendFlow → ${subscriberId}: ${flowNs}`);
    return { dryRun: true };
  }
  const res = await fetch(MANYCHAT_SEND_FLOW_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MANYCHAT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscriber_id: subscriberId, flow_ns: flowNs }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[manychat] error enviando flow', res.status, JSON.stringify(data));
    throw new Error(`ManyChat sendFlow failed: ${res.status}`);
  }
  console.log(`[manychat] flow ${flowNs} disparado para ${subscriberId}`);
  return data;
}

// Extrae { from, text, name, channel, contactoReal } del body que manda la acción "Solicitud
// externa" del flujo de ManyChat correspondiente — los nombres de campo los define el flujo,
// ver README. "channel" es un valor fijo (no dinámico) que se pone distinto en cada
// automatización de ManyChat ("instagram" o "whatsapp"), para que sepamos por cuál canal
// responder. "contactoReal" es el teléfono real (WhatsApp) o @usuario (Instagram) — distinto
// del ID interno de suscriptor que usamos como "from", y es lo que un humano necesita para
// contactar al lead por fuera del bot.
// Un valor tipo "{{phone}}" es un merge tag de ManyChat que no se alcanzó a reemplazar (campo
// vacío o tag inválido para ese canal) — no sirve como dato de contacto real.
function limpiarContacto(valor) {
  if (!valor || /^\s*\{\{.*\}\}\s*$/.test(valor)) return null;
  return String(valor).trim() || null;
}

function parseIncomingMessage(body) {
  const from = body?.subscriber_id;
  const text = body?.text;
  const name = body?.name || null;
  const channel = body?.channel === 'whatsapp' ? 'whatsapp' : 'instagram';
  const contactoReal = limpiarContacto(body?.contacto_real);
  if (!from || !text) return null;
  return { from: String(from), text, name, channel, contactoReal };
}

// Instagram (y WhatsApp) mandan las reacciones a un mensaje — 👏, ❤️, 👍 — por el mismo webhook
// que usa para mensajes de texto reales, con el emoji como si fuera el "text". Si todo el
// mensaje no tiene ni una sola letra ni número, es casi seguro una reacción y no un mensaje —
// lo ignoramos para no reabrir la calificación (ej. preguntar de nuevo "¿consultorio o espacio
// comercial?") con un simple emoji suelto a algo que ya dijimos.
function esSoloReaccion(text) {
  return !/[\p{L}\p{N}]/u.test(String(text || ''));
}

// Cuando el lead manda una imagen o archivo, ManyChat lo reenvía como un link puro a su
// storage (ej. "https://manybot-files.s3.../original_xxx.jpeg"), sin texto alrededor. Si el
// mensaje completo es solo esa URL, es un archivo adjunto, no algo que alguien tipeó.
function esArchivoMultimedia(text) {
  return /^\s*https?:\/\/\S+\s*$/.test(String(text || ''));
}

module.exports = {
  isConfigured,
  sendMessage,
  setCustomFields,
  sendFlow,
  parseIncomingMessage,
  esSoloReaccion,
  esArchivoMultimedia,
};
