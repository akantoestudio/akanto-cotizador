const MANYCHAT_SEND_URL = 'https://api.manychat.com/fb/sending/sendContent';

function isConfigured() {
  return Boolean(process.env.MANYCHAT_API_KEY);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function attemptSend(subscriberId, text) {
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
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function sendMessage(subscriberId, text) {
  if (!isConfigured()) {
    console.log(`[manychat:dry-run] → ${subscriberId}: ${text}`);
    return { dryRun: true };
  }
  // Código 3011: ManyChat rechaza el envío porque su registro de "última interacción" del
  // suscriptor todavía no se actualizó (aunque el usuario acabe de escribir) — parece un
  // problema de sincronización pasajero de su lado. Reintentamos con un pequeño retraso.
  const delaysMs = [0, 2000, 4000];
  let last;
  for (const delay of delaysMs) {
    if (delay) await sleep(delay);
    last = await attemptSend(subscriberId, text);
    if (last.ok) {
      console.log(`[manychat] enviado a ${subscriberId}`, JSON.stringify(last.data));
      return last.data;
    }
    if (last.data?.code !== 3011) break;
  }
  console.error('[manychat] error enviando mensaje', last.status, JSON.stringify(last.data));
  throw new Error(`ManyChat send failed: ${last.status}`);
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
