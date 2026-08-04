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
        content: { messages: [{ type: 'text', text }] },
      },
      // Sin esto, ManyChat rechaza el envío si su registro de "última interacción" del
      // suscriptor no alcanzó a actualizarse todavía (aunque el usuario acabe de escribir).
      // HUMAN_AGENT es la etiqueta de Meta para respuestas de agente/bot a una consulta
      // entrante, válida hasta 7 días después del último mensaje del usuario.
      message_tag: 'HUMAN_AGENT',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[manychat] error enviando mensaje', res.status, data);
    throw new Error(`ManyChat send failed: ${res.status}`);
  }
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
