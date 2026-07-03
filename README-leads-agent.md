# Agente Calificador de Leads — setup

Motor del agente descrito en `Brief_Tecnico_Agente_Leads_Akanto.docx`, implementado en
`leads-agent/`. Corre como parte de este mismo servidor (`server.js`) — no es un servicio aparte.

## Cómo funciona (resumen)

- `POST /webhook/whatsapp` recibe los mensajes de WhatsApp Business (Meta Cloud API).
- Si el remitente es `MARIA_JOSE_WHATSAPP_NUMBER` → `leads-agent/reschedule.js` maneja su
  respuesta (confirmar / reagendar) sin pasar por Claude.
- Si no → `leads-agent/agent.js` llama a Claude con el system prompt de `systemPrompt.js` y las
  tools de `tools.js` para calificar al lead y, cuando ya tiene los datos, agendar la llamada
  (Google Calendar), registrar la fila (Google Sheets) y notificar a María José.
- El estado de cada conversación se guarda en `data/leads/<telefono>.json` (mismo patrón que
  `data/fichas` y `data/cotizaciones`, persistente en el volumen de Railway).

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

## Checklist antes de pasar a producción

Estos son los 4 pendientes que deja la sección 6 del brief — nada de esto se puede resolver
desde el código, son decisiones/configuración del negocio:

- [ ] **Verificación de negocio de Akanto Estudio en Meta Business Manager**, si aún no está
      hecha (requisito para usar la API oficial de WhatsApp Business).
- [ ] **Definir el número de WhatsApp** que va a hablar con los leads: ¿el mismo que usa hoy
      María José, o uno nuevo dedicado al agente? Ese número es el que se conecta a Meta Cloud
      API y se configura como `WHATSAPP_PHONE_NUMBER_ID`.
- [ ] **Cuenta de Google Calendar/Sheets a usar** (la de María José o una cuenta compartida de
      Akanto). Una vez decidida:
  1. Crear una cuenta de servicio en Google Cloud Console (IAM & Admin → Service Accounts),
     habilitar las APIs de Calendar y Sheets en el proyecto.
  2. Descargar la clave JSON de la cuenta de servicio y convertirla a base64
     (`base64 -i clave.json | tr -d '\n'`) → pegarla en `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64`.
  3. Desde la cuenta de Google elegida, **compartir el Calendar** con el email de la cuenta de
     servicio (permiso "Ver todos los detalles de eventos" como mínimo, "Hacer cambios en
     eventos" para que pueda crear/mover eventos).
  4. **Compartir la hoja de Google Sheets** con el mismo email de la cuenta de servicio (permiso
     Editor), y crear en ella una pestaña llamada `Leads` con encabezados: Nombre, Tipo de
     proyecto, m², Ciudad, Horario agendado, Contacto.
  5. Copiar el ID del calendario (`GOOGLE_CALENDAR_ID`, normalmente el email de la cuenta de
     Google si es el calendario principal) y el ID de la hoja (`GOOGLE_SHEET_ID`, de la URL de
     Sheets).
- [ ] **Definir dónde corre el servidor/webhook**. Ya está resuelto en la práctica: este mismo
      `akanto-app` ya está desplegado en Railway — solo falta apuntar la URL del webhook de Meta
      a `https://<tu-dominio-railway>/webhook/whatsapp` y setear las variables de entorno en
      Railway (ver `.env.example`).

## Variables de entorno

Ver `.env.example` para la lista completa. En Railway se configuran en el dashboard del
proyecto (Variables), no como archivo `.env`.
