const store = require('./store');
const channels = require('./channels');

// Cuando WhatsApp/Instagram reenvían una imagen o archivo, ManyChat lo entrega como un link
// puro a su storage (ver manychat.esArchivoMultimedia) — si alguien manda varios seguidos (ej.
// fotos de referencia, un PDF página por página), antes respondíamos uno por uno con un mensaje
// casi idéntico cada vez ("¡Recibido! Todo listo para la llamada..."), lo que se sentía como un
// bot respondiendo en bucle. En vez de eso, esperamos a que pare el envío y mandamos un solo
// aviso agrupando todo lo recibido.
const VENTANA_SILENCIO_MS = Number(process.env.MEDIA_ACK_DEBOUNCE_MS) || 45 * 1000;

// phone (sanitizado) -> { timer, count, channel }
const pendientes = new Map();

function mensajeAck(state, count) {
  const archivos = count === 1 ? 'tu archivo' : `tus ${count} archivos`;
  if (state.status === 'scheduled' && state.scheduledEvent?.horario) {
    return `¡Recibido, gracias! Ya tenemos ${archivos} para revisar antes de la llamada (${state.scheduledEvent.horario}).`;
  }
  return `¡Recibido, gracias! Ya tenemos ${archivos} para revisar con la arquitecta María José.`;
}

async function enviarAck(phone) {
  const entry = pendientes.get(phone);
  if (!entry) return;
  pendientes.delete(phone);
  const state = store.getConversation(phone, entry.channel);
  const texto = mensajeAck(state, entry.count);
  try {
    await channels.sendToLead(state, texto);
    store.appendMessage(phone, 'assistant', texto, state.channel);
  } catch (e) {
    console.error('[mediaAck] error enviando confirmación agrupada', e);
  }
}

// Llamar cada vez que llega un archivo — reinicia la ventana de silencio y suma al conteo.
function registrarArchivo(phone, channel) {
  const key = store.sanitizePhone(phone);
  const existing = pendientes.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    existing.count += 1;
    existing.timer = setTimeout(() => enviarAck(key), VENTANA_SILENCIO_MS);
    return;
  }
  pendientes.set(key, {
    count: 1,
    channel,
    timer: setTimeout(() => enviarAck(key), VENTANA_SILENCIO_MS),
  });
}

// Si llega un mensaje de texto real justo después de varias imágenes, cancela el aviso
// agrupado pendiente — la respuesta normal del agente a ese mensaje ya cierra el ciclo, no
// hace falta un segundo mensaje aparte confirmando los archivos.
function cancelarPendiente(phone) {
  const key = store.sanitizePhone(phone);
  const existing = pendientes.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    pendientes.delete(key);
  }
}

module.exports = { registrarArchivo, cancelarPendiente };
