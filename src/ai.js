// ═══════════════════════════════════════════════════════════
//  AI SEARCH MODULE — Rx Vault
//  Free tier:    pg_trgm fuzzy search (always available)
//  Premium tier: Gemini embeddings + pgvector semantic search
// ═══════════════════════════════════════════════════════════

// ─── Plan detection ──────────────────────────────────────
function isPremiumClinic() {
  const clinic = getActiveClinic();
  return clinic && clinic.plan === 'premium' && clinic.geminiKey;
}

function getGeminiKey() {
  return getActiveClinic()?.geminiKey || '';
}

// ═══════════════════════════════════════════════════════════
//  GEMINI EMBEDDING (Premium only)
//  Uses text-embedding-004 — 768 dimensions, free 1500/day
// ═══════════════════════════════════════════════════════════
async function generateEmbedding(text) {
  const key = getGeminiKey();
  if (!key) throw new Error('No Gemini API key configured.');

  const cleanText = text.replace(/\s+/g, ' ').trim().slice(0, 2000);
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=' + key;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: { parts: [{ text: cleanText }] }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error('Gemini API error: ' + (err && err.error && err.error.message ? err.error.message : res.status));
  }

  const data = await res.json();
  return data?.embedding?.values || null;
}

// ─── Build search text from a prescription ───────────────
function rxToSearchText(rx) {
  const parts = [
    rx.diagnosis     || '',
    rx.notes         || '',
    rx.patientName   || '',
    (rx.medicines || []).map(m => m.name).join(' '),
  ];
  return parts.filter(Boolean).join(' ').trim();
}

// ─── Store embedding for a saved prescription ────────────
async function storeEmbeddingForRx(rx) {
  if (!isPremiumClinic()) return;
  try {
    const text = rxToSearchText(rx);
    if (!text) return;
    const embedding = await generateEmbedding(text);
    if (!embedding) return;
    await dbStoreEmbedding(rx.id, embedding);
  } catch (e) {
    console.warn('[AI] Embedding generation failed (non-fatal):', e.message);
  }
}

// ═══════════════════════════════════════════════════════════
//  SEARCH DISPATCHER
//  Automatically picks semantic (premium) or fuzzy (free)
// ═══════════════════════════════════════════════════════════
async function aiSearch(query) {
  if (!query || query.trim().length < 2) return [];

  if (isPremiumClinic()) {
    return searchSemantic(query);
  } else {
    return searchFuzzy(query);
  }
}

// ─── FREE: pg_trgm fuzzy search ──────────────────────────
async function searchFuzzy(query) {
  try {
    const results = await dbSearchFuzzy(query.trim(), activeClinicId);
    return results.map(r => ({
      ...dbToRx(r),
      similarity: r.similarity,
      searchMode: 'fuzzy'
    }));
  } catch (e) {
    console.error('[AI] Fuzzy search error:', e);
    return [];
  }
}

// ─── PREMIUM: Gemini embedding + pgvector ────────────────
async function searchSemantic(query) {
  try {
    const embedding = await generateEmbedding(query);
    if (!embedding) return searchFuzzy(query); // fallback
    const results = await dbSearchSemantic(embedding, activeClinicId);
    return results.map(r => ({
      ...dbToRx(r),
      similarity: r.similarity,
      searchMode: 'semantic'
    }));
  } catch (e) {
    console.warn('[AI] Semantic search failed, falling back to fuzzy:', e.message);
    return searchFuzzy(query); // graceful fallback
  }
}

// ═══════════════════════════════════════════════════════════
//  SIMILAR CASES UI
// ═══════════════════════════════════════════════════════════
let aiSearchDebounce = null;
let lastAiQuery = '';

function initAiSearchPanel() {
  renderAiSearchPanel();
}

function renderAiSearchPanel() {
  var container = document.getElementById('aiSearchPanel');
  if (!container) return;
  var isPremium  = isPremiumClinic();
  var modeCls    = isPremium ? 'ai-mode-premium' : 'ai-mode-free';
  var modeLabel  = isPremium ? '✨ Semantic AI'  : '⚡ Fuzzy Search';
  var hint       = isPremium
    ? 'Searches by meaning — "stomach pain" matches "abdominal discomfort"'
    : 'Fuzzy text search across diagnosis, notes and patient name';

  container.innerHTML =
    '<div class="ai-search-wrap">' +
      '<div class="ai-search-header">' +
        '<div class="ai-search-title">' +
          '<span class="ai-search-icon">🔍</span>' +
          '<span>Find Similar Cases</span>' +
          '<span class="ai-mode-badge ' + modeCls + '">' + modeLabel + '</span>' +
        '</div>' +
        '<div class="ai-search-hint">' + hint + '</div>' +
      '</div>' +
      '<div class="ai-search-input-row">' +
        '<div class="ai-search-input-wrap">' +
          '<span class="ai-search-input-icon">🩺</span>' +
          '<input type="text" id="aiSearchInput" class="ai-search-input"' +
            ' placeholder="Type symptoms or diagnosis… e.g. fever with chills"' +
            ' oninput="onAiSearchInput(this.value)" autocomplete="off">' +
          '<button class="ai-search-clear-btn" id="aiSearchClearBtn"' +
            ' onclick="clearAiSearch()" style="display:none">✕</button>' +
        '</div>' +
        '<button class="ai-search-btn" onclick="runAiSearch()">' +
          '<span id="aiSearchBtnIcon">🔍</span> Search' +
        '</button>' +
      '</div>' +
      '<div id="aiSearchResults" class="ai-search-results"></div>' +
    '</div>';
}

function onAiSearchInput(val) {
  const clearBtn = document.getElementById('aiSearchClearBtn');
  if (clearBtn) clearBtn.style.display = val ? '' : 'none';
  clearTimeout(aiSearchDebounce);
  if (!val || val.trim().length < 3) {
    document.getElementById('aiSearchResults').innerHTML = '';
    return;
  }
  aiSearchDebounce = setTimeout(() => runAiSearch(), 600);
}

async function runAiSearch() {
  const input = document.getElementById('aiSearchInput');
  const query = input ? input.value.trim() : '';
  if (!query || query.length < 2) return;
  if (query === lastAiQuery) return;
  lastAiQuery = query;

  const resultsEl = document.getElementById('aiSearchResults');
  const btnIcon   = document.getElementById('aiSearchBtnIcon');

  // Show loading state
  var loadTxt = isPremiumClinic() ? 'Generating semantic embedding…' : 'Searching records…';
  resultsEl.innerHTML =
    '<div class="ai-search-loading">' +
      '<div class="ai-search-spinner"></div>' +
      '<span>' + loadTxt + '</span>' +
    '</div>';
  if (btnIcon) btnIcon.textContent = '⏳';

  const results = await aiSearch(query);
  if (btnIcon) btnIcon.textContent = '🔍';

  if (!results.length) {
    resultsEl.innerHTML =
      '<div class="ai-search-empty">' +
        '<div class="ai-search-empty-icon">🔎</div>' +
        '<div>No similar cases found for "<strong>' + escHtml(query) + '</strong>"</div>' +
        '<div class="ai-search-empty-hint">Try different keywords or shorter terms</div>' +
      '</div>';
    return;
  }

  var modeLabel = (results[0] && results[0].searchMode === 'semantic') ? 'semantic similarity' : 'fuzzy match';
  var plural    = results.length > 1 ? 's' : '';
  resultsEl.innerHTML =
    '<div class="ai-results-header">' +
      'Found <strong>' + results.length + '</strong> similar case' + plural +
      ' <span class="ai-results-mode">via ' + modeLabel + '</span>' +
    '</div>' +
    '<div class="ai-results-list">' +
      results.map(function(r){ return renderAiResult(r, query); }).join('') +
    '</div>';
}

function renderAiResult(r, query) {
  var pct  = Math.round((r.similarity || 0) * 100);
  var bar  = Math.min(pct, 100);
  var clr  = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--teal)' : 'var(--text-muted)';
  var typeLabel = { allopathy: '💉', homeopathy: '🌿', ayurveda: '🌱' };
  var statusClr = { active: 'var(--green)', completed: 'var(--text-muted)', expired: 'var(--red)' };
  var meds = (r.medicines || []).slice(0, 3).map(function(m){ return escHtml(m.name); }).join(', ');
  var medsMore = r.medicines && r.medicines.length > 3 ? ' +' + (r.medicines.length - 3) + ' more' : '';
  var sClr = statusClr[r.status] || 'var(--text-muted)';
  var clickJs = "toggleCard('" + r.id + "');var el=document.getElementById('card_" + r.id + "');if(el)el.scrollIntoView({behavior:'smooth',block:'center'})";

  return (
    '<div class="ai-result-card" onclick="' + clickJs + '">' +
      '<div class="ai-result-top">' +
        '<div class="ai-result-patient">' +
          '<span class="ai-result-type">' + (typeLabel[r.type] || '🩺') + '</span>' +
          '<strong>' + escHtml(r.patientName) + '</strong>' +
          '<span class="ai-result-date">' + formatDate(r.date) + '</span>' +
        '</div>' +
        '<div class="ai-result-score" title="Match score">' +
          '<div class="ai-score-bar-wrap">' +
            '<div class="ai-score-bar" style="width:' + bar + '%;background:' + clr + '"></div>' +
          '</div>' +
          '<span class="ai-score-pct" style="color:' + clr + '">' + pct + '%</span>' +
        '</div>' +
      '</div>' +
      '<div class="ai-result-diag">' + escHtml(r.diagnosis || '—') + '</div>' +
      (meds ? '<div class="ai-result-meds">💊 ' + meds + medsMore + '</div>' : '') +
      '<div class="ai-result-footer">' +
        '<span>🩺 ' + escHtml(r.doctorName || '—') + '</span>' +
        '<span style="color:' + sClr + '">● ' + capitalize(r.status || '') + '</span>' +
        '<span class="ai-result-view">View record →</span>' +
      '</div>' +
    '</div>'
  );
}

function clearAiSearch() {
  const input = document.getElementById('aiSearchInput');
  if (input) input.value = '';
  const clearBtn = document.getElementById('aiSearchClearBtn');
  if (clearBtn) clearBtn.style.display = 'none';
  const resultsEl = document.getElementById('aiSearchResults');
  if (resultsEl) resultsEl.innerHTML = '';
  lastAiQuery = '';
}

// ═══════════════════════════════════════════════════════════
//  PREMIUM UPGRADE UI (shown in admin panel)
// ═══════════════════════════════════════════════════════════
function renderPremiumUpgradeSection() {
  var clinic = getActiveClinic();
  if (!clinic) return '';
  var isPremium = clinic.plan === 'premium';

  if (isPremium) {
    return (
      '<div class="premium-status-row">' +
        '<span class="premium-badge">✨ Premium Active</span>' +
        '<span style="font-size:12px;color:var(--text-muted)">Semantic AI search enabled</span>' +
        '<button class="btn-sm btn-outline-teal" style="margin-left:auto;font-size:11px" onclick="openGeminiKeyModal()">🔑 Update API Key</button>' +
      '</div>'
    );
  }

  return (
    '<div class="premium-upgrade-box">' +
      '<div class="premium-upgrade-header">' +
        '<span class="premium-upgrade-icon">✨</span>' +
        '<div>' +
          '<div class="premium-upgrade-title">Upgrade to Semantic AI Search</div>' +
          '<div class="premium-upgrade-sub">Find similar cases by meaning, not just keywords</div>' +
        '</div>' +
      '</div>' +
      '<ul class="premium-upgrade-list">' +
        '<li>✅ "Stomach pain after eating" matches "post-meal gastric discomfort"</li>' +
        '<li>✅ Understands medical synonyms and related terms</li>' +
        '<li>✅ Powered by Google Gemini — 1,500 free searches/day</li>' +
        '<li>✅ Requires your free Gemini API key</li>' +
      '</ul>' +
      '<div class="premium-upgrade-actions">' +
        '<a href="https://aistudio.google.com/app/apikey" target="_blank" class="btn-sm btn-outline-teal">🔑 Get Free Gemini Key</a>' +
        '<button class="btn-sm btn-teal" onclick="openGeminiKeyModal()">✨ Enable Premium</button>' +
      '</div>' +
    '</div>'
  );
}

function openGeminiKeyModal() {
  const clinic = getActiveClinic();
  if (!clinic) return;
  const existing = clinic.geminiKey || '';

  // Build modal HTML
  let overlay = document.getElementById('geminiKeyOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'geminiKeyOverlay';
    overlay.className = 'modal-overlay';
    overlay.onclick = function(e) { if (e.target === this) closeGeminiKeyModal(); };
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = (
    '<div class="modal" style="max-width:480px">' +
      '<div class="modal-header">' +
        '<div>' +
          '<div class="modal-title">🔑 Gemini API Key</div>' +
          '<div class="modal-subtitle">Enables semantic AI search for this clinic</div>' +
        '</div>' +
        '<button class="modal-close" onclick="closeGeminiKeyModal()">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div class="field" style="margin-bottom:14px">' +
          '<label>Gemini API Key <span style="color:var(--red)">*</span></label>' +
          '<input type="password" id="geminiKeyInput" value="' + escAttr(existing) + '"' +
            ' placeholder="AIza…"' +
            ' style="font-family:JetBrains Mono,monospace;font-size:13px">' +
        '</div>' +
        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;font-size:12.5px;color:var(--text-secondary);line-height:1.7">' +
          '<strong>How to get a free key:</strong><br>' +
          '1. Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--teal)">aistudio.google.com/app/apikey</a><br>' +
          '2. Click "Create API Key"<br>' +
          '3. Copy and paste it here<br><br>' +
          '<strong>Free quota:</strong> 1,500 embedding requests/day.' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn-sm btn-outline-teal" onclick="closeGeminiKeyModal()">Cancel</button>' +
        '<button class="btn-sm btn-teal" onclick="saveGeminiKey()">✨ Save & Enable Premium</button>' +
      '</div>' +
    '</div>'
  )
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('geminiKeyInput')?.focus(), 100);
}

function closeGeminiKeyModal() {
  const overlay = document.getElementById('geminiKeyOverlay');
  if (overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
}

async function saveGeminiKey() {
  const key = (document.getElementById('geminiKeyInput')?.value || '').trim();
  if (!key) { alert('Please enter a Gemini API key.'); return; }

  const btn = document.querySelector('#geminiKeyOverlay .btn-teal');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Verifying…'; }

  // Test the key with a small embedding
  try {
    var testUrl = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=' + key;
    const testRes = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'models/text-embedding-004', content: { parts: [{ text: 'test' }] } })
    });
    if (!testRes.ok) {
      const err = await testRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Invalid API key');
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '✨ Save & Enable Premium'; }
    alert('API key verification failed: ' + e.message);
    return;
  }

  // Save to DB
  const ok = await dbUpdateClinic(activeClinicId, { plan: 'premium', geminiKey: key });
  if (!ok) {
    if (btn) { btn.disabled = false; btn.textContent = '✨ Save & Enable Premium'; }
    alert('Failed to save. Check console.');
    return;
  }

  // Update local clinic object
  const idx = clinics.findIndex(c => c.id === activeClinicId);
  if (idx > -1) { clinics[idx].plan = 'premium'; clinics[idx].geminiKey = key; }

  closeGeminiKeyModal();
  showToast('✨ Premium AI search enabled!', 'success');

  // Re-render the AI panel and admin premium section
  renderAiSearchPanel();
  const premiumSection = document.getElementById('adminPremiumSection');
  if (premiumSection) premiumSection.innerHTML = renderPremiumUpgradeSection();
}