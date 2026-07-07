const express = require('express');
const whatsapp = require('./whatsapp');
const agent = require('./agent');
const reschedule = require('./reschedule');
const store = require('./store');
const adminRouter = require('./admin');

const router = express.Router();

if (!process.env.LEADS_AGENT_SIMULATE_TOKEN) {
  console.warn('[leads-agent] LEADS_AGENT_SIMULATE_TOKEN no configurado — /leads-agent/simulate queda sin protección.');
}
if (!process.env.ADMIN_TOKEN) {
  console.warn('[leads-agent] ADMIN_TOKEN no configurado — /leads-agent/admin queda sin protección.');
}

function rawBodySaver(req, res, buf) {
  req.rawBody = buf;
}

async function routeIncomingMessage(from, text, name) {
  const mariaJose = process.env.MARIA_JOSE_WHATSAPP_NUMBER;
  if (mariaJose && store.sanitizePhone(from) === store.sanitizePhone(mariaJose)) {
    const reply = await reschedule.handleMariaJoseMessage(text);
    if (reply) await whatsapp.sendMessage(from, reply);
    return { reply };
  }
  const { reply } = await agent.handleIncomingLeadMessage(from, text, name);
  if (reply) await whatsapp.sendMessage(from, reply);
  return { reply };
}

// Meta llama a este GET una vez, al configurar la URL del webhook en Meta Business Manager.
router.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Mensajes entrantes de WhatsApp Business.
router.post('/webhook/whatsapp', express.json({ verify: rawBodySaver }), async (req, res) => {
  // Responde rápido — Meta reintenta la entrega si no recibe 200 en pocos segundos.
  res.sendStatus(200);

  const signature = req.headers['x-hub-signature-256'];
  if (!whatsapp.verifySignature(req.rawBody, signature)) {
    console.warn('[webhook] firma inválida — se ignora el mensaje');
    return;
  }

  const incoming = whatsapp.parseIncomingMessage(req.body);
  if (!incoming) return;

  try {
    await routeIncomingMessage(incoming.from, incoming.text, incoming.name);
  } catch (e) {
    console.error('[webhook] error procesando mensaje entrante', e);
  }
});

// Endpoint de prueba: simula un mensaje entrante sin necesidad de WhatsApp/Meta real.
// Protegido con LEADS_AGENT_SIMULATE_TOKEN (header x-simulate-token) cuando está configurado.
router.post('/leads-agent/simulate', express.json(), async (req, res) => {
  const token = process.env.LEADS_AGENT_SIMULATE_TOKEN;
  if (token && req.headers['x-simulate-token'] !== token) {
    return res.status(401).json({ error: 'token inválido' });
  }
  const { from, text, name } = req.body || {};
  if (!from || !text) return res.status(400).json({ error: 'from y text son requeridos' });
  try {
    const result = await routeIncomingMessage(from, text, name);
    const state = store.getConversation(from);
    res.json({ reply: result.reply, status: state.status, collected: state.collected });
  } catch (e) {
    console.error('[simulate] error', e);
    res.status(500).json({ error: e.message });
  }
});

router.use(adminRouter);

module.exports = router;
