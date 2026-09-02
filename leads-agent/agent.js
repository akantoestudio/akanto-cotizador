const Anthropic = require('@anthropic-ai/sdk');
const { buildSystemPrompt } = require('./systemPrompt');
const { toolDefinitions, toolHandlers } = require('./tools');
const store = require('./store');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MAX_TOOL_ITERATIONS = 4;

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function toAnthropicMessages(messages) {
  // 'human' = mensaje manual enviado desde el panel de administración — Claude lo ve como un
  // turno más del negocio (assistant), igual que sus propias respuestas.
  return messages.map((m) => ({ role: m.role === 'human' ? 'assistant' : m.role, content: m.content }));
}

// Procesa un mensaje entrante de un lead: actualiza el historial, llama a Claude con las
// tools de calificación/agendamiento, ejecuta las tools que el modelo invoque, y devuelve el
// texto final que hay que enviarle de vuelta (o null si la conversación ya fue escalada).
async function handleIncomingLeadMessage(phone, text, leadName, channel = 'whatsapp') {
  const current = store.getConversation(phone, channel);

  if (current.status === 'escalated') {
    store.appendMessage(phone, 'user', text, channel);
    return { reply: null, state: store.getConversation(phone) };
  }

  store.appendMessage(phone, 'user', text, channel);

  if (!process.env.ANTHROPIC_API_KEY) {
    const reply = '[dry-run] ANTHROPIC_API_KEY no configurada — no se puede generar una respuesta real.';
    console.log(`[agent:dry-run] ${reply}`);
    return { reply, state: store.getConversation(phone) };
  }

  const client = getClient();
  // Si no tenemos guardado el teléfono/@usuario real del lead (más allá del ID interno de
  // ManyChat), Claude debe pedirlo apenas se agende — sin importar el canal.
  const system = buildSystemPrompt({ leadName, channel, faltaContacto: !current.contactoReal });
  const messages = toAnthropicMessages(store.getConversation(phone).messages);
  let finalText = null;

  for (let i = 0; i < MAX_TOOL_ITERATIONS && finalText === null; i++) {
    const response = await client.messages.create({
      model: MODEL,
      // 512 se quedaba corto y truncaba la respuesta a mitad del razonamiento interno
      // (extended thinking) en mensajes que requieren más cálculo, ej. fechas relativas
      // ("el lunes en 15 días") — el modelo se quedaba sin espacio antes de responder.
      max_tokens: 2048,
      system,
      tools: toolDefinitions,
      messages,
    });

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    const textBlocks = response.content.filter((b) => b.type === 'text').map((b) => b.text);

    if (toolUses.length === 0) {
      finalText = textBlocks.join('\n').trim();
      break;
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const toolUse of toolUses) {
      const handler = toolHandlers[toolUse.name];
      let result;
      try {
        result = handler ? await handler(toolUse.input, { phone, leadName }) : { error: 'tool desconocida' };
      } catch (e) {
        console.error(`[agent] error ejecutando tool ${toolUse.name}`, e);
        result = { error: e.message };
      }
      toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  if (!finalText) {
    // Cubre tanto null (se agotaron los intentos) como "" (Claude a veces devuelve un turno
    // final sin texto, ej. justo después de invocar una tool sin nada más que agregar).
    finalText = 'Gracias por la información — dame un momento y seguimos.';
  }
  store.appendMessage(phone, 'assistant', finalText);

  return { reply: finalText, state: store.getConversation(phone) };
}

module.exports = { handleIncomingLeadMessage };
