const express = require('express');
const path = require('path');
const store = require('./store');
const channels = require('./channels');

const router = express.Router();

function requireAdminToken(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(503).json({ error: 'ADMIN_TOKEN no configurado en el servidor' });
  if (req.headers['x-admin-token'] !== token) return res.status(401).json({ error: 'token inválido' });
  next();
}

router.get('/leads-agent/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'leads-admin.html'));
});

router.get('/leads-agent/admin/api/conversations', requireAdminToken, (req, res) => {
  const conversations = store.listConversations().map((c) => ({
    phone: c.phone,
    channel: c.channel || 'whatsapp',
    status: c.status,
    nombre: c.collected?.nombre || null,
    lastMessage: c.messages?.[c.messages.length - 1] || null,
    updatedAt: c.updatedAt,
  }));
  res.json(conversations);
});

router.get('/leads-agent/admin/api/conversations/:phone', requireAdminToken, (req, res) => {
  res.json(store.getConversation(req.params.phone));
});

// KPIs calculados directo de nuestros propios datos de conversación (no depende de la
// analítica de ManyChat, que solo ve mensajes/plataforma, no el embudo de calificación).
router.get('/leads-agent/admin/api/report', requireAdminToken, (req, res) => {
  const conversations = store.listConversations();
  const total = conversations.length;

  const porCanal = {};
  const porEstado = {};
  const embudo = { escribieron: total, tipo_proyecto: 0, m2: 0, ciudad: 0, disponibilidad: 0, agendaron: 0 };

  for (const c of conversations) {
    const canal = c.channel || 'whatsapp';
    porCanal[canal] = (porCanal[canal] || 0) + 1;
    porEstado[c.status] = (porEstado[c.status] || 0) + 1;

    const datos = c.collected || {};
    if (datos.tipo_proyecto) embudo.tipo_proyecto++;
    if (datos.m2) embudo.m2++;
    if (datos.ciudad) embudo.ciudad++;
    if (datos.franjas_disponibilidad?.length) embudo.disponibilidad++;
    if (c.status === 'scheduled' || c.status === 'completed') embudo.agendaron++;
  }

  const conversaciones = conversations.map((c) => ({
    phone: c.phone,
    channel: c.channel || 'whatsapp',
    status: c.status,
    nombre: c.collected?.nombre || null,
    mensajes: c.messages?.length || 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  res.json({ total, porCanal, porEstado, embudo, conversaciones });
});

router.post('/leads-agent/admin/api/conversations/:phone/reply', requireAdminToken, express.json(), async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text es requerido' });
  const phone = req.params.phone;
  try {
    const existing = store.getConversation(phone);
    await channels.sendToLead(existing, text);
    const state = store.appendMessage(phone, 'human', text);
    if (state.status !== 'scheduled' && state.status !== 'completed') {
      state.status = 'escalated';
    }
    store.saveConversation(phone, state);
    res.json({ ok: true, state });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
