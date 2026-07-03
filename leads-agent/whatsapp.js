const crypto = require('crypto');

const GRAPH_VERSION = 'v20.0';

function isConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

async function sendMessage(to, text) {
  if (!isConfigured()) {
    console.log(`[whatsapp:dry-run] → ${to}: ${text}`);
    return { dryRun: true };
  }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[whatsapp] error enviando mensaje', res.status, data);
    throw new Error(`WhatsApp send failed: ${res.status}`);
  }
  return data;
}

// Meta firma el body con HMAC-SHA256 usando el App Secret; header: x-hub-signature-256: sha256=<hex>
function verifySignature(rawBody, signatureHeader) {
  if (!process.env.META_APP_SECRET) return true; // sin secret configurado, no se puede verificar (dry-run/local)
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', process.env.META_APP_SECRET)
    .update(rawBody)
    .digest('hex');
  const received = signatureHeader.replace('sha256=', '');
  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(received, 'hex');
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

// Extrae { from, name, text } del payload del webhook, o null si no es un mensaje de texto entrante.
function parseIncomingMessage(body) {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message || message.type !== 'text') return null;
  const contact = value.contacts?.[0];
  return {
    from: message.from,
    name: contact?.profile?.name || null,
    text: message.text?.body || '',
    messageId: message.id,
  };
}

module.exports = { isConfigured, sendMessage, verifySignature, parseIncomingMessage };
