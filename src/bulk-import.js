// ════════════════════════════════════════════════════════════
//  BULK-IMPORT.JS
//  Bulk upload for Stock & Inventory and Doctor Registry
//
//  Supported formats:
//  ✅ .xlsx / .xls  — Excel (most common for clinic staff)
//  ✅ .csv          — Comma-separated values (universal)
//  ✅ .json         — JSON array (developer / API export)
//  ✅ .tsv          — Tab-separated (some EMR/HIS exports)
//
//  Permission guard:
//  Both features require can.accessAdminPanel() → superadmin / admin only
//
//  Load order: after script-doctors.js, features-analytics.js
//  SheetJS CDN required for Excel: add to index.html before this file:
//  <script src="https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js"></script>
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
//  SHARED FILE PARSING ENGINE
// ════════════════════════════════════════════════════════════

/**
 * Parse any supported file into an array of plain objects.
 * Keys are normalised to lowercase_underscore.
 */
async function bulkParseFile(file) {
  var ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'json')         return bulkParseJSON(await bulkReadText(file));
  if (ext === 'csv')          return bulkParseDelimited(await bulkReadText(file), ',');
  if (ext === 'tsv')          return bulkParseDelimited(await bulkReadText(file), '\t');
  if (ext === 'xlsx' || ext === 'xls') return bulkParseExcel(await bulkReadBuffer(file));
  throw new Error('Unsupported file type: .' + ext + '. Use .xlsx, .xls, .csv, .tsv or .json');
}

function bulkReadText(file) {
  return new Promise(function(res, rej) {
    var r = new FileReader();
    r.onload  = function(e){ res(e.target.result); };
    r.onerror = function()  { rej(new Error('Could not read file')); };
    r.readAsText(file);
  });
}
function bulkReadBuffer(file) {
  return new Promise(function(res, rej) {
    var r = new FileReader();
    r.onload  = function(e){ res(e.target.result); };
    r.onerror = function()  { rej(new Error('Could not read file')); };
    r.readAsArrayBuffer(file);
  });
}

function bulkParseJSON(text) {
  var data = JSON.parse(text.trim());
  if (Array.isArray(data)) return data;
  // Support { items:[...] } or { doctors:[...] } wrappers
  var keys = Object.keys(data);
  for (var i = 0; i < keys.length; i++) {
    if (Array.isArray(data[keys[i]])) return data[keys[i]];
  }
  throw new Error('JSON must be an array, or an object with a single array property.');
}

function bulkParseDelimited(text, sep) {
  var lines = text.split(/\r?\n/).filter(function(l){ return l.trim(); });
  if (lines.length < 2) throw new Error('File needs a header row and at least one data row.');
  var headers = bulkSplitLine(lines[0], sep).map(function(h){
    return h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  });
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var cells = bulkSplitLine(lines[i], sep);
    if (cells.every(function(c){ return !c.trim(); })) continue;
    var obj = {};
    headers.forEach(function(h, idx){ obj[h] = (cells[idx] || '').trim(); });
    rows.push(obj);
  }
  return rows;
}

function bulkSplitLine(line, sep) {
  var result = [], current = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      if (inQ && line[i+1] === '"') { current += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === sep && !inQ) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function bulkParseExcel(buffer) {
  if (typeof XLSX === 'undefined') {
    throw new Error('SheetJS not loaded. Add this to index.html before bulk-import.js:\n<script src="https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js"><\/script>');
  }
  var wb   = XLSX.read(buffer, { type: 'array' });
  var ws   = wb.Sheets[wb.SheetNames[0]];
  var data = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return data.map(function(row) {
    var obj = {};
    Object.keys(row).forEach(function(k) {
      var clean = k.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      obj[clean] = row[k];
    });
    return obj;
  });
}

// ─── Shared utilities ────────────────────────────────────────
function bulkParseExpiry(val) {
  if (!val) return null;
  var s = String(val).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    var y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
  }
  if (/^\d{5}$/.test(s)) {           // Excel date serial
    var d = new Date((parseInt(s) - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  return null;
}

function bulkDownloadText(content, filename, mime) {
  var blob = new Blob([content], { type: mime });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function bulkFormatBadge(icon, ext, type, color) {
  return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:10px;text-align:center">' +
    '<div style="font-size:20px;margin-bottom:4px">' + icon + '</div>' +
    '<div style="font-size:12px;font-weight:700;color:' + color + '">' + ext + '</div>' +
    '<div style="font-size:10px;color:var(--text-muted)">' + type + '</div>' +
  '</div>';
}

// ════════════════════════════════════════════════════════════
//  MODULE 1: STOCK BULK IMPORT
// ════════════════════════════════════════════════════════════

var _stockImportRows = [];

function openStockImport() {
  // Permission check — admin panel access required
  if (typeof can !== 'undefined' && !can.accessAdminPanel()) {
    showToast('⛔ Admin or SuperAdmin access required to import stock.', 'error');
    return;
  }

  var overlay = document.getElementById('stockImportOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'stockImportOverlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML =
    '<div class="modal" style="max-width:640px">' +
      '<div class="modal-header">' +
        '<div><div class="modal-title">📥 Import Stock / Inventory</div>' +
          '<div class="modal-subtitle">Bulk-update inventory via Excel, CSV, JSON or TSV</div></div>' +
        '<button class="modal-close" onclick="closeOverlay(\'stockImportOverlay\')">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +

        // Supported formats
        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:16px">' +
          '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:10px">📋 Supported Formats</div>' +
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">' +
            bulkFormatBadge('📊', '.xlsx / .xls', 'Excel', 'var(--teal)') +
            bulkFormatBadge('📄', '.csv', 'CSV', 'var(--allopathy)') +
            bulkFormatBadge('🔧', '.json', 'JSON', 'var(--homeopathy)') +
            bulkFormatBadge('📑', '.tsv', 'TSV', 'var(--ayurveda)') +
          '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);line-height:1.7">' +
            '<strong>Required:</strong> <code>name</code>, <code>quantity</code><br>' +
            '<strong>Optional:</strong> <code>category</code>, <code>unit</code>, <code>min_quantity</code>, <code>unit_price</code>, <code>batch_no</code>, <code>expiry_date</code>' +
          '</div>' +
        '</div>' +

        // Template downloads
        '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">' +
          '<span style="font-size:12px;color:var(--text-muted);align-self:center">Download template:</span>' +
          '<button onclick="downloadStockTemplate(\'csv\')"  class="btn-sm btn-outline-teal" style="font-size:12px">⬇️ CSV</button>' +
          '<button onclick="downloadStockTemplate(\'json\')" class="btn-sm btn-outline-teal" style="font-size:12px">⬇️ JSON</button>' +
          '<button onclick="downloadStockTemplate(\'xlsx\')" class="btn-sm btn-outline-teal" style="font-size:12px">⬇️ Excel</button>' +
        '</div>' +

        // Conflict resolution
        '<div class="field" style="margin-bottom:14px">' +
          '<label>When item already exists in inventory:</label>' +
          '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">' +
            '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:7px 12px;border:1px solid var(--border);border-radius:var(--radius)">' +
              '<input type="radio" name="stkConflict" value="update" checked> ✏️ Update details</label>' +
            '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:7px 12px;border:1px solid var(--border);border-radius:var(--radius)">' +
              '<input type="radio" name="stkConflict" value="skip"> ⏭️ Skip duplicates</label>' +
            '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:7px 12px;border:1px solid var(--border);border-radius:var(--radius)">' +
              '<input type="radio" name="stkConflict" value="add"> ➕ Add to existing qty</label>' +
          '</div>' +
        '</div>' +

        // Drop zone
        '<div id="stkDropZone" ' +
          'style="border:2px dashed var(--border2);border-radius:var(--radius-lg);padding:28px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:12px"' +
          ' onclick="document.getElementById(\'stkFileInput\').click()"' +
          ' ondragover="event.preventDefault();this.style.borderColor=\'var(--teal)\';this.style.background=\'var(--teal-pale)\'"' +
          ' ondragleave="this.style.borderColor=\'\';this.style.background=\'\'"' +
          ' ondrop="stkHandleDrop(event)">' +
          '<div style="font-size:32px;margin-bottom:6px">📂</div>' +
          '<div style="font-weight:600;color:var(--text-secondary)">Click to browse or drag & drop</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:3px">.xlsx · .xls · .csv · .tsv · .json</div>' +
        '</div>' +
        '<input type="file" id="stkFileInput" accept=".xlsx,.xls,.csv,.tsv,.json" style="display:none" onchange="stkHandleSelect(event)">' +

        // Preview
        '<div id="stkImportPreview"></div>' +
        '<div id="stkImportError" style="color:var(--red);font-size:12.5px;min-height:18px"></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="closeOverlay(\'stockImportOverlay\')">Cancel</button>' +
        '<button class="btn-sm btn-teal" id="stkImportBtn" onclick="executeStkImport()" disabled style="opacity:0.5">📥 Import Items</button>' +
      '</div>' +
    '</div>';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function stkHandleDrop(event) {
  event.preventDefault();
  document.getElementById('stkDropZone').style.borderColor = '';
  document.getElementById('stkDropZone').style.background  = '';
  var file = event.dataTransfer.files[0];
  if (file) stkProcessFile(file);
}
function stkHandleSelect(event) {
  var file = event.target.files[0];
  if (file) stkProcessFile(file);
}

async function stkProcessFile(file) {
  var errEl   = document.getElementById('stkImportError');
  var preview = document.getElementById('stkImportPreview');
  var btn     = document.getElementById('stkImportBtn');
  _stockImportRows = [];
  if (errEl)   errEl.textContent = '';
  if (preview) preview.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted)">⏳ Parsing file…</div>';
  if (btn)     { btn.disabled = true; btn.style.opacity = '0.5'; }

  try {
    var raw  = await bulkParseFile(file);
    var rows = stkNormalizeRows(raw);
    _stockImportRows = rows;

    var valid   = rows.filter(function(r){ return !r._error; });
    var invalid = rows.filter(function(r){ return  r._error; });

    if (preview) {
      preview.innerHTML =
        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-bottom:10px">' +
          '<div style="display:flex;gap:16px;font-size:13px;margin-bottom:10px">' +
            '<span>📄 <strong>' + rows.length + '</strong> rows</span>' +
            '<span style="color:var(--green)">✅ <strong>' + valid.length + '</strong> valid</span>' +
            (invalid.length ? '<span style="color:var(--red)">⚠️ <strong>' + invalid.length + '</strong> with issues</span>' : '') +
          '</div>' +
          '<div style="overflow-x:auto;max-height:200px;overflow-y:auto">' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
          '<thead><tr style="background:var(--bg)">' +
            '<th style="padding:6px 10px;text-align:left">Name</th>' +
            '<th style="padding:6px 10px;text-align:center">Qty</th>' +
            '<th style="padding:6px 10px;text-align:left">Category</th>' +
            '<th style="padding:6px 10px;text-align:right">Unit Price</th>' +
            '<th style="padding:6px 10px;text-align:center">Status</th>' +
          '</tr></thead><tbody>' +
          rows.slice(0, 100).map(function(r) {
            return '<tr style="border-bottom:1px solid var(--border);background:' + (r._error ? 'var(--red-bg)' : '') + '">' +
              '<td style="padding:5px 10px;font-weight:600">' + escHtml(r.name || '—') + '</td>' +
              '<td style="padding:5px 10px;text-align:center">' + (r.quantity || 0) + '</td>' +
              '<td style="padding:5px 10px">'  + escHtml(r.category || 'General') + '</td>' +
              '<td style="padding:5px 10px;text-align:right">₹' + (r.unit_price || 0) + '</td>' +
              '<td style="padding:5px 10px;text-align:center">' + (r._error
                ? '<span style="color:var(--red);font-size:11px">⚠️ ' + escHtml(r._error) + '</span>'
                : '<span style="color:var(--green)">✅</span>') + '</td>' +
            '</tr>';
          }).join('') +
          (rows.length > 100 ? '<tr><td colspan="5" style="padding:8px;text-align:center;color:var(--text-muted)">…and ' + (rows.length - 100) + ' more rows</td></tr>' : '') +
          '</tbody></table></div></div>';
    }

    if (btn) { btn.disabled = valid.length === 0; btn.style.opacity = valid.length > 0 ? '1' : '0.5'; }
    if (valid.length === 0 && errEl) errEl.textContent = 'No valid rows found. Check file format and required columns (name, quantity).';

  } catch(e) {
    if (errEl)   errEl.textContent = '❌ ' + e.message;
    if (preview) preview.innerHTML = '';
    if (btn)     { btn.disabled = true; btn.style.opacity = '0.5'; }
  }
}

function stkNormalizeRows(raw) {
  return raw.map(function(row) {
    var name = String(row.name || row.medicine_name || row.medicine || row.item || row.drug || row.item_name || '').trim();
    if (!name) return Object.assign({}, row, { _error: 'Missing name' });
    var qty = parseInt(row.quantity || row.qty || row.stock || row.current_qty || row.current_stock || '0') || 0;
    return {
      name,
      quantity:     qty,
      category:     String(row.category || row.type || row.item_category || 'General').trim(),
      unit:         String(row.unit || row.unit_type || 'tablets').trim(),
      min_quantity: parseInt(row.min_quantity || row.min_stock || row.minimum || row.reorder_level || '10') || 10,
      unit_price:   parseFloat(row.unit_price || row.price || row.cost || row.mrp || '0') || 0,
      batch_no:     String(row.batch_no || row.batch || row.batch_number || row.lot_no || '').trim(),
      expiry_date:  bulkParseExpiry(row.expiry_date || row.expiry || row.exp_date || row.expiry_on || ''),
    };
  });
}

async function executeStkImport() {
  var valid    = _stockImportRows.filter(function(r){ return !r._error; });
  var conflict = document.querySelector('input[name="stkConflict"]:checked')?.value || 'update';
  var btn      = document.getElementById('stkImportBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Importing…'; }

  var inserted = 0, updated = 0, skipped = 0, errors = 0;

  for (var i = 0; i < valid.length; i++) {
    var row = valid[i];
    try {
      var existing = (typeof stockItems !== 'undefined' ? stockItems : []).find(function(s) {
        return (s.name || '').trim().toLowerCase() === row.name.toLowerCase();
      });

      if (existing) {
        if (conflict === 'skip') { skipped++; continue; }
        var newQty = conflict === 'add' ? existing.quantity + row.quantity : row.quantity;
        var updItem = Object.assign({}, existing, row, {
          id: existing.id, clinic_id: activeClinicId, quantity: newQty, updated_at: new Date().toISOString()
        });
        delete updItem._error;
        var ok = await dbUpsertStock(updItem);
        if (ok) updated++; else errors++;
      } else {
        var newItem = Object.assign({
          id: 'stk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
          clinic_id: activeClinicId, updated_at: new Date().toISOString()
        }, row);
        delete newItem._error;
        var ok2 = await dbUpsertStock(newItem);
        if (ok2) inserted++; else errors++;
      }
    } catch(e) { errors++; }
  }

  if (btn) { btn.disabled = false; btn.textContent = '📥 Import Items'; }
  closeOverlay('stockImportOverlay');

  var msg = '✅ Stock import: ' + inserted + ' added, ' + updated + ' updated' +
    (skipped ? ', ' + skipped + ' skipped' : '') + (errors ? ', ' + errors + ' failed' : '');
  showToast(msg, errors > 0 ? 'info' : 'success');

  if (typeof showStockView === 'function') await showStockView();
}

function downloadStockTemplate(format) {
  var headers = ['name', 'quantity', 'category', 'unit', 'min_quantity', 'unit_price', 'batch_no', 'expiry_date'];
  var sample  = [
    ['Paracetamol 500mg', '100', 'Analgesic',   'tablets',  '20', '2.50',  'BT2024001', '2026-12-31'],
    ['Amoxicillin 250mg', '50',  'Antibiotic',  'capsules', '10', '8.00',  'BT2024002', '2025-06-30'],
    ['ORS Sachets',       '200', 'General',     'sachets',  '30', '1.50',  '',           ''],
    ['Paracetamol Syrup', '40',  'Analgesic',   'bottles',  '10', '35.00', 'BT2024003', '2026-03-15'],
  ];
  if (format === 'csv') {
    var csv = headers.join(',') + '\n' + sample.map(function(r){ return r.join(','); }).join('\n');
    bulkDownloadText(csv, 'rxvault_stock_import_template.csv', 'text/csv');
  } else if (format === 'json') {
    var obj = sample.map(function(r){ var o={}; headers.forEach(function(h,i){ o[h]=r[i]; }); return o; });
    bulkDownloadText(JSON.stringify(obj, null, 2), 'rxvault_stock_import_template.json', 'application/json');
  } else if (format === 'xlsx') {
    if (typeof XLSX === 'undefined') { showToast('SheetJS not loaded for Excel export.', 'error'); return; }
    var ws = XLSX.utils.aoa_to_sheet([headers].concat(sample));
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    XLSX.writeFile(wb, 'rxvault_stock_import_template.xlsx');
  }
}

// ════════════════════════════════════════════════════════════
//  MODULE 2: DOCTOR BULK IMPORT
// ════════════════════════════════════════════════════════════

var _doctorImportRows = [];

function openDoctorImport() {
  if (typeof can !== 'undefined' && !can.accessAdminPanel()) {
    showToast('⛔ Admin or SuperAdmin access required to import doctors.', 'error');
    return;
  }

  var overlay = document.getElementById('doctorImportOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'doctorImportOverlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML =
    '<div class="modal" style="max-width:640px">' +
      '<div class="modal-header">' +
        '<div><div class="modal-title">📥 Import Doctor List</div>' +
          '<div class="modal-subtitle">Bulk-add or update doctors via Excel, CSV, JSON or TSV</div></div>' +
        '<button class="modal-close" onclick="closeOverlay(\'doctorImportOverlay\')">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +

        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:16px">' +
          '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:10px">📋 Supported Formats</div>' +
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">' +
            bulkFormatBadge('📊', '.xlsx / .xls', 'Excel', 'var(--teal)') +
            bulkFormatBadge('📄', '.csv', 'CSV', 'var(--allopathy)') +
            bulkFormatBadge('🔧', '.json', 'JSON', 'var(--homeopathy)') +
            bulkFormatBadge('📑', '.tsv', 'TSV', 'var(--ayurveda)') +
          '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);line-height:1.7">' +
            '<strong>Required:</strong> <code>name</code>, <code>reg_no</code><br>' +
            '<strong>Optional:</strong> <code>type</code>, <code>qualification</code>, <code>specialization</code>, <code>hospital</code>, <code>phone</code>, <code>email</code>, <code>address</code>' +
          '</div>' +
        '</div>' +

        '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">' +
          '<span style="font-size:12px;color:var(--text-muted);align-self:center">Download template:</span>' +
          '<button onclick="downloadDoctorTemplate(\'csv\')"  class="btn-sm btn-outline-teal" style="font-size:12px">⬇️ CSV</button>' +
          '<button onclick="downloadDoctorTemplate(\'json\')" class="btn-sm btn-outline-teal" style="font-size:12px">⬇️ JSON</button>' +
          '<button onclick="downloadDoctorTemplate(\'xlsx\')" class="btn-sm btn-outline-teal" style="font-size:12px">⬇️ Excel</button>' +
        '</div>' +

        '<div class="field" style="margin-bottom:14px">' +
          '<label>When doctor (reg no) already exists:</label>' +
          '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">' +
            '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:7px 12px;border:1px solid var(--border);border-radius:var(--radius)">' +
              '<input type="radio" name="drConflict" value="update" checked> ✏️ Update details</label>' +
            '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:7px 12px;border:1px solid var(--border);border-radius:var(--radius)">' +
              '<input type="radio" name="drConflict" value="skip"> ⏭️ Skip duplicates</label>' +
          '</div>' +
        '</div>' +

        '<div id="drDropZone" ' +
          'style="border:2px dashed var(--border2);border-radius:var(--radius-lg);padding:28px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:12px"' +
          ' onclick="document.getElementById(\'drFileInput\').click()"' +
          ' ondragover="event.preventDefault();this.style.borderColor=\'var(--teal)\';this.style.background=\'var(--teal-pale)\'"' +
          ' ondragleave="this.style.borderColor=\'\';this.style.background=\'\'"' +
          ' ondrop="drHandleDrop(event)">' +
          '<div style="font-size:32px;margin-bottom:6px">📂</div>' +
          '<div style="font-weight:600;color:var(--text-secondary)">Click to browse or drag & drop</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:3px">.xlsx · .xls · .csv · .tsv · .json</div>' +
        '</div>' +
        '<input type="file" id="drFileInput" accept=".xlsx,.xls,.csv,.tsv,.json" style="display:none" onchange="drHandleSelect(event)">' +

        '<div id="drImportPreview"></div>' +
        '<div id="drImportError" style="color:var(--red);font-size:12.5px;min-height:18px"></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="closeOverlay(\'doctorImportOverlay\')">Cancel</button>' +
        '<button class="btn-sm btn-teal" id="drImportBtn" onclick="executeDrImport()" disabled style="opacity:0.5">📥 Import Doctors</button>' +
      '</div>' +
    '</div>';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function drHandleDrop(event) {
  event.preventDefault();
  document.getElementById('drDropZone').style.borderColor = '';
  document.getElementById('drDropZone').style.background  = '';
  var file = event.dataTransfer.files[0];
  if (file) drProcessFile(file);
}
function drHandleSelect(event) {
  var file = event.target.files[0];
  if (file) drProcessFile(file);
}

async function drProcessFile(file) {
  var errEl   = document.getElementById('drImportError');
  var preview = document.getElementById('drImportPreview');
  var btn     = document.getElementById('drImportBtn');
  _doctorImportRows = [];
  if (errEl)   errEl.textContent = '';
  if (preview) preview.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted)">⏳ Parsing file…</div>';
  if (btn)     { btn.disabled = true; btn.style.opacity = '0.5'; }

  try {
    var raw  = await bulkParseFile(file);
    var rows = drNormalizeRows(raw);
    _doctorImportRows = rows;

    var valid   = rows.filter(function(r){ return !r._error; });
    var invalid = rows.filter(function(r){ return  r._error; });

    if (preview) {
      preview.innerHTML =
        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-bottom:10px">' +
          '<div style="display:flex;gap:16px;font-size:13px;margin-bottom:10px">' +
            '<span>📄 <strong>' + rows.length + '</strong> rows</span>' +
            '<span style="color:var(--green)">✅ <strong>' + valid.length + '</strong> valid</span>' +
            (invalid.length ? '<span style="color:var(--red)">⚠️ <strong>' + invalid.length + '</strong> with issues</span>' : '') +
          '</div>' +
          '<div style="overflow-x:auto;max-height:200px;overflow-y:auto">' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
          '<thead><tr style="background:var(--bg)">' +
            '<th style="padding:6px 10px;text-align:left">Name</th>' +
            '<th style="padding:6px 10px;text-align:left">Reg No</th>' +
            '<th style="padding:6px 10px;text-align:left">Type</th>' +
            '<th style="padding:6px 10px;text-align:left">Specialization</th>' +
            '<th style="padding:6px 10px;text-align:center">Status</th>' +
          '</tr></thead><tbody>' +
          rows.slice(0, 100).map(function(r) {
            return '<tr style="border-bottom:1px solid var(--border);background:' + (r._error ? 'var(--red-bg)' : '') + '">' +
              '<td style="padding:5px 10px;font-weight:600">Dr. ' + escHtml(r.name || '—') + '</td>' +
              '<td style="padding:5px 10px;font-family:monospace;font-size:11px">' + escHtml(r.regNo || '—') + '</td>' +
              '<td style="padding:5px 10px">' + escHtml(r.type || '—') + '</td>' +
              '<td style="padding:5px 10px">' + escHtml(r.specialization || '—') + '</td>' +
              '<td style="padding:5px 10px;text-align:center">' + (r._error
                ? '<span style="color:var(--red);font-size:11px">⚠️ ' + escHtml(r._error) + '</span>'
                : '<span style="color:var(--green)">✅</span>') + '</td>' +
            '</tr>';
          }).join('') +
          (rows.length > 100 ? '<tr><td colspan="5" style="padding:8px;text-align:center;color:var(--text-muted)">…and ' + (rows.length - 100) + ' more</td></tr>' : '') +
          '</tbody></table></div></div>';
    }

    if (btn) { btn.disabled = valid.length === 0; btn.style.opacity = valid.length > 0 ? '1' : '0.5'; }
    if (valid.length === 0 && errEl) errEl.textContent = 'No valid rows found. Check required columns: name, reg_no';

  } catch(e) {
    if (errEl)   errEl.textContent = '❌ ' + e.message;
    if (preview) preview.innerHTML = '';
    if (btn)     { btn.disabled = true; btn.style.opacity = '0.5'; }
  }
}

function drNormalizeRows(raw) {
  return raw.map(function(row) {
    var name  = String(row.name || row.doctor_name || row.full_name || row.dr_name || '').trim();
    var regNo = String(row.reg_no || row.regno || row.registration_no || row.registration_number || row.reg || row.license_no || '').trim();
    if (!name)  return Object.assign({}, row, { _error: 'Missing name' });
    if (!regNo) return Object.assign({}, row, { _error: 'Missing reg_no' });

    var rawType = String(row.type || row.medicine_type || row.system || row.practice_type || 'allopathy').toLowerCase().trim();
    var type = rawType.includes('homo') ? 'homeopathy' : rawType.includes('ayur') ? 'ayurveda' : 'allopathy';

    return {
      regNo,
      name,
      type,
      qualification:  String(row.qualification || row.degree || row.qualifications || '').trim(),
      specialization: String(row.specialization || row.specialty || row.speciality || '').trim(),
      hospital:       String(row.hospital || row.clinic || row.hospital_clinic || row.practice || '').trim(),
      phone:          String(row.phone || row.mobile || row.contact || row.phone_no || '').trim(),
      email:          String(row.email || row.email_id || '').trim(),
      address:        String(row.address || row.clinic_address || '').trim(),
      availability:   [],
      unavailable:    false,
      clinicId:       activeClinicId,
    };
  });
}

async function executeDrImport() {
  var valid    = _doctorImportRows.filter(function(r){ return !r._error; });
  var conflict = document.querySelector('input[name="drConflict"]:checked')?.value || 'update';
  var btn      = document.getElementById('drImportBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Importing…'; }

  var inserted = 0, updated = 0, skipped = 0, errors = 0;

  for (var i = 0; i < valid.length; i++) {
    var row = valid[i];
    try {
      var existing = doctorRegistry.find(function(d) {
        return (d.regNo || '').trim().toLowerCase() === row.regNo.toLowerCase();
      });

      if (existing) {
        if (conflict === 'skip') { skipped++; continue; }
        var merged = Object.assign({}, existing, row, { id: existing.id });
        delete merged._error;
        var ok = await dbUpsertDoctor(merged, activeClinicId);
        if (ok) {
          var idx = doctorRegistry.findIndex(function(d){ return d.id === existing.id; });
          if (idx > -1) doctorRegistry[idx] = merged;
          updated++;
        } else errors++;
      } else {
        var newDoc = Object.assign({
          id: 'dr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
        }, row);
        delete newDoc._error;
        var ok2 = await dbUpsertDoctor(newDoc, activeClinicId);
        if (ok2) { doctorRegistry.push(newDoc); inserted++; } else errors++;
      }
    } catch(e) { errors++; }
  }

  if (btn) { btn.disabled = false; btn.textContent = '📥 Import Doctors'; }
  closeOverlay('doctorImportOverlay');

  if (typeof updateStats === 'function') updateStats();
  if (currentView === 'doctors' && typeof renderDoctorsPage === 'function') renderDoctorsPage();
  if (typeof renderAdminDoctorList === 'function') renderAdminDoctorList();

  var msg = '✅ Doctor import: ' + inserted + ' added, ' + updated + ' updated' +
    (skipped ? ', ' + skipped + ' skipped' : '') + (errors ? ', ' + errors + ' failed' : '');
  showToast(msg, errors > 0 ? 'info' : 'success');
}

function downloadDoctorTemplate(format) {
  var headers = ['name', 'reg_no', 'type', 'qualification', 'specialization', 'hospital', 'phone', 'email', 'address'];
  var sample  = [
    ['Priya Mehta',       'MCI/2045',  'allopathy',  'MBBS, MD',          'General Physician',    'Apollo Clinic Patna',       '+91 98765 43210', 'dr.priya@clinic.in',  'Gandhi Maidan, Patna'],
    ['Rakesh Kumar Jha',  'HCI/567',   'homeopathy', 'BHMS, DHMS',        'Classical Homeopath',  'Jha Homeo Clinic',          '+91 87654 32109', 'dr.rjha@clinic.in',   'Boring Road, Patna'],
    ['Vaidya S Tripathi', 'BAMS/2019', 'ayurveda',   'BAMS, MD (Ayu)',    'Ayurvedic Practitioner','Dhanwantari Center',       '+91 76543 21098', 'vaidya@clinic.in',    'Kankarbagh, Patna'],
  ];
  if (format === 'csv') {
    var csv = headers.join(',') + '\n' + sample.map(function(r){ return r.map(function(c){ return '"'+c+'"'; }).join(','); }).join('\n');
    bulkDownloadText(csv, 'rxvault_doctor_import_template.csv', 'text/csv');
  } else if (format === 'json') {
    var obj = sample.map(function(r){ var o={}; headers.forEach(function(h,i){ o[h]=r[i]; }); return o; });
    bulkDownloadText(JSON.stringify(obj, null, 2), 'rxvault_doctor_import_template.json', 'application/json');
  } else if (format === 'xlsx') {
    if (typeof XLSX === 'undefined') { showToast('SheetJS not loaded for Excel export.', 'error'); return; }
    var ws = XLSX.utils.aoa_to_sheet([headers].concat(sample));
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Doctors');
    XLSX.writeFile(wb, 'rxvault_doctor_import_template.xlsx');
  }
}

// ════════════════════════════════════════════════════════════
//  WIRE IMPORT BUTTONS INTO EXISTING UI ON DOM READY
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {

  // ── Add "📥 Import" button to Stock view controls row ──────
  var _origRenderStockView = typeof renderStockView === 'function' ? renderStockView : null;
  if (_origRenderStockView) {
    renderStockView = function(container) {
      _origRenderStockView(container);
      var isAdmin = typeof can === 'undefined' || can.accessAdminPanel();
      if (!isAdmin) return;
      var addBtn = container ? container.querySelector('[onclick="openAddStockItem()"]') : null;
      if (addBtn && !container.querySelector('#stkBulkImportBtn')) {
        var importBtn       = document.createElement('button');
        importBtn.id        = 'stkBulkImportBtn';
        importBtn.className = 'btn-sm btn-outline-teal';
        importBtn.style.cssText = 'padding:9px 14px;font-size:13px;white-space:nowrap';
        importBtn.innerHTML = '📥 Import File';
        importBtn.onclick   = openStockImport;
        addBtn.parentElement.insertBefore(importBtn, addBtn.nextSibling);
      }
    };
  }

  // ── Add "📥 Import Doctors" button to Admin Panel doctor header ──
  var _origRenderAdminDr = typeof renderAdminDoctorList === 'function' ? renderAdminDoctorList : null;
  if (_origRenderAdminDr) {
    renderAdminDoctorList = function() {
      _origRenderAdminDr();
      // Find the "+ Add Doctor" button in the admin modal header
      var addDrBtn = document.querySelector('#adminDoctorView .modal-header .btn-teal');
      if (addDrBtn && !document.getElementById('drBulkImportBtn')) {
        var importBtn       = document.createElement('button');
        importBtn.id        = 'drBulkImportBtn';
        importBtn.className = 'btn-sm btn-outline-teal';
        importBtn.innerHTML = '📥 Import';
        importBtn.onclick   = openDoctorImport;
        addDrBtn.parentElement.insertBefore(importBtn, addDrBtn.nextSibling);
      }
    };
  }
});

// ════════════════════════════════════════════════════════════
//  STAFF BULK IMPORT
// ════════════════════════════════════════════════════════════

var _staffImportRows = [];

function openStaffImportModal() {
  var existing = document.getElementById('staffImportOverlay');
  if (existing) { existing.remove(); }

  var overlay = document.createElement('div');
  overlay.id = 'staffImportOverlay';
  overlay.className = 'modal-overlay open';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';

  overlay.innerHTML =
    '<div class="modal" style="max-width:640px">' +
      '<div class="modal-header">' +
        '<div><div class="modal-title">📥 Import Staff</div>' +
          '<div class="modal-subtitle">Bulk-add or update staff via Excel, CSV, JSON or TSV</div></div>' +
        '<button class="modal-close" onclick="closeOverlay(\'staffImportOverlay\')">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +

        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:16px">' +
          '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:10px">📋 Supported Formats</div>' +
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">' +
            bulkFormatBadge('📊', '.xlsx / .xls', 'Excel', 'var(--teal)') +
            bulkFormatBadge('📄', '.csv', 'CSV', 'var(--allopathy)') +
            bulkFormatBadge('🔧', '.json', 'JSON', 'var(--homeopathy)') +
            bulkFormatBadge('📑', '.tsv', 'TSV', 'var(--ayurveda)') +
          '</div>' +
          '<div style="font-size:12px;color:var(--text-muted);line-height:1.7">' +
            '<strong>Required:</strong> <code>name</code>, <code>email</code><br>' +
            '<strong>Optional:</strong> <code>role</code>, <code>staff_type</code>, <code>phone</code><br>' +
            '<strong>Password:</strong> Generated automatically if not provided (min 8 chars with uppercase + number)' +
          '</div>' +
        '</div>' +

        '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">' +
          '<span style="font-size:12px;color:var(--text-muted);align-self:center">Download template:</span>' +
          '<button onclick="downloadStaffTemplate(\'csv\')"  class="btn-sm btn-outline-teal" style="font-size:12px">⬇️ CSV</button>' +
          '<button onclick="downloadStaffTemplate(\'json\')" class="btn-sm btn-outline-teal" style="font-size:12px">⬇️ JSON</button>' +
          '<button onclick="downloadStaffTemplate(\'xlsx\')" class="btn-sm btn-outline-teal" style="font-size:12px">⬇️ Excel</button>' +
        '</div>' +

        '<div class="field" style="margin-bottom:14px">' +
          '<label>When staff (email) already exists:</label>' +
          '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">' +
            '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:7px 12px;border:1px solid var(--border);border-radius:var(--radius)">' +
              '<input type="radio" name="staffConflict" value="update" checked> ✏️ Update details</label>' +
            '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:7px 12px;border:1px solid var(--border);border-radius:var(--radius)">' +
              '<input type="radio" name="staffConflict" value="skip"> ⏭️ Skip duplicates</label>' +
          '</div>' +
        '</div>' +

        '<div id="staffDropZone" ' +
          'style="border:2px dashed var(--border2);border-radius:var(--radius-lg);padding:28px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:12px"' +
          ' onclick="document.getElementById(\'staffFileInput\').click()"' +
          ' ondragover="event.preventDefault();this.style.borderColor=\'var(--teal)\';this.style.background=\'var(--teal-pale)\'"' +
          ' ondragleave="this.style.borderColor=\'\';this.style.background=\'\'"' +
          ' ondrop="staffHandleDrop(event)">' +
          '<div style="font-size:32px;margin-bottom:6px">📂</div>' +
          '<div style="font-weight:600;color:var(--text-secondary)">Click to browse or drag & drop</div>' +
          '<div style="font-size:12px;color:var(--text-muted);margin-top:3px">.xlsx · .xls · .csv · .tsv · .json</div>' +
        '</div>' +
        '<input type="file" id="staffFileInput" accept=".xlsx,.xls,.csv,.tsv,.json" style="display:none" onchange="staffHandleSelect(event)">' +

        '<div id="staffImportPreview"></div>' +
        '<div id="staffImportError" style="color:var(--red);font-size:12.5px;min-height:18px"></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="closeOverlay(\'staffImportOverlay\')">Cancel</button>' +
        '<button class="btn-sm btn-teal" id="staffImportBtn" onclick="executeStaffImport()" disabled style="opacity:0.5">📥 Import Staff</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

function staffHandleDrop(event) {
  event.preventDefault();
  document.getElementById('staffDropZone').style.borderColor = '';
  document.getElementById('staffDropZone').style.background  = '';
  var file = event.dataTransfer.files[0];
  if (file) staffProcessFile(file);
}

function staffHandleSelect(event) {
  var file = event.target.files[0];
  if (file) staffProcessFile(file);
}

async function staffProcessFile(file) {
  var errEl   = document.getElementById('staffImportError');
  var preview = document.getElementById('staffImportPreview');
  var btn     = document.getElementById('staffImportBtn');
  _staffImportRows = [];
  if (errEl)   errEl.textContent = '';
  if (preview) preview.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted)">⏳ Parsing file…</div>';
  if (btn)     { btn.disabled = true; btn.style.opacity = '0.5'; }

  try {
    var raw  = await bulkParseFile(file);
    var rows = staffNormalizeRows(raw);
    _staffImportRows = rows;

    var valid   = rows.filter(function(r){ return !r._error; });
    var invalid = rows.filter(function(r){ return  r._error; });

    if (preview) {
      preview.innerHTML =

        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-bottom:10px">' +
          '<div style="display:flex;gap:16px;font-size:13px;margin-bottom:10px">' +
            '<span>📄 <strong>' + rows.length + '</strong> rows</span>' +
            '<span style="color:var(--green)">✅ <strong>' + valid.length + '</strong> valid</span>' +
            (invalid.length ? '<span style="color:var(--red)">⚠️ <strong>' + invalid.length + '</strong> with issues</span>' : '') +
          '</div>' +
          '<div style="overflow-x:auto;max-height:200px;overflow-y:auto">' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px">' +
          '<thead><tr style="background:var(--bg)">' +
            '<th style="padding:6px 10px;text-align:left">Name</th>' +
            '<th style="padding:6px 10px;text-align:left">Email</th>' +
            '<th style="padding:6px 10px;text-align:left">Role</th>' +
            '<th style="padding:6px 10px;text-align:left">Phone</th>' +
            '<th style="padding:6px 10px;text-align:center">Status</th>' +
          '</tr></thead><tbody>' +
          rows.slice(0, 100).map(function(r) {
            return '<tr style="border-bottom:1px solid var(--border);background:' + (r._error ? 'var(--red-bg)' : '') + '">' +
              '<td style="padding:5px 10px;font-weight:600">' + escHtml(r.name || '—') + '</td>' +
              '<td style="padding:5px 10px;font-family:monospace;font-size:11px">' + escHtml(r.email || '—') + '</td>' +
              '<td style="padding:5px 10px">' + escHtml(r.role || '—') + '</td>' +
              '<td style="padding:5px 10px">' + escHtml(r.phone || '—') + '</td>' +
              '<td style="padding:5px 10px;text-align:center">' + (r._error
                ? '<span style="color:var(--red);font-size:11px">⚠️ ' + escHtml(r._error) + '</span>'
                : '<span style="color:var(--green)">✅</span>') + '</td>' +
            '</tr>';
          }).join('') +
          (rows.length > 100 ? '<tr><td colspan="5" style="padding:8px;text-align:center;color:var(--text-muted)">…and ' + (rows.length - 100) + ' more</td></tr>' : '') +
          '</tbody></table></div></div>';
    }

    if (btn) { btn.disabled = valid.length === 0; btn.style.opacity = valid.length > 0 ? '1' : '0.5'; }
    if (valid.length === 0 && errEl) errEl.textContent = 'No valid rows found. Check required columns: name, email';

  } catch(e) {
    if (errEl)   errEl.textContent = '❌ ' + e.message;
    if (preview) preview.innerHTML = '';
    if (btn)     { btn.disabled = true; btn.style.opacity = '0.5'; }
  }
}

function staffNormalizeRows(raw) {
  return raw.map(function(row) {
    var name  = String(row.name || row.full_name || row.fullname || row.staff_name || '').trim();
    var email = String(row.email || row.email_id || row.email_address || '').trim().toLowerCase();

    if (!name)  return Object.assign({}, row, { _error: 'Missing name' });
    if (!email) return Object.assign({}, row, { _error: 'Missing email' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Object.assign({}, row, { _error: 'Invalid email format' });

    var rawRole = String(row.role || row.staff_role || row.position || 'doctor').toLowerCase().trim();
    var role = normalizeStaffRole(rawRole);

    var rawType = String(row.staff_type || row.type || row.employment_type || 'permanent').toLowerCase().trim();
    var staffType = rawType.includes('adhoc') || rawType.includes('temporary') || rawType.includes('temp') ? 'adhoc' : 'permanent';

    return {
      name: name,
      email: email,
      role: role,
      staffType: staffType,
      phone: String(row.phone || row.mobile || row.contact || row.phone_no || '').trim(),
      password: String(row.password || '').trim() || null,
      clinicId: activeClinicId,
    };
  });
}

function normalizeStaffRole(raw) {
  var roleMap = {
    'doctor': 'doctor', 'dr': 'doctor', '🩺': 'doctor',
    'receptionist': 'receptionist', 'reception': 'receptionist', 'front desk': 'receptionist', '🧑‍💼': 'receptionist',
    'pharmacist': 'pharmacist', 'pharmacy': 'pharmacist', '💊': 'pharmacist',
    'medical assistant': 'medical_assistant', 'ma': 'medical_assistant', 'medical_assistant': 'medical_assistant',
    'lab technician': 'lab_technician', 'lab_technician': 'lab_technician', 'lab tech': 'lab_technician', '🧪': 'lab_technician',
    'billing manager': 'billing_manager', 'billing': 'billing_manager', 'finance': 'billing_manager', '💰': 'billing_manager',
    'inventory manager': 'inventory_manager', 'inventory': 'inventory_manager', '📦': 'inventory_manager',
    'clinic supervisor': 'clinic_supervisor', 'supervisor': 'clinic_supervisor', '⭐': 'clinic_supervisor',
    'medical support aide': 'medical_support_aide', 'support aide': 'medical_support_aide', '🛏️': 'medical_support_aide',
    'admin': 'admin', 'administrator': 'admin', '🔐': 'admin',
    'viewer': 'viewer', 'view only': 'viewer', '👁': 'viewer',
  };
  return roleMap[raw] || 'viewer';
}

function generateStaffPassword() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  var password = '';
  var hasUpper = false, hasLower = false, hasNum = false;
  while (!hasUpper || !hasLower || !hasNum || password.length < 8) {
    password = '';
    for (var i = 0; i < 10; i++) {
      var idx = Math.floor(Math.random() * chars.length);
      password += chars[idx];
    }
    hasUpper = /[A-Z]/.test(password);
    hasLower = /[a-z]/.test(password);
    hasNum = /[0-9]/.test(password);
  }
  return password;
}

async function executeStaffImport() {
  var valid      = _staffImportRows.filter(function(r){ return !r._error; });
  var conflict   = document.querySelector('input[name="staffConflict"]:checked')?.value || 'update';
  var btn        = document.getElementById('staffImportBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Importing…'; }

  var inserted = 0, updated = 0, skipped = 0, errors = 0;
  var errorLog = [];

  for (var i = 0; i < valid.length; i++) {
    var row = valid[i];
    try {
      var password = row.password || generateStaffPassword();

      var existing = await dbFindStaffMemberByEmail(activeClinicId, row.email);

      if (existing && existing.user_id) {
        if (conflict === 'skip') {
          skipped++;
          continue;
        }
        var roleOk = await dbUpdateStaffRole(activeClinicId, existing.user_id, row.role);
        var typeOk = await dbUpdateStaffType(activeClinicId, existing.user_id, row.staffType);
        if (roleOk || typeOk) {
          updated++;
          if (typeof dbAudit === 'function') dbAudit('update', 'clinic_staff', existing.user_id, null, { name: row.name, role: row.role });
        } else {
          errors++;
          errorLog.push({ row: i + 1, error: 'Failed to update staff', name: row.name, email: row.email });
        }
        continue;
      }

      var result = await dbCreateStaffUser(row.name, row.email, password, row.role, activeClinicId, currentUser.id, row.staffType);

      if (result.success) {
        inserted++;
        if (typeof dbAudit === 'function') dbAudit('create', 'clinic_staff', result.userId, null, { name: row.name, email: row.email, role: row.role });
      } else {
        errors++;
        errorLog.push({ row: i + 1, error: result.error || 'Failed to create', name: row.name, email: row.email });
      }
    } catch (err) {
      errors++;
      errorLog.push({ row: i + 1, error: err.message, name: row.name, email: row.email });
    }
  }

  if (btn) { btn.disabled = false; btn.textContent = '📥 Import Staff'; }

  var summary = '✅ Imported: ' + inserted + ' | 🔄 Updated: ' + updated + ' | ⏭️ Skipped: ' + skipped;
  if (errors > 0) {
    summary += ' | ⚠️ Errors: ' + errors;
  }

  showToast(summary, errors > 0 ? 'info' : 'success');

  if (errorLog.length > 0) {
    console.error('[StaffImport] Error log:', errorLog);
    var errEl = document.getElementById('staffImportError');
    if (errEl) errEl.innerHTML = '⚠️ ' + errors + ' row(s) failed. Check console for details.';
  }

  closeOverlay('staffImportOverlay');
  if (typeof loadStaffList === 'function') loadStaffList();
}

function downloadStaffTemplate(format) {
  var template = [
    { name: 'Dr. John Doe', email: 'john@clinic.com', role: 'doctor', staff_type: 'permanent', phone: '+91 98765 43210' },
    { name: 'Jane Smith', email: 'jane@clinic.com', role: 'receptionist', staff_type: 'permanent', phone: '+91 98765 43211' },
    { name: 'Mike Johnson', email: 'mike@clinic.com', role: 'pharmacist', staff_type: 'adhoc', phone: '+91 98765 43212' },
  ];

  if (format === 'json') {
    downloadBlob(JSON.stringify(template, null, 2), 'staff_import_template.json', 'application/json');
  } else if (format === 'csv') {
    var csv = 'name,email,role,staff_type,phone\n' + template.map(function(r){ return '"' + r.name + '","' + r.email + '","' + r.role + '","' + r.staff_type + '","' + r.phone + '"'; }).join('\n');
    downloadBlob(csv, 'staff_import_template.csv', 'text/csv');
  } else {
    downloadExcel(template, 'staff_import_template');
  }
}
