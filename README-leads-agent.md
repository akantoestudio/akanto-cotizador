# Agente Calificador de Leads — setup

Motor del agente descrito en `Brief_Tecnico_Agente_Leads_Akanto.docx`, implementado en
`leads-agent/`. Corre como parte de este mismo servidor (`server.js`) — no es un servicio aparte.

## Cómo funciona (resumen)

- `POST /webhook/whatsapp` recibe los mensajes de WhatsApp Business (Meta Cloud API).
  `POST /webhook/instagram` recibe los mensajes de Instagram Direct (mismo Meta App).
- Si el remitente es `MARIA_JOSE_WHATSAPP_NUMBER` (solo aplica al canal WhatsApp) →
  `leads-agent/reschedule.js` maneja su respuesta (confirmar / reagendar) sin pasar por Claude.
- Si no → `leads-agent/agent.js` llama a Claude con el system prompt de `systemPrompt.js` y las
  tools de `tools.js` para calificar al lead y, cuando ya tiene los datos, agendar la llamada
  (Google Calendar), registrar la fila (Google Sheets) y notificar a María José (siempre por
  WhatsApp, sin importar de qué canal venga el lead).
- El estado de cada conversación se guarda en `data/leads/<identificador>.json` (número de
  WhatsApp o IGSID de Instagram — mismo patrón que `data/fichas` y `data/cotizaciones`,
  persistente en el volumen de Railway). Cada archivo guarda un campo `channel`
  (`whatsapp` | `instagram`) que determina por dónde se le responde al lead —
  `leads-agent/channels.js` centraliza ese despacho.

## Modo dry-run

Si falta cualquier credencial (WhatsApp, Google, o `ANTHROPIC_API_KEY`), el módulo
correspondiente loguea en consola en vez de llamar a la API real — así se puede levantar el
servidor y probar el motor de conversación sin tener todavía las cuentas configuradas.

## Probar sin WhatsApp real

Con el servidor corriendo localmente (`node server.js`) y `ANTHROPIC_API_KEY` seteado:

```bash
curl -X POST http://localhost:3000/leads-agent/simulate \
  -H 'Content-Type: application/json' \
  -H 'x-simulate-token: TU_LEADS_AGENT_SIMULATE_TOKEN' \
  -d '{"from": "573001112233", "text": "Hola, es para un consultorio", "name": "Dra. Ejemplo"}'
```

Cada llamada devuelve la respuesta del agente y el estado actual de esa conversación
(`status`, `collected`). Repite el `curl` con el mismo `from` para simular los siguientes
mensajes del mismo lead y ver cómo avanza el flujo (m², ciudad, disponibilidad, agendamiento).

## Panel de administración (respuesta manual humana)

Meta Business Suite **no** ofrece bandeja de chat nativa para números conectados solo por Cloud
API (esa función de bandeja compartida es de nivel API/empresarial, no del plan gratuito —
lo confirmamos probando en vivo). Por eso se construyó un panel propio simple:

- **URL**: `/leads-agent/admin` (ej. `https://cotizador.akantoestudio.co/leads-agent/admin`)
- Pide un token (`ADMIN_TOKEN`) para entrar.
- Lista todas las conversaciones (más recientes primero), con badge de estado.
- Al seleccionar una, muestra el hilo completo (lead en blanco, bot en negro, respuestas
  manuales en terracota) y un cuadro para escribir y enviar una respuesta real por WhatsApp.
- Si la conversación no estaba ya agendada/completada, enviar una respuesta manual la marca
  como `escalated` — el bot deja de responder automático a ese número hasta que se reactive
  manualmente (editando el JSON en `data/leads/`).
- Implementado en `leads-agent/admin.js` (rutas) y `public/leads-admin.html` (interfaz).

## Checklist — estado actual

- [x] **Verificación de negocio de Akanto Estudio en Meta Business Manager** — completa.
- [x] **Número de WhatsApp dedicado al agente** — se creó un número nuevo (no el que ya usaba
      la oficina activamente), registrado vía Meta for Developers → WhatsApp → Configuración de
      la API → Paso 2. Su Phone Number ID está en `WHATSAPP_PHONE_NUMBER_ID`.
- [x] **Cuenta de Google Calendar/Sheets** — cuenta de servicio configurada, Calendar y Sheet
      compartidos con su email, IDs en `GOOGLE_CALENDAR_ID` / `GOOGLE_SHEET_ID`.
- [x] **Hosting del servidor/webhook** — este mismo `akanto-app` en Railway, webhook apuntando a
      `https://<dominio-railway>/webhook/whatsapp`.

### Notas para si se agrega otro número de WhatsApp en el futuro

Cada número (o más precisamente cada WhatsApp Business Account / WABA) tiene que quedar
**suscrito a esta app** para que los webhooks lleguen — no basta con registrarlo:

```bash
curl -X POST "https://graph.facebook.com/v20.0/<WABA_ID>/subscribed_apps" \
  -H "Authorization: Bearer <WHATSAPP_ACCESS_TOKEN>"
```

Verifica con un `GET` a la misma URL que devuelva el nombre de esta app ("Akanto Leads Agent")
en la lista.

## Instagram Direct

Segundo canal, implementado en `leads-agent/instagram.js`. Reusa el mismo `META_APP_SECRET`
para verificar la firma del webhook (misma app de Meta que WhatsApp).

**Setup:**
1. La cuenta de Instagram (@akanto.estudio) debe estar vinculada a una Página de Facebook
   dentro del mismo Business Manager.
2. En Meta for Developers → esta app → agregar el producto de **Instagram** (o Messenger, según
   cómo lo presente la interfaz) → conectar la Página/cuenta de Instagram.
3. Configurar el webhook de ese producto con Callback URL
   `https://<dominio>/webhook/instagram` y el `INSTAGRAM_VERIFY_TOKEN` elegido.
4. Suscribir la Página al campo `messages` (equivalente al paso de "Suscribir webhooks" que se
   hizo para WhatsApp).
5. Conseguir `INSTAGRAM_ACCESS_TOKEN` (token con permiso `instagram_manage_messages`) e
   `INSTAGRAM_ACCOUNT_ID` (el ID que acepta la Graph API en `/​<ID>/messages` — probar en vivo
   cuál ID es el correcto: el de la cuenta profesional de Instagram o el de la Página).

**Probar en dry-run** (sin credenciales de Instagram configuradas):

```bash
curl -X POST http://localhost:3000/leads-agent/simulate \
  -H 'Content-Type: application/json' \
  -H 'x-simulate-token: TU_LEADS_AGENT_SIMULATE_TOKEN' \
  -d '{"from": "9988776655", "text": "Hola", "channel": "instagram"}'
```

## Variables de entorno

Ver `.env.example` para la lista completa. En Railway se configuran en el dashboard del
proyecto (Variables), no como archivo `.env`.
