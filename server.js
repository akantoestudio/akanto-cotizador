const express = require('express');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');

const app      = express();
const PORT     = process.env.PORT || 3000;
const DATA     = path.join(__dirname, 'data', 'catalogo.json');

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
  next();
});

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

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\n  Akanto Cotizador`);
  console.log(`  ▸ Local:  http://localhost:${PORT}`);
  console.log(`  ▸ Red:    http://${ip}:${PORT}  ← comparte esta URL\n`);
});
