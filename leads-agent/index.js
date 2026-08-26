const express = require('express');
const manychat = require('./manychat');
const channels = require('./channels');
const agent = require('./agent');
const reschedule = require('./reschedule');
const store = require('./store');
const adminRouter = require('./admin');
const reminders = require('./reminders');

const router = express.Router();

if (!process.env.LEADS_AGENT_SIMULATE_TOKEN) {
  console.warn('[leads-agent] LEADS_AGENT_SIMULATE_TOKEN no configurado — /leads-agent/simulate queda sin protección.');
}
if (!process.env.ADMIN_TOKEN) {
  console.warn('[leads-agent] ADMIN_TOKEN no configurado — /leads-agent/admin queda sin protección.');
}

reminders.start();

async function routeIncomingMessage(channel, from, text, name) {
  const mariaJose = process.env.MARIA_JOSE_WHATSAPP_NUMBER;
  if (channel !== 'instagram' && mariaJose && store.sanitizePhone(from) === store.sanitizePhone(mariaJose)) {
    const reply = await reschedule.handleMariaJoseMessage(text);
    if (reply) await channels.notifyMariaJose(reply);
    return { reply };
  }
  const { reply } = await agent.handleIncomingLeadMessage(from, text, name, channel);
  if (reply) await channels.sendToLead(store.getConversation(from, channel), reply);
  return { reply };
}

// Mensajes entrantes de WhatsApp e Instagram, vía la acción "Solicitud externa" de las
// automatizaciones de ManyChat — evita depender de la revisión de permisos de mensajería de
// Meta (tanto para Instagram como para WhatsApp).
router.post('/webhook/manychat', express.json(), async (req, res) => {
  const token = req.headers['x-manychat-token'];
  if (!process.env.MANYCHAT_WEBHOOK_SECRET || token !== process.env.MANYCHAT_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'token inválido' });
  }

  const incoming = manychat.parseIncomingMessage(req.body);
  if (!incoming) return res.status(400).json({ error: 'subscriber_id y text son requeridos' });

  try {
    const result = await routeIncomingMessage(incoming.channel, incoming.from, incoming.text, incoming.name);
    res.json({ reply: result.reply });
  } catch (e) {
    console.error('[webhook] error procesando mensaje entrante de manychat', e);
    res.status(500).json({ error: e.message });
  }
});

// Endpoint de prueba: simula un mensaje entrante sin necesidad de WhatsApp/Instagram real.
// Protegido con LEADS_AGENT_SIMULATE_TOKEN (header x-simulate-token) cuando está configurado.
router.post('/leads-agent/simulate', express.json(), async (req, res) => {
  const token = process.env.LEADS_AGENT_SIMULATE_TOKEN;
  if (token && req.headers['x-simulate-token'] !== token) {
    return res.status(401).json({ error: 'token inválido' });
  }
  const { from, text, name, channel } = req.body || {};
  if (!from || !text) return res.status(400).json({ error: 'from y text son requeridos' });
  try {
    const result = await routeIncomingMessage(channel === 'instagram' ? 'instagram' : 'whatsapp', from, text, name);
    const state = store.getConversation(from);
    res.json({ reply: result.reply, status: state.status, collected: state.collected });
  } catch (e) {
    console.error('[simulate] error', e);
    res.status(500).json({ error: e.message });
  }
});

router.use(adminRouter);

module.exports = router;
