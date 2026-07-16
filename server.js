const path    = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const fs      = require('fs');
const os      = require('os');

const app      = express();
const PORT     = process.env.PORT || 3000;
const DATA       = path.join(__dirname, 'data', 'catalogo.json');
const FICHAS_DIR = path.join(__dirname, 'data', 'fichas');
const COT_DIR    = path.join(__dirname, 'data', 'cotizaciones');
if (!fs.existsSync(FICHAS_DIR)) fs.mkdirSync(FICHAS_DIR, { recursive: true });
if (!fs.existsSync(COT_DIR))    fs.mkdirSync(COT_DIR,    { recursive: true });

function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

// Redirigir HTTP → HTTPS en producción (Railway pone x-forwarded-proto)
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  // HSTS: fuerza HTTPS en el navegador durante 1 año
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(require('./leads-agent'));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/catalogo', (req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(DATA, 'utf8')));
  } catch (e) {
    res.status(500).json({ error: 'No se pudo leer el catálogo' });
  }
});

app.post('/api/catalogo', (req, res) => {
  try {
    if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Formato inválido' });
    fs.writeFileSync(DATA, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo guardar' });
  }
});

/* ── COTIZACIONES (guardado en servidor, acceso multi-dispositivo) ── */
app.get('/api/cotizaciones', (req, res) => {
  try {
    const files = fs.readdirSync(COT_DIR).filter(f => f.endsWith('.json'));
    const index = files.map(f => {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(COT_DIR, f), 'utf8'));
        return {
          key:     f.replace('.json', ''),
          num:     d.cotizacion?.num    || '—',
          cliente: d.cliente?.nombre   || '(sin cliente)',
          proyecto:d.proyecto?.nombre  || '',
          savedAt: d.savedAt           || '',
        };
      } catch { return null; }
    }).filter(Boolean).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    res.json(index);
  } catch (e) { res.status(500).json({ error: 'Error al listar cotizaciones' }); }
});

app.get('/api/cotizaciones/:key', (req, res) => {
  try {
    const file = path.join(COT_DIR, req.params.key + '.json');
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'No encontrada' });
    res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (e) { res.status(500).json({ error: 'Error al leer cotización' }); }
});

app.post('/api/cotizaciones', (req, res) => {
  try {
    const state = req.body;
    if (!state || typeof state !== 'object') return res.status(400).json({ error: 'Datos inválidos' });
    const ts  = Date.now();
    const num = (state.cotizacion?.num || 'sin-num').replace(/[^a-zA-Z0-9-]/g, '-');
    const key = `cot-${num}-${ts}`;
    state.savedAt = new Date().toISOString();
    fs.writeFileSync(path.join(COT_DIR, key + '.json'), JSON.stringify(state, null, 2));
    res.json({ ok: true, key });
  } catch (e) { res.status(500).json({ error: 'Error al guardar cotización' }); }
});

app.put('/api/cotizaciones/:key', (req, res) => {
  try {
    const state = req.body;
    if (!state || typeof state !== 'object') return res.status(400).json({ error: 'Datos inválidos' });
    const file = path.join(COT_DIR, req.params.key + '.json');
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'No encontrada' });
    state.savedAt = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(state, null, 2));
    res.json({ ok: true, key: req.params.key });
  } catch (e) { res.status(500).json({ error: 'Error al actualizar cotización' }); }
});

app.delete('/api/cotizaciones/:key', (req, res) => {
  try {
    const file = path.join(COT_DIR, req.params.key + '.json');
    if (fs.existsSync(file)) fs.unlinkSync(file);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error al eliminar cotización' }); }
});

/* ── FICHAS DE REQUERIMIENTOS ── */
app.get('/api/fichas', (req, res) => {
  try {
    const files = fs.readdirSync(FICHAS_DIR).filter(f => f.endsWith('.json'));
    const index = files.map(f => {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(FICHAS_DIR, f), 'utf8'));
        return { id: f.replace('.json',''), nombre: d.proyecto?.nombre || 'Sin nombre', cliente: d.cliente?.nombre || '—', fecha: d.fecha || '', savedAt: d.savedAt || '' };
      } catch { return null; }
    }).filter(Boolean).sort((a,b) => (b.savedAt||'').localeCompare(a.savedAt||''));
    res.json(index);
  } catch (e) { res.status(500).json({ error: 'Error al listar fichas' }); }
});

app.get('/api/fichas/:id', (req, res) => {
  try {
    const file = path.join(FICHAS_DIR, req.params.id + '.json');
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'No encontrada' });
    res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (e) { res.status(500).json({ error: 'Error al leer ficha' }); }
});

app.post('/api/fichas', (req, res) => {
  try {
    const state = req.body;
    if (!state || typeof state !== 'object') return res.status(400).json({ error: 'Datos inválidos' });
    const id = state.id || ('ficha-' + Date.now());
    state.id = id;
    state.savedAt = new Date().toISOString();
    fs.writeFileSync(path.join(FICHAS_DIR, id + '.json'), JSON.stringify(state, null, 2));
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: 'Error al guardar ficha' }); }
});

app.delete('/api/fichas/:id', (req, res) => {
  try {
    const file = path.join(FICHAS_DIR, req.params.id + '.json');
    if (fs.existsSync(file)) fs.unlinkSync(file);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error al eliminar ficha' }); }
});

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\n  Akanto Cotizador`);
  console.log(`  ▸ Local:  http://localhost:${PORT}`);
  console.log(`  ▸ Red:    http://${ip}:${PORT}  ← comparte esta URL\n`);
});
