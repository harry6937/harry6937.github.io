const SPREADSHEET_ID = 'YOUR_SOURCE_SPREADSHEET_ID';
const HISTORY_SPREADSHEET_ID = 'YOUR_HISTORY_SPREADSHEET_ID';
const USAGE_SHEET_ID = 0;
const USAGE_HEADERS = ['Request ID','Used at (UTC)','Model ID','Model','IMEI 1','IMEI 2'];

function doGet(event) {
  const params = event && event.parameter || {};
  const channel = String(params.channel || '');
  const mode = params.mode === 'popup' ? 'popup' : 'bridge';
  const config = { origin:'https://harry6937.github.io', channel:/^[a-f0-9-]{36}$/.test(channel) ? channel : '', mode };
  const html = BRIDGE_HTML.replace('__BRIDGE_CONFIG__', JSON.stringify(config).replace(/</g,'\\u003c'));
  const output = HtmlService.createHtmlOutput(html).setTitle('M2 IMEI Desk · Google Sheets')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  // Only the non-interactive, origin-checked bridge may be embedded.
  // Deployment access remains MYSELF; no spreadsheet is made public.
  if (config.channel && mode === 'bridge') output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return output;
}

function parseImeis_(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 1e14 && value < 1e15 ? [String(value)] : [];
  if (typeof value !== 'string') return [];
  const text = value.trim();
  if (/^\d{15}$/.test(text)) return [text];
  if (/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text)) {
    const number = Number(text);
    return Number.isSafeInteger(number) && number >= 1e14 && number < 1e15 ? [String(number)] : [];
  }
  if (/^[\d \t-]+$/.test(text)) {
    const compact = text.replace(/[ \t-]/g, '');
    if (/^\d{15}$/.test(compact)) return [compact];
  }
  return Array.from(text.matchAll(/(?:^|[^0-9])([0-9]{15})(?![0-9])/g), match => match[1]);
}

function catalog_(grid) {
  const seen = new Set();
  let duplicates = 0, invalid = 0;
  grid.forEach((row, index) => row.forEach(cell => {
    if (cell === '' || cell == null) return;
    if (index === 0 && /^imei(?:\s*\d+|\s*\(optional\))?$/i.test(String(cell).trim())) return;
    const values = parseImeis_(cell);
    if (!values.length) invalid++;
    values.forEach(value => { if (seen.has(value)) duplicates++; else seen.add(value); });
  }));
  return { numbers: Array.from(seen), duplicates, invalid };
}

function book_() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function models_(book) { return book.getSheets().filter(s => !s.isSheetHidden()); }
function model_(book, id) {
  const model = models_(book).find(s => String(s.getSheetId()) === String(id));
  if (!model) throw new Error('This model no longer exists. Click Refresh.');
  return model;
}
function source_(sheet) {
  const rows = sheet.getLastRow();
  if (rows > 100000) throw new Error('This model exceeds 100,000 rows. Split it into smaller model sheets.');
  return catalog_(rows ? sheet.getRange(1, 1, rows, 1).getValues() : []);
}
function ledger_(book) {
  const sheet = SpreadsheetApp.openById(HISTORY_SPREADSHEET_ID).getSheetById(USAGE_SHEET_ID);
  if (!sheet || JSON.stringify(sheet.getRange(1,1,1,6).getDisplayValues()[0]) !== JSON.stringify(USAGE_HEADERS)) {
    throw new Error('Usage history is missing or changed. Restore the _Usage sheet before extracting IMEIs.');
  }
  const rowCount = sheet.getLastRow();
  const minimum = Number(PropertiesService.getScriptProperties().getProperty('usageRowCount') || 1);
  if (rowCount < minimum) throw new Error('Usage history was shortened. Restore it before extracting IMEIs.');
  const rows = rowCount > 1 ? sheet.getRange(2,1,rowCount-1,6).getDisplayValues() : [];
  const used = new Set();
  const requests = new Map();
  rows.forEach(row => {
    if (!row[0] || (row[4] && !/^\d{15}$/.test(row[4])) || (row[5] && !/^\d{15}$/.test(row[5]))) throw new Error('Usage history contains an invalid row. Restore it before extracting IMEIs.');
    if (requests.has(row[0])) throw new Error('Usage history contains a duplicate request ID. Restore it before extracting IMEIs.');
    requests.set(row[0], row);
    [row[4],row[5]].filter(Boolean).forEach(n => used.add(n));
  });
  return { sheet, rows, used, requests };
}
function stats_(sheet, used) {
  const data = source_(sheet);
  const remaining = data.numbers.filter(n => !used.has(n));
  return { id:String(sheet.getSheetId()), name:sheet.getName(), total:data.numbers.length,
    used:data.numbers.length-remaining.length, remaining:remaining.length,
    duplicates:data.duplicates, invalid:data.invalid };
}
function result_(row, sheet, used, recovered) {
  return { requestId:row[0], at:row[1], modelId:row[2], modelName:row[3],
    numbers:[row[4],row[5]].filter(Boolean), recovered:!!recovered, stats:stats_(sheet, used) };
}

function getDashboard() {
  const book = book_();
  const history = ledger_(book);
  return { sheetUrl:book.getUrl(), models:models_(book).map(sheet => stats_(sheet,history.used)), checkedAt:new Date().toISOString() };
}

function getModelState(modelId, requestId) {
  const book = book_(), sheet = model_(book,modelId), history = ledger_(book);
  const row = requestId ? history.requests.get(String(requestId)) : null;
  if (row && String(row[2]) !== String(modelId)) throw new Error('The saved request belongs to a different model.');
  return { stats:stats_(sheet,history.used), result:row ? result_(row,sheet,history.used,true) : null };
}

function extractPair(modelId, requestId) {
  if (!/^[a-zA-Z0-9-]{20,80}$/.test(String(requestId))) throw new Error('Invalid request ID. Refresh the page.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Another extraction is in progress. Retry this request.');
  try {
    const book = book_(), sheet = model_(book,modelId), history = ledger_(book);
    const previous = history.requests.get(String(requestId));
    if (previous) {
      if (String(previous[2]) !== String(modelId)) throw new Error('This request belongs to a different model.');
      return result_(previous,sheet,history.used,true);
    }
    const numbers = source_(sheet).numbers.filter(n => !history.used.has(n)).slice(0,2);
    const modelName = sheet.getName();
    const row = [String(requestId),new Date().toISOString(),String(sheet.getSheetId()),modelName,numbers[0]||'',numbers[1]||''];
    const nextRow = history.sheet.getLastRow()+1;
    if (nextRow > history.sheet.getMaxRows()) history.sheet.insertRowsAfter(history.sheet.getMaxRows(),1000);
    // One row commits the pair and its retry key together, before returning it.
    const safeRow = row.map(value => /^[=+@-]/.test(value) ? "'"+value : value);
    history.sheet.getRange(nextRow,1,1,6).setNumberFormat('@').setValues([safeRow]);
    SpreadsheetApp.flush();
    PropertiesService.getScriptProperties().setProperty('usageRowCount',String(nextRow));
    numbers.forEach(n => history.used.add(n));
    return result_(row,sheet,history.used,false);
  } finally { lock.releaseLock(); }
}

function verifyConnection() {
  const data = getDashboard();
  console.log(JSON.stringify({ models:data.models.map(m => ({name:m.name,remaining:m.remaining})), connected:true }));
  return data;
}
