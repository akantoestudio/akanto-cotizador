const GRAPH_VERSION = 'v20.0';

// INSTAGRAM_ACCOUNT_ID: el ID que usa la Graph API para enviar mensajes desde esta cuenta —
// puede ser el ID de la cuenta profesional de Instagram o el ID de la Página de Facebook
// vinculada, según cómo haya quedado conectada la cuenta. Se confirma probando en vivo.
function isConfigured() {
  return Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_ACCOUNT_ID);
}

async function sendMessage(igsid, text) {
  if (!isConfigured()) {
    console.log(`[instagram:dry-run] → ${igsid}: ${text}`);
    return { dryRun: true };
  }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.INSTAGRAM_ACCOUNT_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { id: igsid },
      message: { text },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[instagram] error enviando mensaje', res.status, data);
    throw new Error(`Instagram send failed: ${res.status}`);
  }
  return data;
}

// Extrae { from, text } de un webhook de Instagram Direct, o null si no aplica.
// No trae el nombre del lead — Instagram no lo incluye en el webhook de mensajes.
function parseIncomingMessage(body) {
  const messaging = body?.entry?.[0]?.messaging?.[0];
  const text = messaging?.message?.text;
  if (!messaging || !text) return null;
  // Los webhooks de "echo" (mensajes que el propio negocio envió) traen is_echo: true — se ignoran.
  if (messaging.message?.is_echo) return null;
  return {
    from: messaging.sender?.id,
    text,
    name: null,
  };
}

module.exports = { isConfigured, sendMessage, parseIncomingMessage };
