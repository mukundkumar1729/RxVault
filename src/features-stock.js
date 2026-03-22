// ════════════════════════════════════════════════════════════
//  FEATURES-STOCK.JS
//  Modules: Stock / Inventory, Prescription QR Code
//  Load order: after features.js, features-ai.js
//             before features-analytics.js
// ════════════════════════════════════════════════════════════

// ─── Extend hideAllViews to include ALL dynamic feature views ─
// This prevents any view from bleeding into another when switching.
var _analyticsOrigHideAll = typeof hideAllViews === 'function' ? hideAllViews : function(){};
hideAllViews = function() {
  _analyticsOrigHideAll();
  [
    // Analytics / Stock
    'stockView', 'analyticsView', 'outbreakView',
    // Lab & Clinical (features-lab.js, features-opd.js)
    'labOrdersView', 'vaccinationView', 'followupView', 'opdBoardView',
    // Staff (features-roster.js)
    'rosterView'
  ].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
};

// ─── Helper: show one analytics view, hide all others ─────
function _showAnalyticsModule(targetId) {
  // Hide ALL views first (full reset)
  hideAllViews();
  // Also hide the main Rx content area
  ['statsRow','controlsBar','prescriptionsList','aiSearchPanel',
   'doctorsView','patientsView','pharmacyView','appointmentView','billingView'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  var addBtn = document.getElementById('btnAddRx'); if (addBtn) addBtn.style.display = 'none';
  // Show target
  var target = document.getElementById(targetId);
  if (target) target.style.display = '';
}

// ════════════════════════════════════════════════════════════
//  MODULE 1: STOCK / INVENTORY
// ════════════════════════════════════════════════════════════
var stockItems = [];

async function showStockView() {
  currentView = 'stock';
  var sv = document.getElementById('stockView');
  if (!sv) { sv = document.createElement('div'); sv.id = 'stockView'; document.querySelector('.main').appendChild(sv); }
  _showAnalyticsModule('stockView');
  if (typeof setNavActive === 'function') setNavActive('navStock');
  document.getElementById('pageTitle').textContent    = '📦 Stock & Inventory';
  document.getElementById('pageSubtitle').textContent = 'Track medicine stock levels and get low-stock alerts';
  stockItems = await dbGetStock(activeClinicId);
  renderStockView(sv);
}

function renderStockView(container) {
  var lowStock    = stockItems.filter(function(i){ return i.quantity <= i.min_quantity; });
  var outOfStock  = stockItems.filter(function(i){ return i.quantity === 0; });
  var totalItems  = stockItems.length;
  var totalValue  = stockItems.reduce(function(s,i){ return s + (i.quantity * (i.unit_price||0)); }, 0);

  container.innerHTML =
    // Controls
    '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px">' +
      '<div style="position:relative;flex:1;min-width:200px">' +
        '<span style="position:absolute;left:12px;top:50%;transform:translateY(-50%)">🔍</span>' +
        '<input type="text" id="stockSearch" placeholder="Search medicine…" oninput="filterStock()" ' +
          'style="width:100%;padding:9px 12px 9px 34px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;box-sizing:border-box">' +
      '</div>' +
      '<select id="stockFilter" onchange="filterStock()" style="padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;background:var(--surface)">' +
        '<option value="all">All Items</option>' +
        '<option value="low">⚠️ Low Stock</option>' +
        '<option value="out">🔴 Out of Stock</option>' +
        '<option value="ok">✅ In Stock</option>' +
        '<option value="prescribed_missing">🚫 Prescribed — Not in Stock</option>' +
        '<option value="prescribed_low">📉 Prescribed — Low in Stock</option>' +
      '</select>' +
      '<select id="stockExpiryFilter" onchange="filterStock()" style="padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:DM Sans,sans-serif;background:var(--surface)">' +
        '<option value="valid">✅ Valid (Non-Expired)</option>' +
        '<option value="soon">⚠️ Expiring Soon (<30d)</option>' +
        '<option value="expired">🔴 Expired</option>' +
        '<option value="all_inc_expired">📦 Include Expired</option>' +
      '</select>' +
      '<button class="btn-add" onclick="openAddStockItem()" style="padding:9px 16px;font-size:13px;white-space:nowrap">＋ Add Item</button>' +
    '</div>' +

    // Stats
    (function() {
      var prescribedNames = getPrescribedMedicineNames();
      var prescMissing = prescribedNames.filter(function(name) {
        return !stockItems.some(function(s){ return stockNameMatch(s.name, name); });
      });
      var prescLow = stockItems.filter(function(s) {
        return s.quantity > 0 && s.quantity <= s.min_quantity &&
          prescribedNames.some(function(name){ return stockNameMatch(s.name, name); });
      });
      return '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">' +
        statCard('📦', totalItems, 'Total Items',  'var(--surface2)',      'var(--text-primary)') +
        statCard('⚠️', lowStock.length,  'Low Stock',    'var(--ayurveda-bg)',   'var(--ayurveda)') +
        statCard('🔴', outOfStock.length,'Out of Stock', 'var(--red-bg)',        'var(--red)') +
        statCard('💰', '₹'+totalValue.toLocaleString('en-IN'), 'Stock Value', 'var(--teal-pale)', 'var(--teal)') +
        statCard('🚫', prescMissing.length, 'Prescribed Missing', 'var(--red-bg)', 'var(--red)') +
        statCard('📉', prescLow.length,     'Prescribed Low',     'var(--ayurveda-bg)', 'var(--ayurveda)') +
      '</div>';
    })() +

    // Low stock alert banner
    (lowStock.length ? '<div style="background:var(--ayurveda-bg);border:1px solid rgba(180,83,9,0.3);border-radius:var(--radius-lg);padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px">' +
      '<span style="font-size:18px">⚠️</span>' +
      '<div style="font-size:13px;color:var(--ayurveda)"><strong>' + lowStock.length + ' item(s)</strong> are running low: ' +
        lowStock.slice(0,5).map(function(i){ return '<strong>'+escHtml(i.name)+'</strong> ('+i.quantity+' left)'; }).join(', ') +
        (lowStock.length > 5 ? ' +more' : '') +
      '</div>' +
    '</div>' : '') +

    // Table
    '<div id="stockTableWrap">' + renderStockTable(stockItems) + '</div>';
}

function renderStockTable(items) {
  if (!items.length) return '<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No items in inventory</div><div class="empty-sub">Click "+ Add Item" to add medicines to stock.</div></div>';
  return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden">' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
    '<thead><tr style="background:var(--surface2)">' +
      '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Medicine</th>' +
      '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Category</th>' +
      '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Stock</th>' +
      '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Min Level</th>' +
      '<th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Unit Price</th>' +
      '<th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Value</th>' +
      '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Expiry</th>' +
      '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Actions</th>' +
    '</tr></thead>' +
    '<tbody>' +
    items.map(function(item) {
      var status  = item.quantity === 0 ? 'out' : item.quantity <= item.min_quantity ? 'low' : 'ok';
      var sColors = { out:{bg:'var(--red-bg)',clr:'var(--red)',label:'Out'}, low:{bg:'var(--ayurveda-bg)',clr:'var(--ayurveda)',label:'Low'}, ok:{bg:'#e8f5e9',clr:'var(--green)',label:'OK'} };
      var sc = sColors[status];
      var expiry = item.expiry_date ? new Date(item.expiry_date) : null;
      var today = new Date();
      var isExpired = expiry && expiry < today;
      var expiryLabel = expiry ? formatDate(item.expiry_date) : '—';
      var expiryWarn  = expiry && !isExpired && (expiry - today) < 30 * 24 * 60 * 60 * 1000;
      var value = (item.quantity * (item.unit_price||0)).toLocaleString('en-IN');
      var rowStyle = isExpired ? 'color:var(--text-muted);background:rgba(220,38,38,0.02)' : '';
      return '<tr style="border-bottom:1px solid var(--border);transition:background 0.12s;' + rowStyle + '" ' +
        'onmouseenter="this.style.background=\'var(--surface2)\'" onmouseleave="this.style.background=\'' + (isExpired?'rgba(220,38,38,0.02)':'') + '\'">' +
        '<td style="padding:10px 14px"><div style="font-weight:600;' + (isExpired?'text-decoration:line-through':'') + '">' + escHtml(item.name) + '</div>' +
          '<div style="font-size:11.5px;color:var(--text-muted)">' + escHtml(item.unit||'') + '</div></td>' +
        '<td style="padding:10px 14px"><span style="background:var(--bg);border:1px solid var(--border);padding:2px 8px;border-radius:8px;font-size:11.5px">' + escHtml(item.category||'General') + '</span></td>' +
        '<td style="padding:10px 14px;text-align:center">' +
          '<span style="background:'+sc.bg+';color:'+sc.clr+';font-weight:700;padding:3px 10px;border-radius:10px;font-size:12px">' + item.quantity + '</span>' +
        '</td>' +
        '<td style="padding:10px 14px;text-align:center;color:var(--text-muted)">' + (item.min_quantity||0) + '</td>' +
        '<td style="padding:10px 14px;text-align:right">₹' + (item.unit_price||0).toLocaleString('en-IN') + '</td>' +
        '<td style="padding:10px 14px;text-align:right;font-weight:600;color:var(--teal)">₹' + value + '</td>' +
        '<td style="padding:10px 14px;text-align:center;' + (isExpired?'color:var(--red);font-weight:700':(expiryWarn?'color:var(--red);font-weight:600':'color:var(--text-muted)')) + '">' + (isExpired?'🔴 EXPIRED':expiryLabel) + (expiryWarn?' ⚠️':'') + '</td>' +
        '<td style="padding:10px 14px;text-align:center">' +
          '<div style="display:flex;gap:6px;justify-content:center">' +
            '<button onclick="openAdjustStock(\'' + item.id + '\')" style="font-size:11px;padding:4px 10px;border:1px solid var(--teal);border-radius:6px;background:transparent;color:var(--teal);cursor:pointer">± Adjust</button>' +
            '<button onclick="editStockItem(\'' + item.id + '\')" style="font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-muted);cursor:pointer">✏️</button>' +
            '<button onclick="deleteStockItem(\'' + item.id + '\')" style="font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-muted);cursor:pointer">🗑️</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('') +
    '</tbody></table></div>';
}

// ─── Prescription ↔ Stock matching helpers ───────────────
/**
 * Returns an array of unique medicine names from all active prescriptions.
 */
function getPrescribedMedicineNames() {
  var names = {};
  (typeof prescriptions !== 'undefined' ? prescriptions : []).forEach(function(rx) {
    if (rx.status !== 'active') return;
    (rx.medicines || []).forEach(function(m) {
      if (m.name) names[m.name.trim().toLowerCase()] = m.name.trim();
    });
  });
  return Object.values(names);
}

/**
 * Fuzzy match: does stock item name correspond to a prescribed medicine name?
 * Matches if either name starts with the first word of the other (case-insensitive).
 */
function stockNameMatch(stockName, prescName) {
  var s = (stockName || '').toLowerCase().trim();
  var p = (prescName || '').toLowerCase().trim();
  if (!s || !p) return false;
  var sFirst = s.split(/\s+/)[0];
  var pFirst = p.split(/\s+/)[0];
  return s.includes(pFirst) || p.includes(sFirst) || sFirst === pFirst;
}

function filterStock() {
  var q   = (document.getElementById('stockSearch')?.value || '').toLowerCase().trim();
  var fil = document.getElementById('stockFilter')?.value || 'all';
  var exp = document.getElementById('stockExpiryFilter')?.value || 'valid';

  var prescribedNames = getPrescribedMedicineNames();
  var today = new Date();
  var thirtyDays = 30 * 24 * 60 * 60 * 1000;

  var list;

  if (fil === 'prescribed_missing') {
    // Show stock items that are prescribed AND out of stock (qty = 0)
    // PLUS show a virtual row for medicines prescribed but not even in the inventory
    var inStockPrescribed = stockItems.filter(function(i) {
      return i.quantity === 0 &&
        prescribedNames.some(function(name){ return stockNameMatch(i.name, name); });
    });
    // Names not in stockItems at all
    var missingNames = prescribedNames.filter(function(name) {
      return !stockItems.some(function(s){ return stockNameMatch(s.name, name); });
    });
    // Convert missing names to virtual stock-item objects for display
    var virtualMissing = missingNames.map(function(name) {
      return { id: '__missing__'+name, name: name, quantity: 0, min_quantity: 0,
               category: '—', unit: '—', unit_price: 0, expiry_date: null, _virtual: true };
    });
    list = inStockPrescribed.concat(virtualMissing);

  } else if (fil === 'prescribed_low') {
    // Prescribed medicines that are in stock but quantity ≤ min_quantity
    list = stockItems.filter(function(i) {
      return i.quantity > 0 && i.quantity <= i.min_quantity &&
        prescribedNames.some(function(name){ return stockNameMatch(i.name, name); });
    });

  } else {
    list = stockItems.filter(function(i) {
      if (fil === 'low') return i.quantity > 0 && i.quantity <= i.min_quantity;
      if (fil === 'out') return i.quantity === 0;
      if (fil === 'ok')  return i.quantity > i.min_quantity;
      return true;
    });
  }

  // Apply Expiry Filter
  list = list.filter(function(i) {
    if (!i.expiry_date) return (exp !== 'expired' && exp !== 'soon'); // Unset expiry is considered non-expired
    var expDate = new Date(i.expiry_date);
    var isExpired = expDate < today;
    var isSoon = !isExpired && (expDate - today) < thirtyDays;

    if (exp === 'valid')           return !isExpired;
    if (exp === 'soon')            return isSoon;
    if (exp === 'expired')         return isExpired;
    if (exp === 'all_inc_expired') return true;
    return !isExpired; // Default to hiding expired
  });

  if (q) {
    list = list.filter(function(i) {
      return (i.name||'').toLowerCase().includes(q) || (i.category||'').toLowerCase().includes(q);
    });
  }

  var wrap = document.getElementById('stockTableWrap');
  if (!wrap) return;

  if (fil === 'prescribed_missing' || fil === 'prescribed_low') {
    wrap.innerHTML = renderStockTableWithContext(list, fil, prescribedNames);
  } else {
    wrap.innerHTML = renderStockTable(list);
  }
}

/**
 * Renders the stock table with extra context for prescription-aware filters.
 * Shows an alert banner and highlights the prescription connection.
 */
function renderStockTableWithContext(items, filterType, prescribedNames) {
  if (!items.length) {
    var emptyMsg = filterType === 'prescribed_missing'
      ? 'All prescribed medicines are available in stock. ✅'
      : 'No prescribed medicines are running low. ✅';
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:32px;text-align:center">' +
      '<div style="font-size:36px;margin-bottom:10px">✅</div>' +
      '<div style="font-weight:600;color:var(--text-secondary);font-size:14px">' + emptyMsg + '</div>' +
    '</div>';
  }

  var alertBg  = filterType === 'prescribed_missing' ? 'var(--red-bg)'        : 'var(--ayurveda-bg)';
  var alertClr = filterType === 'prescribed_missing' ? 'var(--red)'           : 'var(--ayurveda)';
  var alertBdr = filterType === 'prescribed_missing' ? 'rgba(220,38,38,0.3)'  : 'rgba(180,83,9,0.3)';
  var alertIcon= filterType === 'prescribed_missing' ? '🚫' : '📉';
  var alertText= filterType === 'prescribed_missing'
    ? items.length + ' medicine(s) from active prescriptions are <strong>not available</strong> in inventory.'
    : items.length + ' medicine(s) from active prescriptions are <strong>running low</strong> and need restocking.';

  var banner = '<div style="background:'+alertBg+';border:1px solid '+alertBdr+';border-radius:var(--radius-lg);' +
    'padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px">' +
    '<span style="font-size:20px">'+alertIcon+'</span>' +
    '<div style="font-size:13px;color:'+alertClr+'">' + alertText + '</div>' +
  '</div>';

  var rows = items.map(function(item) {
    var isVirtual = !!item._virtual;
    var expiry    = item.expiry_date ? new Date(item.expiry_date) : null;
    var expiryLabel = expiry ? formatDate(item.expiry_date) : '—';
    var expiryWarn  = expiry && (expiry - new Date()) < 30 * 24 * 60 * 60 * 1000;
    var value = isVirtual ? '—' : ('₹' + (item.quantity * (item.unit_price||0)).toLocaleString('en-IN'));

    // Badge for stock level
    var stockBadge = isVirtual
      ? '<span style="background:var(--red-bg);color:var(--red);font-weight:700;padding:3px 10px;border-radius:10px;font-size:12px">Not in Inventory</span>'
      : item.quantity === 0
        ? '<span style="background:var(--red-bg);color:var(--red);font-weight:700;padding:3px 10px;border-radius:10px;font-size:12px">0</span>'
        : '<span style="background:var(--ayurveda-bg);color:var(--ayurveda);font-weight:700;padding:3px 10px;border-radius:10px;font-size:12px">'+item.quantity+'</span>';

    // Find matching prescription info
    var matchingRx = (typeof prescriptions !== 'undefined' ? prescriptions : []).filter(function(rx) {
      return rx.status === 'active' && (rx.medicines || []).some(function(m){ return stockNameMatch(item.name, m.name); });
    });
    var rxInfo = matchingRx.length
      ? '<div style="font-size:11px;color:var(--teal);margin-top:2px">📋 In ' + matchingRx.length + ' active Rx · ' +
          matchingRx.slice(0,3).map(function(rx){ return escHtml(rx.patientName); }).join(', ') +
          (matchingRx.length > 3 ? ' +more' : '') + '</div>'
      : '';

    return '<tr style="border-bottom:1px solid var(--border);transition:background 0.12s" ' +
      'onmouseenter="this.style.background=\'var(--surface2)\'" onmouseleave="this.style.background=\'\'">' +
      '<td style="padding:10px 14px">' +
        '<div style="font-weight:600">' + escHtml(item.name) + '</div>' +
        '<div style="font-size:11.5px;color:var(--text-muted)">' + escHtml(item.unit||'') + '</div>' +
        rxInfo +
      '</td>' +
      '<td style="padding:10px 14px">' +
        (isVirtual ? '<span style="color:var(--text-muted);font-size:12px">—</span>'
          : '<span style="background:var(--bg);border:1px solid var(--border);padding:2px 8px;border-radius:8px;font-size:11.5px">' + escHtml(item.category||'General') + '</span>') +
      '</td>' +
      '<td style="padding:10px 14px;text-align:center">' + stockBadge + '</td>' +
      '<td style="padding:10px 14px;text-align:center;color:var(--text-muted)">' + (item.min_quantity||0) + '</td>' +
      '<td style="padding:10px 14px;text-align:right">' + (isVirtual ? '—' : '₹'+(item.unit_price||0).toLocaleString('en-IN')) + '</td>' +
      '<td style="padding:10px 14px;text-align:right;font-weight:600;color:var(--teal)">' + value + '</td>' +
      '<td style="padding:10px 14px;text-align:center;' + (expiryWarn?'color:var(--red);font-weight:600':'color:var(--text-muted)') + '">' + expiryLabel + (expiryWarn?' ⚠️':'') + '</td>' +
      '<td style="padding:10px 14px;text-align:center">' +
        (isVirtual
          ? '<button onclick="openAddStockItem({name:decodeURIComponent(this.dataset.name)})" data-name="'+encodeURIComponent(item.name)+'" style="font-size:11px;padding:4px 10px;border:1px solid var(--teal);border-radius:6px;background:var(--teal);color:#fff;cursor:pointer;font-weight:600">＋ Add to Stock</button>'
          : '<div style="display:flex;gap:6px;justify-content:center">' +
              '<button onclick="openAdjustStock(\''+item.id+'\')" style="font-size:11px;padding:4px 10px;border:1px solid var(--teal);border-radius:6px;background:transparent;color:var(--teal);cursor:pointer">± Adjust</button>' +
              '<button onclick="editStockItem(\''+item.id+'\')" style="font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--text-muted);cursor:pointer">✏️</button>' +
            '</div>') +
      '</td>' +
    '</tr>';
  }).join('');

  return banner +
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden">' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
    '<thead><tr style="background:var(--surface2)">' +
      '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Medicine</th>' +
      '<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Category</th>' +
      '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Stock</th>' +
      '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Min Level</th>' +
      '<th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Unit Price</th>' +
      '<th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Value</th>' +
      '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Expiry</th>' +
      '<th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Actions</th>' +
    '</tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>';
}

function openAddStockItem(item) {
  var overlay = document.getElementById('stockItemOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id='stockItemOverlay'; overlay.className='modal-overlay'; document.body.appendChild(overlay); }
  var isEdit = !!item;
  overlay.innerHTML =
    '<div class="modal" style="max-width:520px">' +
      '<div class="modal-header"><div><div class="modal-title">' + (isEdit ? '✏️ Edit' : '➕ Add') + ' Stock Item</div></div>' +
        '<button class="modal-close" onclick="closeOverlay(\'stockItemOverlay\')">✕</button></div>' +
      '<div class="modal-body">' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Medicine Name <span>*</span></label>' +
            '<input type="text" id="stkName" value="' + escAttr(item?.name||'') + '" placeholder="e.g. Paracetamol 500mg"></div>' +
          '<div class="field"><label>Category</label>' +
            '<select id="stkCategory">' +
              ['General','Antibiotic','Analgesic','Antacid','Antidiabetic','Cardiac','Ayurvedic','Homeopathic','Vitamin','Other'].map(function(c){ return '<option'+(c===(item?.category||'General')?' selected':'')+'>'+c+'</option>'; }).join('') +
            '</select></div>' +
        '</div>' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Current Quantity <span>*</span></label>' +
            '<input type="number" id="stkQty" value="' + (item?.quantity||0) + '" min="0"></div>' +
          '<div class="field"><label>Unit (tablet/ml/strip)</label>' +
            '<input type="text" id="stkUnit" value="' + escAttr(item?.unit||'tablets') + '" placeholder="tablets"></div>' +
        '</div>' +
        '<div class="form-row" style="margin-bottom:12px">' +
          '<div class="field"><label>Min Stock Level (alert threshold)</label>' +
            '<input type="number" id="stkMin" value="' + (item?.min_quantity||10) + '" min="0"></div>' +
          '<div class="field"><label>Unit Price (₹)</label>' +
            '<input type="number" id="stkPrice" value="' + (item?.unit_price||0) + '" min="0" step="0.01"></div>' +
        '</div>' +
        '<div class="form-row" style="margin-bottom:0">' +
          '<div class="field"><label>Batch Number</label>' +
            '<input type="text" id="stkBatch" value="' + escAttr(item?.batch_no||'') + '" placeholder="e.g. BT2024001"></div>' +
          '<div class="field"><label>Expiry Date</label>' +
            '<input type="date" id="stkExpiry" value="' + (item?.expiry_date||'') + '"></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="closeOverlay(\'stockItemOverlay\')">Cancel</button>' +
        '<button class="btn-sm btn-teal" onclick="saveStockItem(\'' + (item?.id||'') + '\')">💾 Save Item</button>' +
      '</div>' +
    '</div>';
  overlay.classList.add('open'); document.body.style.overflow = 'hidden';
}

async function saveStockItem(existingId) {
  var name = (document.getElementById('stkName')?.value||'').trim();
  if (!name) { showToast('Medicine name is required.','error'); return; }
  var item = {
    id:           existingId || ('stk_'+Date.now()+'_'+Math.random().toString(36).slice(2,5)),
    clinic_id:    activeClinicId,
    name,
    category:     document.getElementById('stkCategory')?.value    || 'General',
    quantity:     parseInt(document.getElementById('stkQty')?.value ||'0'),
    unit:         document.getElementById('stkUnit')?.value         || 'tablets',
    min_quantity: parseInt(document.getElementById('stkMin')?.value ||'10'),
    unit_price:   parseFloat(document.getElementById('stkPrice')?.value||'0'),
    batch_no:     document.getElementById('stkBatch')?.value        || '',
    expiry_date:  document.getElementById('stkExpiry')?.value       || null,
    updated_at:   new Date().toISOString()
  };
  var ok = await dbUpsertStock(item);
  if (!ok) { showToast('Failed to save item.','error'); return; }
  closeOverlay('stockItemOverlay');
  showToast('✅ ' + name + ' saved', 'success');
  await showStockView();
}

function editStockItem(id) {
  var item = stockItems.find(function(i){ return i.id === id; });
  if (item) openAddStockItem(item);
}

function openAdjustStock(id) {
  var item = stockItems.find(function(i){ return i.id === id; });
  if (!item) return;
  var overlay = document.getElementById('adjustStockOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id='adjustStockOverlay'; overlay.className='modal-overlay'; document.body.appendChild(overlay); }
  overlay.innerHTML =
    '<div class="modal" style="max-width:360px">' +
      '<div class="modal-header"><div><div class="modal-title">± Adjust Stock</div>' +
        '<div class="modal-subtitle">' + escHtml(item.name) + ' · Current: <strong>' + item.quantity + '</strong></div></div>' +
        '<button class="modal-close" onclick="closeOverlay(\'adjustStockOverlay\')">✕</button></div>' +
      '<div class="modal-body">' +
        '<div class="field" style="margin-bottom:12px"><label>Adjustment Type</label>' +
          '<div style="display:flex;gap:8px;margin-top:6px">' +
            '<label style="flex:1;display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);cursor:pointer">' +
              '<input type="radio" name="adjType" value="add" checked> ➕ Add Stock</label>' +
            '<label style="flex:1;display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);cursor:pointer">' +
              '<input type="radio" name="adjType" value="remove"> ➖ Remove</label>' +
          '</div></div>' +
        '<div class="field" style="margin-bottom:12px"><label>Quantity <span>*</span></label>' +
          '<input type="number" id="adjQty" placeholder="Enter quantity" min="1" style="font-size:16px;text-align:center"></div>' +
        '<div class="field" style="margin-bottom:0"><label>Reason</label>' +
          '<input type="text" id="adjReason" placeholder="e.g. New purchase, Dispensed, Expired…"></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="closeOverlay(\'adjustStockOverlay\')">Cancel</button>' +
        '<button class="btn-sm btn-teal" onclick="saveStockAdjustment(\'' + id + '\',' + item.quantity + ')">✅ Apply</button>' +
      '</div>' +
    '</div>';
  overlay.classList.add('open'); document.body.style.overflow = 'hidden';
  setTimeout(function(){ document.getElementById('adjQty')?.focus(); }, 100);
}

async function saveStockAdjustment(id, currentQty) {
  var qty    = parseInt(document.getElementById('adjQty')?.value||'0');
  var type   = document.querySelector('input[name="adjType"]:checked')?.value || 'add';
  if (!qty || qty <= 0) { showToast('Enter a valid quantity.','error'); return; }
  var newQty = type === 'add' ? currentQty + qty : Math.max(0, currentQty - qty);
  var item   = stockItems.find(function(i){ return i.id === id; });
  if (!item) return;
  item.quantity  = newQty;
  item.updated_at = new Date().toISOString();
  var ok = await dbUpsertStock(item);
  if (!ok) { showToast('Failed to update.','error'); return; }
  closeOverlay('adjustStockOverlay');
  showToast((type==='add'?'➕ Added ':'➖ Removed ') + qty + ' units · New stock: ' + newQty, 'success');
  if (newQty <= item.min_quantity) showToast('⚠️ ' + item.name + ' is now below minimum stock level!', 'error');
  await showStockView();
}

async function deleteStockItem(id) {
  var item = stockItems.find(function(i){ return i.id === id; });
  if (!item || !confirm('Delete ' + item.name + ' from inventory?')) return;
  await db.from('stock_items').delete().eq('id', id);
  showToast('Deleted ' + item.name, 'info');
  await showStockView();
}

// Auto-deduct from stock when prescription is dispensed
async function deductStockForRx(rx) {
  if (!rx.medicines || !rx.medicines.length) return;
  for (var i = 0; i < rx.medicines.length; i++) {
    var med = rx.medicines[i];
    var stockItem = stockItems.find(function(s){
      return (s.name||'').toLowerCase().includes((med.name||'').toLowerCase().split(' ')[0]);
    });
    if (stockItem && stockItem.quantity > 0) {
      stockItem.quantity = Math.max(0, stockItem.quantity - 1);
      await dbUpsertStock(stockItem);
    }
  }
}

// ─── Stock DB helpers ─────────────────────────────────────
async function dbGetStock(clinicId) {
  var { data, error } = await db.from('stock_items').select('*').eq('clinic_id', clinicId).order('name');
  if (error) { console.error('[Stock]', error); return []; }
  return data || [];
}
async function dbUpsertStock(item) {
  var { error } = await db.from('stock_items').upsert(item, { onConflict:'id' });
  if (error) { console.error('[Stock upsert]', error); return false; }
  return true;
}

// ════════════════════════════════════════════════════════════
//  MODULE 2: PRESCRIPTION QR CODE
// ════════════════════════════════════════════════════════════

function showPrescriptionQR(rxId) {
  var rx = prescriptions.find(function(x){ return x.id === rxId; });
  if (!rx) return;

  var overlay = document.getElementById('qrOverlay');
  if (!overlay) { overlay = document.createElement('div'); overlay.id='qrOverlay'; overlay.className='modal-overlay'; document.body.appendChild(overlay); }

  // QR data payload — compact JSON of the prescription
  var qrData = JSON.stringify({
    id:      rx.id,
    patient: rx.patientName,
    doctor:  rx.doctorName,
    date:    rx.date,
    valid:   rx.validUntil,
    diag:    rx.diagnosis,
    meds:    (rx.medicines||[]).map(function(m){ return m.name + (m.dosage?' '+m.dosage:''); }),
    clinic:  activeClinicId
  });

  var encodedData = encodeURIComponent(qrData);
  // Use Google Charts QR API (no key needed, free)
  var qrUrl = 'https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=' + encodedData + '&choe=UTF-8';

  overlay.innerHTML =
    '<div class="modal" style="max-width:420px;text-align:center">' +
      '<div class="modal-header">' +
        '<div><div class="modal-title">📱 Prescription QR Code</div>' +
          '<div class="modal-subtitle">' + escHtml(rx.patientName) + ' · ' + formatDate(rx.date) + '</div></div>' +
        '<button class="modal-close" onclick="closeOverlay(\'qrOverlay\')">✕</button>' +
      '</div>' +
      '<div class="modal-body" style="display:flex;flex-direction:column;align-items:center;gap:16px">' +
        // QR Code
        '<div style="background:#fff;padding:16px;border-radius:12px;border:2px solid var(--border);display:inline-block">' +
          '<img src="' + qrUrl + '" width="240" height="240" alt="QR Code" style="display:block" ' +
            'onerror="this.parentElement.innerHTML=\'<div style=&quot;width:240px;height:240px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;text-align:center&quot;>QR unavailable offline</div>\'">' +
        '</div>' +

        // Prescription summary
        '<div style="background:var(--surface2);border-radius:var(--radius-lg);padding:14px 18px;width:100%;text-align:left;font-size:13px">' +
          '<div style="font-weight:700;margin-bottom:8px;font-size:14px">📋 ' + escHtml(rx.patientName) + '</div>' +
          '<div style="color:var(--text-secondary);line-height:1.8">' +
            '🩺 Dr. ' + escHtml(rx.doctorName||'—') + '<br>' +
            '🔬 ' + escHtml(rx.diagnosis||'—') + '<br>' +
            '📅 Valid: ' + formatDate(rx.validUntil||rx.date) + '<br>' +
            '💊 ' + (rx.medicines||[]).slice(0,3).map(function(m){ return escHtml(m.name); }).join(', ') +
              (rx.medicines&&rx.medicines.length>3 ? ' +more' : '') +
          '</div>' +
        '</div>' +

        '<div style="font-size:12px;color:var(--text-muted);line-height:1.6">Scan to view complete prescription details.<br>Generated by Rx Vault Medical Record Manager.</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="downloadQR(\'' + rxId + '\')">⬇️ Download</button>' +
        '<button class="btn-sm btn-teal" onclick="printQR(\'' + rxId + '\')">🖨️ Print</button>' +
      '</div>' +
    '</div>';

  overlay.classList.add('open'); document.body.style.overflow = 'hidden';
}

function downloadQR(rxId) {
  var rx  = prescriptions.find(function(x){ return x.id === rxId; });
  var img = document.querySelector('#qrOverlay img');
  if (!img || !rx) return;
  var a   = document.createElement('a');
  a.href  = img.src;
  a.download = 'rx_qr_' + (rx.patientName||'patient').replace(/\s+/g,'_') + '_' + rx.date + '.png';
  a.click();
}

function printQR(rxId) {
  var rx  = prescriptions.find(function(x){ return x.id === rxId; });
  var img = document.querySelector('#qrOverlay img');
  if (!rx || !img) return;
  var clinic = getActiveClinic();
  var html = '<!DOCTYPE html><html><head><title>Rx QR — ' + escHtml(rx.patientName) + '</title>' +
    '<style>body{font-family:DM Sans,sans-serif;padding:24px;text-align:center}' +
    'h2{font-family:Georgia,serif;color:#0f2240;font-size:18px;margin-bottom:4px}' +
    '.info{font-size:13px;color:#555;line-height:1.8;margin-top:12px;text-align:left;display:inline-block}' +
    '@media print{body{padding:0}}</style></head>' +
    '<body onload="window.print()">' +
    '<div style="font-size:22px;margin-bottom:6px">💊 Rx Vault</div>' +
    (clinic ? '<div style="font-size:12px;color:#888;margin-bottom:16px">' + escHtml(clinic.name) + '</div>' : '') +
    '<img src="' + img.src + '" width="220" height="220" style="border:2px solid #eee;padding:12px;border-radius:8px">' +
    '<div class="info">' +
      '<strong>' + escHtml(rx.patientName) + '</strong><br>' +
      '🩺 Dr. ' + escHtml(rx.doctorName||'—') + '<br>' +
      '📅 ' + formatDate(rx.date) + (rx.validUntil ? ' · Valid till ' + formatDate(rx.validUntil) : '') + '<br>' +
      '🔬 ' + escHtml(rx.diagnosis||'—') + '<br>' +
      (rx.medicines&&rx.medicines.length ? '💊 ' + rx.medicines.map(function(m){return m.name;}).join(', ') : '') +
    '</div>' +
    '<div style="font-size:11px;color:#aaa;margin-top:20px;border-top:1px solid #eee;padding-top:10px">Rx Vault · ' + new Date().toLocaleDateString('en-IN') + '</div>' +
    '</body></html>';
  var w = window.open('','_blank'); w.document.write(html); w.document.close();
}


// ─── Shared stat card helper (used by both stock and analytics) ──
function statCard(icon, value, label, bg, clr) {
  return '<div style="background:'+bg+';border:1px solid var(--border);border-radius:var(--radius-lg);padding:12px 18px;display:flex;align-items:center;gap:10px;flex:1;min-width:110px">' +
    '<div style="font-size:22px">'+icon+'</div>' +
    '<div><div style="font-size:20px;font-weight:700;color:'+clr+';font-family:\'DM Serif Display\',serif">'+value+'</div>' +
    '<div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em">'+label+'</div></div>' +
  '</div>';
}

// ─── Patch renderCard to add 📱 QR button ────────────────────
document.addEventListener('DOMContentLoaded', function() {
  if (typeof renderCard === 'function') {
    var _origRenderCard = renderCard;
    renderCard = function(p, q, allTerms) {
      var html = _origRenderCard(p, q, allTerms);
      return html.replace(
        '<button class="icon-btn print"',
        '<button class="icon-btn" title="QR Code" onclick="event.stopPropagation();showPrescriptionQR(\'' + p.id + '\')" style="font-size:14px">📱</button>' +
        '<button class="icon-btn print"'
      );
    };
  }
});