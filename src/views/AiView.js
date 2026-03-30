// ════════════════════════════════════════════════════════════
//  AI VIEW CONTROLLER
//  Builds the secure interface for LLM-assisted search queries
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';
import { el, emptyNode, escapeHtml } from '../utils/dom.js';
import { searchMedicalRecordsFuzzy, requestClinicalInsight } from '../services/aiService.js';

let _aiPanelOpen = false;

export const initAiSearchPanelSecure = () => {
    const panel = document.getElementById('aiSearchPanel');
    if (!panel) return;
    emptyNode(panel);

    const container = el('div', { style: { background: 'linear-gradient(135deg,var(--surface) 0%,var(--surface2) 100%)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: '14px', overflow: 'hidden' } });

    // HEADER
    const header = el('div', { id: 'aiPanelHeader', style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', cursor: 'pointer', borderBottom: '1px solid transparent', transition: 'border-color 0.2s', userSelect: 'none' }, onmouseenter: function(){ this.style.background='var(--bg)' }, onmouseleave: function(){ this.style.background='' }, onClick: toggleAiPanel }, [
        el('div', { style: { width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg,var(--homeopathy) 0%,var(--teal) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0', fontSize: '14px' }, textContent: '🔍' }),
        el('div', { style: { flex: 1, minWidth: 0 } }, [
            el('div', { style: { fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' } }, [
                el('span', { textContent: 'Find Similar Cases' }),
                el('span', { style: { background: 'var(--teal-pale)', color: 'var(--teal)', fontSize: '9px', fontWeight: '700', padding: '1px 6px', borderRadius: '8px', letterSpacing: '.06em', textTransform: 'uppercase' }, textContent: 'AI' })
            ]),
            el('div', { id: 'aiPanelSubtitle', style: { fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }, textContent: 'Search by symptom, diagnosis or patient name across all records' })
        ]),
        el('div', { id: 'aiPanelChevron', style: { fontSize: '10px', color: 'var(--text-muted)', transition: 'transform 0.22s', flexShrink: '0' }, textContent: '▼' })
    ]);

    // BODY Container
    const bodyContainer = el('div', { id: 'aiPanelBody', style: { overflow: 'hidden', maxHeight: '0', transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1)' } });
    
    // Search Content Area
    const searchSection = el('div', { style: { padding: '14px 16px' } });

    // Inputs Row
    const inputRow = el('div', { style: { display: 'flex', gap: '8px', marginBottom: '10px' } });
    const inputWrapper = el('div', { style: { flex: 1, position: 'relative' } }, [
        el('span', { style: { position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none' }, textContent: '🩺' }),
        el('input', { 
            id: 'aiSearchInput', 
            type: 'text', 
            placeholder: 'e.g. Fever with chills, Hypertension, Diabetic patient…', 
            style: { width: '100%', padding: '9px 12px 9px 34px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'DM Sans,sans-serif', background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.15s' },
            onfocus: function(){ this.style.borderColor='var(--teal)' },
            onblur: function(){ this.style.borderColor='var(--border)' }
        })
    ]);
    
    // Bind Keyboard event safely
    inputWrapper.querySelector('input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') executeAiVisualSearch();
    });

    const searchBtn = el('button', { 
        id: 'aiSearchBtn',
        style: { padding: '9px 18px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: '13px', fontWeight: '600', fontFamily: 'DM Sans,sans-serif', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'opacity 0.15s' },
        textContent: '🔍 Search',
        onmouseenter: function(){ this.style.opacity='0.9' },
        onmouseleave: function(){ this.style.opacity='1' },
        onClick: executeAiVisualSearch
    });

    const clearBtn = el('button', { 
        style: { padding: '9px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'DM Sans,sans-serif', transition: 'border-color 0.15s' },
        textContent: '✕ Clear',
        onmouseenter: function(){ this.style.borderColor='var(--border2)' },
        onmouseleave: function(){ this.style.borderColor='var(--border)' },
        onClick: clearAiSearch
    });

    inputRow.appendChild(inputWrapper);
    inputRow.appendChild(searchBtn);
    inputRow.appendChild(clearBtn);

    // Quick Chips Array
    const quickChipsValues = ['Fever & chills','Diabetes management','Hypertension','URTI','Thyroid disorder','Chest pain','Asthma','UTI','Dengue','Skin infection'];
    const quickChips = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' } }, [
        el('span', { style: { fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center', flexShrink: '0' }, textContent: 'Quick:' }),
        ...quickChipsValues.map(q => el('button', {
            style: { fontSize: '11px', padding: '3px 10px', border: '1px solid var(--border)', borderRadius: '16px', background: 'var(--surface2)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'DM Sans,sans-serif', transition: 'all 0.12s' },
            textContent: q,
            onmouseenter: function(){ this.style.background='var(--teal-pale)'; this.style.borderColor='var(--teal)'; this.style.color='var(--teal)'; },
            onmouseleave: function(){ this.style.background='var(--surface2)'; this.style.borderColor='var(--border)'; this.style.color='var(--text-secondary)'; },
            onClick: () => {
                document.getElementById('aiSearchInput').value = q;
                executeAiVisualSearch();
            }
        }))
    ]);

    searchSection.appendChild(inputRow);
    searchSection.appendChild(quickChips);

    // Dynamic Results Zone
    const resultsArea = el('div', { id: 'aiSearchResults' });

    bodyContainer.appendChild(searchSection);
    bodyContainer.appendChild(resultsArea);

    container.appendChild(header);
    container.appendChild(bodyContainer);
    panel.appendChild(container);

    // Patch global to expose scrolling action safely to legacy components if required
    window.scrollToRx = (rxId) => {
        clearAiSearch();
        const rx = (store.prescriptions || []).find(r => r.id === rxId);
        if(!rx) return;
        if(typeof window.setView === 'function') window.setView('all');
        setTimeout(() => {
            const card = document.querySelector(`[data-rxid="${rxId}"]`) || document.getElementById(`card_${rxId}`) || document.getElementById(`rx_${rxId}`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.outline = '2px solid var(--teal)';
                card.style.outlineOffset = '2px';
                setTimeout(() => { card.style.outline = ''; card.style.outlineOffset = ''; }, 2500);
            }
        }, 150);
    };
};

const toggleAiPanel = () => {
    _aiPanelOpen = !_aiPanelOpen;
    const body = document.getElementById('aiPanelBody');
    const chevron = document.getElementById('aiPanelChevron');
    const header = document.getElementById('aiPanelHeader');
    
    if (body) body.style.maxHeight = _aiPanelOpen ? '600px' : '0';
    if (chevron) chevron.style.transform = _aiPanelOpen ? 'rotate(180deg)' : '';
    if (header) header.style.borderBottomColor = _aiPanelOpen ? 'var(--border)' : 'transparent';
    if (_aiPanelOpen) setTimeout(() => document.getElementById('aiSearchInput')?.focus(), 320);
};

const clearAiSearch = () => {
    const inp = document.getElementById('aiSearchInput');
    if (inp) inp.value = '';
    
    const res = document.getElementById('aiSearchResults');
    if (res) emptyNode(res);
    
    const sub = document.getElementById('aiPanelSubtitle');
    if (sub) sub.textContent = 'Search by symptom, diagnosis or patient name across all records';
    
    if (_aiPanelOpen) toggleAiPanel();
};

const executeAiVisualSearch = async () => {
    const query = (document.getElementById('aiSearchInput')?.value || '').trim();
    if (!query) return;

    const resultsEl = document.getElementById('aiSearchResults');
    const btn = document.getElementById('aiSearchBtn');
    if (!resultsEl) return;

    const sub = document.getElementById('aiPanelSubtitle');
    if (sub) sub.textContent = `Searching for: "${query}"…`;

    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Searching…';
    }

    // 1. Loading UI String Inject (Safe because no user vars are appended)
    emptyNode(resultsEl);
    resultsEl.innerHTML = `<div style="padding:16px 16px 8px;display:flex;align-items:center;gap:10px;color:var(--text-muted);font-size:13px"><div style="width:16px;height:16px;border:2px solid var(--teal);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite"></div>Finding matching records…</div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;

    // 2. Fetch Fuzzy Array
    const matched = searchMedicalRecordsFuzzy(query);

    // 3. Render Top Hit Blocks Securtly using el()
    emptyNode(resultsEl);
    const nodesToRender = renderAiHitsSafe(matched, query);
    nodesToRender.forEach(node => resultsEl.appendChild(node));

    // 4. Stream Claude's Remote Summary API
    if (matched.length > 0) {
        const insightTxt = await requestClinicalInsight(query, matched);
        if (insightTxt) {
            const box = document.getElementById('aiInsightBox');
            if (box) {
                emptyNode(box);
                box.appendChild(el('div', { style: { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--teal)', marginBottom: '5px' }, textContent: '🤖 AI Pattern Insight' }));
                box.appendChild(el('div', { style: { fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: '1.6' }, textContent: insightTxt }));
                box.style.display = 'block';
            }
        }
    }

    if (btn) {
        btn.disabled = false;
        btn.textContent = '🔍 Search';
    }
    if (sub) sub.textContent = `${matched.length} record${matched.length !== 1 ? 's' : ''} found for "${query}"`;
};

const renderAiHitsSafe = (matched, query) => {
    if (!matched.length) {
        return [
            el('div', { style: { padding: '16px 16px 20px', textAlign: 'center' } }, [
                el('div', { style: { fontSize: '28px', marginBottom: '8px' }, textContent: '🔍' }),
                el('div', { style: { fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }, textContent: 'No matching records found' }),
                el('div', { style: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }, textContent: 'Try different keywords or check spelling' })
            ])
        ];
    }

    const typeIcon = { allopathy: '💉', homeopathy: '🌿', ayurveda: '🌱' };
    const typeBg = { allopathy: 'var(--allopathy-bg)', homeopathy: 'var(--homeopathy-bg)', ayurveda: 'var(--ayurveda-bg)' };
    const typeClr = { allopathy: 'var(--allopathy)', homeopathy: 'var(--homeopathy)', ayurveda: 'var(--ayurveda)' };

    // AI Insight Container (starts empty/hidden)
    const insightBox = el('div', { id: 'aiInsightBox', style: { display: 'none', margin: '0 16px 10px', background: 'var(--teal-pale)', border: '1px solid rgba(10,124,110,0.2)', borderRadius: 'var(--radius)', padding: '10px 14px' } });

    const totalBar = el('div', { style: { padding: '8px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [
        el('span', { style: { fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }, textContent: `${matched.length} record${matched.length !== 1 ? 's' : ''} matched` }),
        el('span', { style: { fontSize: '11px', color: 'var(--text-muted)' }, textContent: 'Sorted by relevance' })
    ]);

    const resultsHost = el('div', { style: { padding: '0 10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' } });

    matched.slice(0, 10).forEach(rx => {
        const icon = typeIcon[rx.type] || '💊';
        const bg = typeBg[rx.type] || 'var(--surface2)';
        const clr = typeClr[rx.type] || 'var(--text-muted)';
        const meds = (rx.medicines || []).slice(0, 3).map(m => m.name).join(', ');

        const card = el('div', {
            style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s' },
            onmouseenter: function(){ this.style.borderColor='var(--teal)'; this.style.background='var(--teal-pale)' },
            onmouseleave: function(){ this.style.borderColor='var(--border)'; this.style.background='var(--surface)' },
            onClick: () => window.scrollToRx(rx.id)
        }, [
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, [
                el('span', { style: { background: bg, color: clr, fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '8px' }, textContent: `${icon} ${(rx.type || '').toUpperCase()}` }),
                el('span', { style: { fontWeight: '700', fontSize: '13px' }, textContent: rx.patientName || '?' }), // Standard textContent blocks regex attacks since hl is dropped for security
                el('span', { style: { fontSize: '11.5px', color: 'var(--text-muted)' }, textContent: `📅 ${rx.date || ''}` }),
                ...(rx.status === 'active' ? [el('span', { style: { background: '#e8f5e9', color: 'var(--green)', fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '8px' }, textContent: 'Active' })] : [])
            ]),
            el('div', { style: { fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }, textContent: `🔬 ${rx.diagnosis || 'No diagnosis'} ${rx.doctorName ? ' · 🩺 Dr. ' + rx.doctorName : ''}` }),
            ...(meds ? [el('div', { style: { fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }, textContent: `💊 ${meds} ${rx.medicines.length > 3 ? `+${rx.medicines.length - 3} more` : ''}` })] : [])
        ]);

        resultsHost.appendChild(card);
    });

    if (matched.length > 10) {
        resultsHost.appendChild(el('div', { style: { textAlign: 'center', padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }, textContent: `…and ${matched.length - 10} more records. Refine your search to narrow results.` }));
    }

    return [insightBox, totalBar, resultsHost];
};
