const { google } = require('googleapis');

const SHEET_RANGE = 'Leads!A:G'; // Fecha | Nombre | Tipo de proyecto | m² | Ciudad | Horario agendado | Estado

function isConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 && process.env.GOOGLE_SHEET_ID);
}

function getAuth() {
  const json = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8');
  const credentials = JSON.parse(json);
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function appendLeadRow({ fecha, nombre, tipoProyecto, m2, ciudad, horario, estado }) {
  const row = [fecha, nombre, tipoProyecto, m2, ciudad, horario, estado];
  if (!isConfigured()) {
    console.log('[sheets:dry-run] fila de lead', row);
    return { dryRun: true };
  }
  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: SHEET_RANGE,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
  return res.data;
}

module.exports = { isConfigured, appendLeadRow };
