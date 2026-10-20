const express = require('express');
const manychat = require('./manychat');
const channels = require('./channels');
const agent = require('./agent');
const reschedule = require('./reschedule');
const store = require('./store');
const adminRouter = require('./admin');
const reminders = require('./reminders');
const mediaAck = require('./mediaAck');

const router = express.Router();

if (!process.env.LEADS_AGENT_SIMULATE_TOKEN) {
  console.warn('[leads-agent] LEADS_AGENT_SIMULATE_TOKEN no configurado — /leads-agent/simulate queda sin protección.');
}
if (!process.env.ADMIN_TOKEN) {
  console.warn('[leads-agent] ADMIN_TOKEN no configurado — /leads-agent/admin queda sin protección.');
}

reminders.start();

// Números autorizados para responder al flujo determinístico de confirmar/reagendar (María
// José y, como respaldo, el dueño del estudio) — cualquiera de los dos puede confirmar u
// ofrecer una franja en nombre de ella si el otro no alcanza a contestar.
function esRemitenteAutorizado(from) {
  const autorizados = [process.env.MARIA_JOSE_WHATSAPP_NUMBER, process.env.NOTIFY_BACKUP_NUMBER].filter(Boolean);
  return autorizados.some((id) => store.sanitizePhone(from) === store.sanitizePhone(id));
}

async function routeIncomingMessage(channel, from, text, name) {
  if (channel !== 'instagram' && esRemitenteAutorizado(from)) {
    const reply = await reschedule.handleMariaJoseMessage(text);
    if (reply) await channels.notifyMariaJose(reply);
    return { reply };
  }
  const { reply } = await agent.handleIncomingLeadMessage(from, text, name, channel);
  if (reply) await channels.sendToLead(store.getConversation(from, channel), reply);
  return { reply };
}

// Punto único de entrada para un mensaje entrante ya parseado (lo comparten el webhook real y
// /leads-agent/simulate, para que ambos apliquen el mismo filtrado de reacciones/archivos).
async function procesarIncoming(incoming) {
  if (manychat.esSoloReaccion(incoming.text)) {
    // Es una reacción (👏, ❤️, 👍...), no un mensaje real — la ignoramos por completo.
    console.log(`[leads-agent] ignorando reacción de ${incoming.from} (${incoming.channel}): "${incoming.text}"`);
    return { reply: null };
  }

  if (incoming.contactoReal) {
    // Guardado apenas llega, antes de procesar el mensaje — así ya está disponible si esta
    // misma conversación termina en agendamiento en este turno.
    const state = store.getConversation(incoming.from, incoming.channel);
    state.contactoReal = incoming.contactoReal;
    store.saveConversation(incoming.from, state);
  }

  if (manychat.esArchivoMultimedia(incoming.text)) {
    // Es una imagen o archivo (ver mediaAck.js) — lo guardamos en el historial para que Claude
    // tenga el contexto después, pero no respondemos de inmediato. Si llegan varios seguidos,
    // esperamos a que pare el envío y mandamos un solo aviso agrupado en vez de repetir el
    // mismo mensaje por cada uno.
    store.appendMessage(incoming.from, 'user', incoming.text, incoming.channel);
    mediaAck.registrarArchivo(incoming.from, incoming.channel);
    return { reply: null };
  }
  mediaAck.cancelarPendiente(incoming.from);

  return routeIncomingMessage(incoming.channel, incoming.from, incoming.text, incoming.name);
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
    const result = await procesarIncoming(incoming);
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
    const incoming = { from: String(from), text, name: name || null, channel: channel === 'instagram' ? 'instagram' : 'whatsapp', contactoReal: null };
    const result = await procesarIncoming(incoming);
    const state = store.getConversation(from);
    res.json({ reply: result.reply, status: state.status, collected: state.collected });
  } catch (e) {
    console.error('[simulate] error', e);
    res.status(500).json({ error: e.message });
  }
});

router.use(adminRouter);

module.exports = router;
