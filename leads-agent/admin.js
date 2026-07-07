const express = require('express');
const path = require('path');
const store = require('./store');
const whatsapp = require('./whatsapp');

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

router.post('/leads-agent/admin/api/conversations/:phone/reply', requireAdminToken, express.json(), async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text es requerido' });
  const phone = req.params.phone;
  try {
    await whatsapp.sendMessage(phone, text);
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
