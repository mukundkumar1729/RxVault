// ════════════════════════════════════════════════════════════
//  AI.JS — Find Similar Cases / Fuzzy Search Panel
//  Injected into #aiSearchPanel below the main controls bar.
//  Uses the Claude API proxy for AI-powered case matching.
// ════════════════════════════════════════════════════════════

var AI_PROXY_URL = 'https://wavakcolrtrwmjcjkdfc.supabase.co/functions/v1/claude-proxy';

function initAiSearchPanel() {
  var panel = document.getElementById('aiSearchPanel');
  if (!panel) return;

  panel.innerHTML =
    '<div style="' +
      'background:linear-gradient(135deg,var(--surface) 0%,var(--surface2) 100%);' +
      'border:1px solid var(--border);' +
      'border-radius:var(--radius-lg);' +
      'margin-bottom:14px;' +
      'overflow:hidden;' +
    '">' +

      // ── Header bar (always visible, click to expand) ──
      '<div id="aiPanelHeader" onclick="toggleAiPanel()" style="' +
        'display:flex;align-items:center;gap:10px;padding:11px 16px;cursor:pointer;' +
        'border-bottom:1px solid transparent;transition:border-color 0.2s;user-select:none;' +
      '" onmouseenter="this.style.background=\'var(--bg)\'" onmouseleave="this.style.background=\'\'">' +
        '<div style="' +
          'width:28px;height:28px;border-radius:8px;' +
          'background:linear-gradient(135deg,var(--homeopathy) 0%,var(--teal) 100%);' +
          'display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;' +
        '">🔍</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:6px">' +
            'Find Similar Cases' +
            '<span style="background:var(--teal-pale);color:var(--teal);font-size:9px;font-weight:700;' +
              'padding:1px 6px;border-radius:8px;letter-spacing:.06em;text-transform:uppercase">AI</span>' +
          '</div>' +
          '<div id="aiPanelSubtitle" style="font-size:11.5px;color:var(--text-muted);margin-top:1px">' +
            'Search by symptom, diagnosis or patient name across all records' +
          '</div>' +
        '</div>' +
        '<div id="aiPanelChevron" style="font-size:10px;color:var(--text-muted);transition:transform 0.22s;flex-shrink:0">▼</div>' +
      '</div>' +

      // ── Expandable body ──
      '<div id="aiPanelBody" style="overflow:hidden;max-height:0;transition:max-height 0.3s cubic-bezier(0.4,0,0.2,1)">' +
        '<div style="padding:14px 16px">' +

          // Search input row
          '<div style="display:flex;gap:8px;margin-bottom:10px">' +
            '<div style="flex:1;position:relative">' +
              '<span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:14px;pointer-events:none">🩺</span>' +
              '<input type="text" id="aiSearchInput"' +
                ' placeholder="e.g. Fever with chills, Hypertension, Diabetic patient…"' +
                ' onkeydown="if(event.key===\'Enter\')runAiSearch()"' +
                ' style="' +
                  'width:100%;padding:9px 12px 9px 34px;' +
                  'border:1.5px solid var(--border);border-radius:var(--radius);' +
                  'font-size:13px;font-family:DM Sans,sans-serif;' +
                  'background:var(--surface);color:var(--text-primary);' +
                  'box-sizing:border-box;outline:none;transition:border-color 0.15s;' +
                '"' +
                ' onfocus="this.style.borderColor=\'var(--teal)\'"' +
                ' onblur="this.style.borderColor=\'var(--border)\'">' +
            '</div>' +
            '<button onclick="runAiSearch()" id="aiSearchBtn"' +
              ' style="' +
                'padding:9px 18px;background:var(--teal);color:#fff;' +
                'border:none;border-radius:var(--radius);font-size:13px;font-weight:600;' +
                'font-family:DM Sans,sans-serif;cursor:pointer;white-space:nowrap;' +
                'transition:opacity 0.15s;' +
              '"' +
              ' onmouseenter="this.style.opacity=\'0.9\'" onmouseleave="this.style.opacity=\'1\'">' +
              '🔍 Search' +
            '</button>' +
            '<button onclick="clearAiSearch()"' +
              ' style="' +
                'padding:9px 12px;background:transparent;' +
                'border:1px solid var(--border);border-radius:var(--radius);' +
                'font-size:12px;color:var(--text-muted);cursor:pointer;white-space:nowrap;' +
                'font-family:DM Sans,sans-serif;transition:border-color 0.15s;' +
              '"' +
              ' onmouseenter="this.style.borderColor=\'var(--border2)\'" onmouseleave="this.style.borderColor=\'var(--border)\'">' +
              '✕ Clear' +
            '</button>' +
          '</div>' +

          // Quick chips
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">' +
            '<span style="font-size:11px;color:var(--text-muted);align-self:center;flex-shrink:0">Quick:</span>' +
            ['Fever & chills','Diabetes management','Hypertension','URTI','Thyroid disorder',
             'Chest pain','Asthma','UTI','Dengue','Skin infection'].map(function(q) {
              return '<button onclick="document.getElementById(\'aiSearchInput\').value=\'' + q + '\';runAiSearch()" ' +
                'style="font-size:11px;padding:3px 10px;border:1px solid var(--border);' +
                'border-radius:16px;background:var(--surface2);color:var(--text-secondary);' +
                'cursor:pointer;font-family:DM Sans,sans-serif;transition:all 0.12s" ' +
                'onmouseenter="this.style.background=\'var(--teal-pale)\';this.style.borderColor=\'var(--teal)\';this.style.color=\'var(--teal)\'" ' +
                'onmouseleave="this.style.background=\'var(--surface2)\';this.style.borderColor=\'var(--border)\';this.style.color=\'var(--text-secondary)\'">' +
                q + '</button>';
            }).join('') +
          '</div>' +

        '</div>' +

        // Results area
        '<div id="aiSearchResults"></div>' +

      '</div>' + // end body
    '</div>';   // end card
}

// ─── Toggle expand / collapse ─────────────────────────────
var _aiPanelOpen = false;
function toggleAiPanel() {
  _aiPanelOpen = !_aiPanelOpen;
  var body    = document.getElementById('aiPanelBody');
  var chevron = document.getElementById('aiPanelChevron');
  var header  = document.getElementById('aiPanelHeader');
  if (body)    body.style.maxHeight    = _aiPanelOpen ? '600px' : '0';
  if (chevron) chevron.style.transform = _aiPanelOpen ? 'rotate(180deg)' : '';
  if (header)  header.style.borderBottomColor = _aiPanelOpen ? 'var(--border)' : 'transparent';
  if (_aiPanelOpen) setTimeout(function(){ document.getElementById('aiSearchInput')?.focus(); }, 320);
}

// ─── Run search ───────────────────────────────────────────
async function runAiSearch() {
  var query = (document.getElementById('aiSearchInput')?.value || '').trim();
  if (!query) return;

  var resultsEl = document.getElementById('aiSearchResults');
  var btn       = document.getElementById('aiSearchBtn');
  if (!resultsEl) return;

  // Update subtitle
  var sub = document.getElementById('aiPanelSubtitle');
  if (sub) sub.textContent = 'Searching for: "' + query + '"…';

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Searching…'; }

  resultsEl.innerHTML =
    '<div style="padding:16px 16px 8px;display:flex;align-items:center;gap:10px;color:var(--text-muted);font-size:13px">' +
      '<div style="width:16px;height:16px;border:2px solid var(--teal);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite"></div>' +
      'Finding matching records…' +
    '</div>' +
    '<style>@keyframes spin{to{transform:rotate(360deg)}}</style>';

  // 1) Client-side fuzzy filter (instant, no API needed)
  var qLow    = query.toLowerCase();
  var terms   = qLow.split(/\s+/).filter(function(t){ return t.length > 2; });
  var matched = (typeof prescriptions !== 'undefined' ? prescriptions : []).filter(function(rx) {
    var haystack = [rx.patientName, rx.diagnosis, rx.notes, rx.doctorName,
      (rx.medicines||[]).map(function(m){ return m.name; }).join(' ')].join(' ').toLowerCase();
    return terms.some(function(t){ return haystack.includes(t); }) || haystack.includes(qLow);
  });

  // Sort by match score (more term hits = higher)
  matched.sort(function(a, b) {
    var scoreA = terms.filter(function(t){ return [a.patientName,a.diagnosis,a.notes].join(' ').toLowerCase().includes(t); }).length;
    var scoreB = terms.filter(function(t){ return [b.patientName,b.diagnosis,b.notes].join(' ').toLowerCase().includes(t); }).length;
    return scoreB - scoreA;
  });

  renderAiResults(matched, query);

  // 2) AI summary for the top hits (background)
  if (matched.length > 0) {
    try {
      var topCases = matched.slice(0,5).map(function(rx) {
        return '• ' + (rx.patientName||'?') + ', ' + (rx.date||'') + ': ' +
          (rx.diagnosis||'No diagnosis') + '. Medicines: ' +
          (rx.medicines||[]).map(function(m){ return m.name; }).slice(0,3).join(', ');
      }).join('\n');

      var resp = await fetch(AI_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 250,
          messages: [{
            role: 'user',
            content: 'You are a clinical assistant. The doctor searched for "' + query + '" and found these cases:\n\n' +
              topCases + '\n\n' +
              'In 2-3 sentences: what is the common clinical pattern? Any notable differences? ' +
              'Keep it concise and clinically relevant. No disclaimers.'
          }]
        })
      });
      var data   = await resp.json();
      var insight = (data.content||[]).map(function(b){ return b.text||''; }).join('').trim();
      if (insight) {
        var insightEl = document.getElementById('aiInsightBox');
        if (insightEl) {
          insightEl.innerHTML =
            '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;' +
              'color:var(--teal);margin-bottom:5px">🤖 AI Pattern Insight</div>' +
            '<div style="font-size:12.5px;color:var(--text-primary);line-height:1.6">' + escHtml(insight) + '</div>';
          insightEl.style.display = '';
        }
      }
    } catch(e) { /* fail silently — fuzzy results already shown */ }
  }

  if (btn) { btn.disabled = false; btn.textContent = '🔍 Search'; }
  if (sub) sub.textContent = matched.length + ' record' + (matched.length !== 1 ? 's' : '') + ' found for "' + query + '"';
}

function renderAiResults(matched, query) {
  var resultsEl = document.getElementById('aiSearchResults');
  if (!resultsEl) return;

  if (!matched.length) {
    resultsEl.innerHTML =
      '<div style="padding:16px 16px 20px;text-align:center">' +
        '<div style="font-size:28px;margin-bottom:8px">🔍</div>' +
        '<div style="font-size:13px;font-weight:600;color:var(--text-secondary)">No matching records found</div>' +
        '<div style="font-size:12px;color:var(--text-muted);margin-top:4px">Try different keywords or check spelling</div>' +
      '</div>';
    return;
  }

  var typeIcon = { allopathy:'💉', homeopathy:'🌿', ayurveda:'🌱' };
  var typeBg   = { allopathy:'var(--allopathy-bg)', homeopathy:'var(--homeopathy-bg)', ayurveda:'var(--ayurveda-bg)' };
  var typeClr  = { allopathy:'var(--allopathy)',    homeopathy:'var(--homeopathy)',    ayurveda:'var(--ayurveda)' };

  function highlight(text, query) {
    if (!text) return '—';
    var escaped = escHtml(text);
    var terms   = query.toLowerCase().split(/\s+/).filter(function(t){ return t.length > 2; });
    terms.forEach(function(t) {
      var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      escaped = escaped.replace(re, '<mark style="background:var(--teal-pale);color:var(--teal);border-radius:2px;padding:0 1px">$1</mark>');
    });
    return escaped;
  }

  resultsEl.innerHTML =
    // AI insight box (populated async above)
    '<div id="aiInsightBox" style="display:none;margin:0 16px 10px;background:var(--teal-pale);' +
      'border:1px solid rgba(10,124,110,0.2);border-radius:var(--radius);padding:10px 14px"></div>' +

    // Count bar
    '<div style="padding:8px 16px 6px;display:flex;align-items:center;justify-content:space-between">' +
      '<span style="font-size:12px;font-weight:700;color:var(--text-secondary)">' +
        matched.length + ' record' + (matched.length !== 1 ? 's' : '') + ' matched' +
      '</span>' +
      '<span style="font-size:11px;color:var(--text-muted)">Sorted by relevance</span>' +
    '</div>' +

    // Result rows
    '<div style="padding:0 10px 12px;display:flex;flex-direction:column;gap:6px">' +
    matched.slice(0, 10).map(function(rx) {
      var icon = typeIcon[rx.type]||'💊';
      var bg   = typeBg[rx.type]||'var(--surface2)';
      var clr  = typeClr[rx.type]||'var(--text-muted)';
      var meds = (rx.medicines||[]).slice(0,3).map(function(m){ return m.name; }).join(', ');
      return '<div onclick="scrollToRx(\'' + rx.id + '\')" style="' +
        'background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);' +
        'padding:10px 14px;cursor:pointer;transition:all 0.15s;' +
      '" onmouseenter="this.style.borderColor=\'var(--teal)\';this.style.background=\'var(--teal-pale)\'" ' +
         'onmouseleave="this.style.borderColor=\'var(--border)\';this.style.background=\'var(--surface)\'">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<span style="background:' + bg + ';color:' + clr + ';font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px">' + icon + ' ' + (rx.type||'').toUpperCase() + '</span>' +
          '<span style="font-weight:700;font-size:13px">' + highlight(rx.patientName, query) + '</span>' +
          '<span style="font-size:11.5px;color:var(--text-muted)">📅 ' + escHtml(rx.date||'') + '</span>' +
          (rx.status === 'active' ? '<span style="background:#e8f5e9;color:var(--green);font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px">Active</span>' : '') +
        '</div>' +
        '<div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px">' +
          '🔬 ' + highlight(rx.diagnosis||'No diagnosis', query) +
          (rx.doctorName ? ' &nbsp;·&nbsp; 🩺 Dr. ' + escHtml(rx.doctorName) : '') +
        '</div>' +
        (meds ? '<div style="font-size:11.5px;color:var(--text-muted);margin-top:3px">💊 ' + escHtml(meds) + (rx.medicines.length > 3 ? ' +' + (rx.medicines.length-3) + ' more' : '') + '</div>' : '') +
      '</div>';
    }).join('') +
    (matched.length > 10
      ? '<div style="text-align:center;padding:8px;font-size:12px;color:var(--text-muted)">' +
          '…and ' + (matched.length-10) + ' more records. Refine your search to narrow results.</div>'
      : '') +
    '</div>';
}

function scrollToRx(rxId) {
  clearAiSearch();
  // Apply a filter that shows just this record
  var rx = (typeof prescriptions !== 'undefined' ? prescriptions : []).find(function(r){ return r.id === rxId; });
  if (!rx) return;
  if (typeof setView === 'function') setView('all');
  setTimeout(function() {
    var card = document.querySelector('[data-rxid="' + rxId + '"]') || document.getElementById('rx_' + rxId);
    if (card) {
      card.scrollIntoView({ behavior:'smooth', block:'center' });
      card.style.outline = '2px solid var(--teal)';
      card.style.outlineOffset = '2px';
      setTimeout(function(){ card.style.outline = ''; card.style.outlineOffset = ''; }, 2500);
    } else {
      // Fallback: filter by patient name
      var inp = document.getElementById('srchPatient');
      if (inp) { inp.value = rx.patientName; if (typeof applyFilters === 'function') applyFilters(); }
    }
  }, 100);
}

function clearAiSearch() {
  var inp = document.getElementById('aiSearchInput');
  if (inp) inp.value = '';
  var res = document.getElementById('aiSearchResults');
  if (res) res.innerHTML = '';
  var sub = document.getElementById('aiPanelSubtitle');
  if (sub) sub.textContent = 'Search by symptom, diagnosis or patient name across all records';
  // Collapse panel
  if (_aiPanelOpen) toggleAiPanel();
}