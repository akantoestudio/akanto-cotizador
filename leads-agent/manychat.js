const MANYCHAT_SEND_URL = 'https://api.manychat.com/fb/sending/sendContent';

function isConfigured() {
  return Boolean(process.env.MANYCHAT_API_KEY);
}

async function sendMessage(subscriberId, text) {
  if (!isConfigured()) {
    console.log(`[manychat:dry-run] → ${subscriberId}: ${text}`);
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
        // Sin "type": "instagram" acá, ManyChat no sabe por qué canal enviar el mensaje y
        // cae en una validación de Messenger que rechaza el envío con el error 3011
        // ("necesita un tag"), incluso para respuestas inmediatas dentro de la ventana.
        content: { type: 'instagram', messages: [{ type: 'text', text }] },
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[manychat] error enviando mensaje', res.status, JSON.stringify(data));
    throw new Error(`ManyChat send failed: ${res.status}`);
  }
  console.log(`[manychat] enviado a ${subscriberId}`, JSON.stringify(data));
  return data;
}

// Extrae { from, text, name } del body que manda la acción "Solicitud externa" del flujo de
// ManyChat (Instagram Default Reply) — los nombres de campo los define el flujo, ver README.
function parseIncomingMessage(body) {
  const from = body?.subscriber_id;
  const text = body?.text;
  const name = body?.name || null;
  if (!from || !text) return null;
  return { from: String(from), text, name };
}

module.exports = { isConfigured, sendMessage, parseIncomingMessage };
