const SHEET_NAME = 'Restaurants';
const HEADERS = [
  'id', 'brandId', 'name', 'branch', 'address', 'district', 'mainGroup',
  'foodTypes', 'cuisines', 'desserts', 'drinks', 'status', 'note', 'source'
];
const ARRAY_FIELDS = new Set(['foodTypes', 'cuisines', 'desserts', 'drinks']);

/**
 * CHẠY HÀM NÀY 1 LẦN trong Apps Script editor.
 * Nó ghi nhớ ID của Google Sheet và tạo tab Restaurants nếu cần.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Hãy mở Apps Script từ chính Google Sheet database.');

  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else {
    const current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    if (current.join('|') !== HEADERS.join('|')) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }
  }
  sheet.setFrozenRows(1);
}

function doGet(e) {
  try {
    const data = readAll_();
    const payload = { ok: true, data: data, updatedAt: new Date().toISOString() };
    return output_(payload, e && e.parameter && e.parameter.prefix);
  } catch (error) {
    return output_({ ok: false, error: String(error.message || error), data: [] }, e && e.parameter && e.parameter.prefix);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checkAdminToken_(body.token);

    let result;
    switch (body.action) {
      case 'upsert':
        result = upsert_(body.item || {});
        break;
      case 'delete':
        result = delete_(body.id);
        break;
      case 'replaceAll':
        result = replaceAll_(Array.isArray(body.items) ? body.items : []);
        break;
      default:
        throw new Error('Action không hợp lệ.');
    }
    return output_({ ok: true, result: result });
  } catch (error) {
    return output_({ ok: false, error: String(error.message || error) });
  } finally {
    lock.releaseLock();
  }
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Chưa chạy setupDatabase().');
  return SpreadsheetApp.openById(id);
}

function getSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sheet;
}

function readAll_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return values
    .filter(row => String(row[2] || '').trim() !== '')
    .map(row => rowToObject_(row));
}

function rowToObject_(row) {
  const obj = {};
  HEADERS.forEach((key, index) => {
    const value = row[index] == null ? '' : row[index];
    obj[key] = ARRAY_FIELDS.has(key)
      ? String(value).split(/[;,]/).map(x => x.trim()).filter(Boolean)
      : value;
  });
  return obj;
}

function objectToRow_(item) {
  return HEADERS.map(key => {
    let value = item[key];
    if (ARRAY_FIELDS.has(key)) {
      if (Array.isArray(value)) return value.join('; ');
      return value || '';
    }
    return value == null ? '' : value;
  });
}

function upsert_(item) {
  if (!String(item.name || '').trim()) throw new Error('Thiếu tên quán.');
  if (!item.id) item.id = new Date().getTime();
  if (!item.brandId) item.brandId = slug_(item.name);

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  let targetRow = -1;

  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    const index = ids.findIndex(id => String(id) === String(item.id));
    if (index >= 0) targetRow = index + 2;
  }

  const row = objectToRow_(item);
  if (targetRow >= 2) sheet.getRange(targetRow, 1, 1, HEADERS.length).setValues([row]);
  else sheet.appendRow(row);

  return { id: item.id, row: targetRow >= 2 ? targetRow : sheet.getLastRow() };
}

function delete_(id) {
  if (id == null || id === '') throw new Error('Thiếu id cần xóa.');
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { deleted: false };

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const index = ids.findIndex(value => String(value) === String(id));
  if (index < 0) return { deleted: false };

  sheet.deleteRow(index + 2);
  return { deleted: true };
}

function replaceAll_(items) {
  const sheet = getSheet_();
  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  if (items.length) {
    const rows = items
      .filter(item => String(item.name || '').trim())
      .map(item => {
        if (!item.id) item.id = new Date().getTime() + Math.floor(Math.random() * 100000);
        if (!item.brandId) item.brandId = slug_(item.name);
        return objectToRow_(item);
      });
    if (rows.length) sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  return { count: items.length };
}

function checkAdminToken_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  if (!expected) throw new Error('Chưa cấu hình ADMIN_TOKEN trong Script Properties.');
  if (String(provided || '') !== String(expected)) throw new Error('ADMIN_TOKEN không đúng.');
}

function slug_(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'restaurant';
}

function output_(payload, prefix) {
  const json = JSON.stringify(payload);
  if (prefix) {
    const safePrefix = String(prefix).replace(/[^a-zA-Z0-9_$\.]/g, '');
    return ContentService.createTextOutput(`${safePrefix}(${json})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
