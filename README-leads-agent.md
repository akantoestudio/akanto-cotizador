# Agente Calificador de Leads — setup

Motor del agente descrito en `Brief_Tecnico_Agente_Leads_Akanto.docx`, implementado en
`leads-agent/`. Corre como parte de este mismo servidor (`server.js`) — no es un servicio aparte.

## Cómo funciona (resumen)

- `POST /webhook/manychat` recibe los mensajes de **WhatsApp e Instagram**, ambos vía ManyChat
  (ver sección "WhatsApp e Instagram vía ManyChat" más abajo) — no se usa la Graph API de Meta
  directamente para ninguno de los dos canales.
- Si el remitente es `MARIA_JOSE_WHATSAPP_NUMBER` → `leads-agent/reschedule.js` maneja su
  respuesta (confirmar / reagendar) sin pasar por Claude.
- Si no → `leads-agent/agent.js` llama a Claude con el system prompt de `systemPrompt.js` y las
  tools de `tools.js` para calificar al lead y, cuando ya tiene los datos, agendar la llamada
  (Google Calendar), registrar la fila (Google Sheets) y notificar a María José (siempre por
  WhatsApp, sin importar de qué canal venga el lead).
- El estado de cada conversación se guarda en `data/leads/<identificador>.json` (ID de
  suscriptor de ManyChat — mismo patrón que `data/fichas` y `data/cotizaciones`, persistente en
  el volumen de Railway). Cada archivo guarda un campo `channel` (`whatsapp` | `instagram`) que
  determina por dónde se le responde al lead — `leads-agent/channels.js` centraliza ese
  despacho, y `leads-agent/manychat.js` es el único cliente de envío/recepción real.

## Modo dry-run

Si falta cualquier credencial (`MANYCHAT_API_KEY`, Google, o `ANTHROPIC_API_KEY`), el módulo
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
- [x] **Número de WhatsApp real de la oficina conectado directo a ManyChat** (+57 310 3960729)
      — no pasa por nuestra propia app de Meta, ver sección de abajo.
- [x] **Cuenta de Google Calendar/Sheets** — cuenta de servicio configurada, Calendar y Sheet
      compartidos con su email, IDs en `GOOGLE_CALENDAR_ID` / `GOOGLE_SHEET_ID`.
- [x] **Hosting del servidor/webhook** — este mismo `akanto-app` en Railway, webhook apuntando a
      `https://<dominio-railway>/webhook/manychat`.

## WhatsApp e Instagram vía ManyChat

Los dos canales están implementados en `leads-agent/manychat.js`. Se probó primero con la
Graph API de Meta directamente para ambos (`instagram_business_manage_messages` y la
integración nativa de WhatsApp Cloud API que existió en `leads-agent/whatsapp.js`), pero:
- Instagram: Meta exige revisión formal (App Review) para esa mensajería incluso en modo
  Desarrollo — tras varios intentos de revisión rechazados, se descartó.
- WhatsApp: funcionaba bien de forma nativa, pero se migró también a ManyChat para tener todo
  en una sola bandeja y poder reutilizar el mismo número real de la oficina sin necesitar un
  segundo número dedicado solo para el bot (ManyChat permite pausar la automatización por
  conversación y responder manualmente, resolviendo el problema original de "bot + humano en el
  mismo número").

Se optó por **ManyChat** como capa de transporte para ambos: ManyChat ya tiene su propia app de
Meta aprobada, así que conectar las cuentas ahí es solo autorización normal, sin pasar por
revisión.

**Cómo funciona**: ManyChat recibe el mensaje real (DM de Instagram o WhatsApp) y lo reenvía
por webhook a `POST /webhook/manychat`, que corre la misma lógica (`agent.handleIncomingLeadMessage`)
sin importar el canal. La respuesta se envía de vuelta al lead llamando a la API de envío de
ManyChat (`leads-agent/manychat.js`), no a la Graph API de Meta.

**Setup (repetir por cada canal — Instagram y WhatsApp):**
1. Cuenta/número conectado a ManyChat (autorización simple, sin App Review). Para WhatsApp, si
   el número ya está registrado en una app de Meta propia, hay que **desregistrarlo** primero
   (`POST /{phone_number_id}/deregister` con el token de esa app) para que ManyChat pueda
   reclamarlo — es reversible, no borra el número ni su historial.
2. Automatización → **"[Canal] Default Reply"** (Respuesta predeterminada — dispara con
   cualquier mensaje entrante, no solo palabras clave; confirmar que el disparador esté
   **habilitado**, no "Deshabilitado", y en modo **"every time"**, no "once per 24 hours") →
   acción **"Solicitud externa"**:
   - URL: `https://<dominio>/webhook/manychat`
   - Método: POST
   - Header: `x-manychat-token` = mismo valor que `MANYCHAT_WEBHOOK_SECRET`
   - Cuerpo (pastillas de campo dinámico pegadas directo a las comillas, sin `<<` `>>` sueltos):
     ```json
     { "subscriber_id": "[Id de contacto]", "text": "[Última entrada de texto]", "name": "[Nombre]", "channel": "whatsapp" }
     ```
     El campo `"channel"` va como texto **literal** (`"whatsapp"` o se omite/se pone `"instagram"`
     para ese canal) — así el backend sabe por dónde responder.
3. `MANYCHAT_API_KEY` se genera en ManyChat → Configuración → Extensiones → API — se usa para
   que el backend pueda enviarle mensajes al lead de vuelta. Un usuario del sistema puede
   necesitar que se le asignen explícitamente los activos (Página/WhatsApp/Instagram) desde
   **Usuarios del sistema → [usuario] → Asignar activos**, no solo desde la pestaña "Personas"
   de la cuenta — son mecanismos distintos.
4. Publicar el flujo ("Publicar en Vivo") en ManyChat.

**Probar en dry-run** (sin `MANYCHAT_API_KEY` configurado, solo loguea en consola):

```bash
curl -X POST http://localhost:3000/leads-agent/simulate \
  -H 'Content-Type: application/json' \
  -H 'x-simulate-token: TU_LEADS_AGENT_SIMULATE_TOKEN' \
  -d '{"from": "9988776655", "text": "Hola", "channel": "instagram"}'
```

## Variables de entorno

Ver `.env.example` para la lista completa. En Railway se configuran en el dashboard del
proyecto (Variables), no como archivo `.env`.
