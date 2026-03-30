import { store } from '../core/store.js';
import { el, emptyNode, hideAllViews } from '../utils/dom.js';
import { formatDate } from '../utils/formatters.js';
import { interpretLabReport, generateDietPlanService, getPortalResponse, analyseMedicalImageService, markdownToHtml } from '../services/aiService.js';
import { fetchVitalsForPatient } from '../services/vitalsService.js';

// ─── 1. LAB REPORT ANALYSER ───

export const openLabViewSecure = () => {
    store.currentView = 'lab';
    hideAllViews();
    let v = document.getElementById('labView');
    if (!v) { v = el('div', { id: 'labView' }); document.querySelector('.main').appendChild(v); }
    v.style.display = '';
    
    if (typeof window.setNavActive === 'function') window.setNavActive('navLab');
    document.getElementById('pageTitle').textContent = '🔬 Lab Report Analyser';
    document.getElementById('pageSubtitle').textContent = 'AI-powered interpretation of lab reports and diagnostics';

    renderLabUI(v);
};

const renderLabUI = (container) => {
    emptyNode(container);
    
    const patients = store.patients || [];
    const reportOptions = [
        { v: 'CBC', l: 'CBC (Complete Blood Count)' },
        { v: 'LFT', l: 'LFT (Liver Function Test)' },
        { v: 'KFT', l: 'KFT (Kidney Function Test)' },
        { v: 'Lipid', l: 'Lipid Profile' },
        { v: 'Thyroid', l: 'Thyroid (TSH/T3/T4)' },
        { v: 'Diabetes', l: 'HbA1c / Diabetes Panel' },
        { v: 'Urine', l: 'Urine Routine' },
        { v: 'Custom', l: 'Custom / Multiple' }
    ];

    container.appendChild(el('div', { style: { maxWidth: '850px' } }, [
        el('div', { className: 'rx-card', style: { padding: '26px', marginBottom: '16px' } }, [
            el('div', { style: { fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' } }, [
                el('span', { textContent: '📋' }),
                document.createTextNode(' Report Details & Values')
            ]),
            
            el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' } }, [
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Select Patient' }),
                    el('input', { id: 'labPatientName', placeholder: 'Search or type patient name', attributes: { list: 'labPatList' } }),
                    el('datalist', { id: 'labPatList' }, patients.map(p => el('option', { value: p.name })))
                ]),
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Report Type' }),
                    el('select', { id: 'labReportType' }, reportOptions.map(o => el('option', { value: o.v, textContent: o.l })))
                ])
            ]),

            el('div', { className: 'field', style: { marginBottom: '12px' } }, [
                el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' } }, [
                    el('label', { style: { marginBottom: '0' }, textContent: 'Lab Report Values *' }),
                    el('div', { style: { display: 'flex', gap: '5px' } }, [
                        el('button', { className: 'btn-sm', style: { fontSize: '10px', padding: '2px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text-secondary)' }, textContent: 'Sample CBC', onclick: () => { document.getElementById('labReportText').value = "DATE: 20-MAR-2026\nHemoglobin: 9.8 g/dL (Low)\nWBC Count: 12,400 /μL (High)\nPlatelets: 1,80,000 /μL\nMCV: 74 fL (Low)\nMCH: 24 pg\nNeutrophils: 78% (High)\nLymphocytes: 16% (Low)"; } })
                    ])
                ]),
                el('textarea', { id: 'labReportText', rows: '10', placeholder: 'Paste lab values here...', style: { resize: 'vertical', minHeight: '200px', lineHeight: '1.6', fontFamily: 'monospace', fontSize: '13px' } })
            ]),

            el('div', { style: { display: 'flex', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' } }, [
                el('button', { className: 'btn-add', style: { padding: '10px 24px' }, textContent: '🤖 Analyse with AI', onclick: performLabAnalysis }),
                el('button', { className: 'btn-sm btn-outline-teal', style: { padding: '10px 16px' }, textContent: '✕ Clear All', onclick: () => { document.getElementById('labReportText').value = ''; document.getElementById('labResult').innerHTML = ''; } })
            ])
        ]),
        el('div', { id: 'labResult' })
    ]));
};

const performLabAnalysis = async () => {
    const report = document.getElementById('labReportText')?.value.trim();
    const type = document.getElementById('labReportType')?.value;
    const patient = document.getElementById('labPatientName')?.value;
    const resEl = document.getElementById('labResult');
    
    if (!report) return window.showToast('Please enter report values', 'error');
    
    emptyNode(resEl);
    resEl.appendChild(el('div', { className: 'rx-card', style: { padding: '24px', textAlign: 'center', color: 'var(--text-muted)' } }, [
        el('div', { style: { fontSize: '32px', marginBottom: '8px' }, textContent: '🔬' }),
        el('div', { textContent: 'Interpreting lab values...' })
    ]));

    try {
        const text = await interpretLabReport(report, type, patient);
        emptyNode(resEl);
        resEl.appendChild(el('div', { className: 'rx-card', style: { padding: '24px', boxShadow: 'var(--shadow-sm)' } }, [
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' } }, [
                el('span', { style: { fontSize: '24px' }, textContent: '🔬' }),
                el('div', {}, [
                    el('div', { style: { fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }, textContent: 'Lab Report Analysis' }),
                    el('div', { style: { fontSize: '12px', color: 'var(--text-muted)' }, textContent: `${patient ? patient + ' · ' : ''}${type} · AI-assisted interpretation` })
                ])
            ]),
            el('div', { style: { fontSize: '13.5px', lineHeight: '1.7', color: 'var(--text-primary)' }, html: markdownToHtml(text) }),
            el('div', { style: { marginTop: '16px', padding: '10px 14px', background: 'var(--ayurveda-bg)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--ayurveda)', fontSize: '12px', color: 'var(--ayurveda)' }, textContent: '⚠️ This is an AI-assisted interpretation for clinical reference only.' })
        ]));
    } catch(e) {
        resEl.innerHTML = `<div class="error-box">${e.message}</div>`;
    }
};

// ─── 2. DIET PLANNER ───

export const openDietViewSecure = () => {
    store.currentView = 'diet';
    hideAllViews();
    let v = document.getElementById('dietView');
    if (!v) { v = el('div', { id: 'dietView' }); document.querySelector('.main').appendChild(v); }
    v.style.display = '';
    
    if (typeof window.setNavActive === 'function') window.setNavActive('navDiet');
    document.getElementById('pageTitle').textContent = '🥗 Diet Planner';
    document.getElementById('pageSubtitle').textContent = 'AI-generated personalised diet plans for patients';

    renderDietUI(v);
};

const renderDietUI = (container) => {
    emptyNode(container);
    
    container.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', alignItems: 'start' } }, [
        // Left Panel
        el('div', { className: 'rx-card', style: { padding: '20px' } }, [
            el('div', { style: { fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }, textContent: '👤 Patient Details' }),
            el('div', { className: 'field', style: { marginBottom: '10px' } }, [
                el('label', { textContent: 'Patient Name' }),
                el('input', { id: 'dietPatient', placeholder: 'Select/Type name', attributes: { list: 'dietPatList' }, oninput: (e) => autofillDiet(e.target.value) }),
                el('datalist', { id: 'dietPatList' }, (store.patients || []).map(p => el('option', { value: p.name })))
            ]),
            el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' } }, [
                el('div', { className: 'field' }, [el('label', { textContent: 'Age' }), el('input', { id: 'dietAge', type: 'number' })]),
                el('div', { className: 'field' }, [el('label', { textContent: 'Gender' }), el('select', { id: 'dietGender' }, ['Male', 'Female', 'Other'].map(g => el('option', { textContent: g })))])
            ]),
            el('div', { className: 'field', style: { marginBottom: '10px' } }, [el('label', { textContent: 'Goal' }), el('select', { id: 'dietGoal' }, [
                { v: 'weight-loss', l: '⬇️ Weight Loss' },
                { v: 'maintain', l: '⚖️ Maintain' },
                { v: 'weight-gain', l: '⬆️ Weight Gain' }
            ].map(o => el('option', { value: o.v, textContent: o.l }))) ]),
            el('button', { className: 'btn-add', style: { width: '100%', justifyContent: 'center' }, textContent: '🤖 Generate Diet Plan', onclick: performDietGeneration })
        ]),
        // Right Panel
        el('div', { id: 'dietResult' }, [
            el('div', { style: { background: 'var(--surface)', border: '1px dashed var(--border2)', borderRadius: 'var(--radius-lg)', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' } }, [
                el('div', { style: { fontSize: '52px', marginBottom: '12px' }, textContent: '🥗' }),
                el('div', { textContent: 'Fill details and click "Generate"' })
            ])
        ])
    ]));
};

const autofillDiet = async (name) => {
    const p = (store.patients || []).find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!p) return;
    
    if (p.age) document.getElementById('dietAge').value = p.age;
    if (p.gender) document.getElementById('dietGender').value = p.gender;
    
    const vitals = await fetchVitalsForPatient(store.activeClinicId, p.name);
    if (vitals && vitals.length) {
        // Logic to fill wt/ht could go here
    }
};

const performDietGeneration = async () => {
    const params = {
        patient: document.getElementById('dietPatient').value,
        age: document.getElementById('dietAge').value,
        gender: document.getElementById('dietGender').value,
        goal: document.getElementById('dietGoal').value,
        weight: '70', height: '170', conditions: 'None', activity: 'Moderate', pref: 'Veg', allergies: 'None'
    };
    
    const resultEl = document.getElementById('dietResult');
    emptyNode(resultEl);
    resultEl.appendChild(el('div', { textContent: 'Generating plan...' }));
    
    try {
        const text = await generateDietPlanService(params);
        emptyNode(resultEl);
        resultEl.appendChild(el('div', { className: 'rx-card', style: { padding: '24px' } }, [
             el('div', { html: markdownToHtml(text) })
        ]));
    } catch(e) {
        resultEl.innerHTML = `<div class="error-box">${e.message}</div>`;
    }
};

// ─── 3. PATIENT PORTAL CHAT ───

export const openPortalViewSecure = () => {
    store.currentView = 'portal';
    hideAllViews();
    let v = document.getElementById('portalView');
    if (!v) { v = el('div', { id: 'portalView' }); document.querySelector('.main').appendChild(v); }
    v.style.display = '';
    
    if (typeof window.setNavActive === 'function') window.setNavActive('navPortal');
    document.getElementById('pageTitle').textContent = '👤 Patient Portal';
    document.getElementById('pageSubtitle').textContent = 'AI health assistant for patient queries';

    renderPortalUI(v);
};

const renderPortalUI = (container) => {
    emptyNode(container);
    
    const chatBody = el('div', { id: 'portalChat', style: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' } }, [
        el('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--text-muted)' } }, [
            el('div', { style: { fontSize: '48px', marginBottom: '12px' }, textContent: '💬' }),
            el('div', { textContent: 'Select a patient to begin conversation' })
        ])
    ]);

    const inputWrap = el('div', { style: { padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' } }, [
        el('div', { style: { display: 'flex', gap: '8px' } }, [
            el('input', { id: 'portalInput', placeholder: 'Ask a health question...', style: { flex: 1, padding: '10px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' } }),
            el('button', { className: 'btn-add', textContent: 'Send ➤', onclick: sendPortalMsg })
        ])
    ]);

    container.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', height: 'calc(100vh - 220px)' } }, [
        // Left: Patient List
        el('div', { className: 'rx-card', style: { overflowY: 'auto', padding: '14px' } }, 
            (store.patients || []).map(p => el('div', { 
                className: 'portal-patient-item', 
                style: { padding: '10px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', border: '1px solid transparent' },
                onmouseenter: (e) => e.target.style.background = 'var(--teal-pale)',
                onmouseleave: (e) => e.target.style.background = '',
                onclick: () => selectPortalPatient(p),
                textContent: p.name
            }))
        ),
        // Right: Chat Box
        el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }, [
            el('div', { style: { padding: '16px 20px', background: 'var(--teal)', color: '#fff' }, textContent: 'Rx Vault Health Assistant' }),
            chatBody,
            inputWrap
        ])
    ]));
};

let portalHistory = [];
let portalActivePatient = null;

const selectPortalPatient = (p) => {
    portalActivePatient = p;
    portalHistory = [];
    const chat = document.getElementById('portalChat');
    emptyNode(chat);
    chat.appendChild(el('div', { style: { textAlign: 'center', padding: '20px' }, textContent: `Hello! How can I help ${p.name} today?` }));
};

const sendPortalMsg = async () => {
    const inp = document.getElementById('portalInput');
    const msg = inp.value.trim();
    if (!msg || !portalActivePatient) return;
    
    inp.value = '';
    const chat = document.getElementById('portalChat');
    chat.appendChild(el('div', { style: { alignSelf: 'flex-end', background: 'var(--teal)', color: '#fff', padding: '10px 14px', borderRadius: '16px 16px 4px 16px' }, textContent: msg }));
    
    portalHistory.push({ role: 'user', content: msg });
    
    try {
        const reply = await getPortalResponse(portalHistory, `Patient: ${portalActivePatient.name}, Age: ${portalActivePatient.age}`);
        portalHistory.push({ role: 'assistant', content: reply });
        chat.appendChild(el('div', { style: { alignSelf: 'flex-start', background: 'var(--surface2)', padding: '10px 14px', borderRadius: '16px 16px 16px 4px' }, textContent: reply }));
    } catch(e) {
        window.showToast('AI error', 'error');
    }
};

// ─── 4. MEDICAL IMAGE AI ───

export const openMedImageViewSecure = () => {
    store.currentView = 'medimage';
    hideAllViews();
    let v = document.getElementById('medImageView');
    if (!v) { v = el('div', { id: 'medImageView' }); document.querySelector('.main').appendChild(v); }
    v.style.display = '';
    
    if (typeof window.setNavActive === 'function') window.setNavActive('navMedImage');
    document.getElementById('pageTitle').textContent = '🩻 Medical Image AI';
    document.getElementById('pageSubtitle').textContent = 'Analyse X-Rays, Scans and Clinical Photos with AI';

    renderMedImageUI(v);
};

const renderMedImageUI = (container) => {
    emptyNode(container);
    
    container.appendChild(el('div', { style: { maxWidth: '850px' } }, [
        el('div', { className: 'rx-card', style: { padding: '26px', marginBottom: '16px' } }, [
            el('div', { className: 'field', style: { marginBottom: '16px' } }, [
                el('label', { textContent: 'Select Image File (X-Ray, MRI, Clinical Photo)' }),
                el('input', { 
                    type: 'file', id: 'medImageFile', 
                    attributes: { accept: 'image/*' },
                    style: { border: '1px dashed var(--border)', padding: '30px', textAlign: 'center', width: '100%', borderRadius: '10px' },
                    onchange: (e) => handleImagePreview(e)
                })
            ]),
            el('div', { id: 'imagePreview', style: { display: 'none', marginBottom: '16px', textAlign: 'center' } }, [
                el('img', { id: 'previewImg', style: { maxWidth: '100%', maxHeight: '300px', borderRadius: '10px', boxShadow: 'var(--shadow-sm)' } })
            ]),
            el('div', { className: 'field', style: { marginBottom: '12px' } }, [
                el('label', { textContent: 'Type of Scan/Image' }),
                el('select', { id: 'medImageType' }, [
                    { v: 'chest-xray', l: 'Chest X-Ray' },
                    { v: 'bone-xray', l: 'Bone / Fracture X-Ray' },
                    { v: 'mri-brain', l: 'MRI Brain' },
                    { v: 'ct-abdomen', l: 'CT Abdomen' },
                    { v: 'skin-condition', l: 'Clinical Photo (Dermatology)' },
                    { v: 'other', l: 'Other' }
                ].map(o => el('option', { value: o.v, textContent: o.l })))
            ]),
            el('div', { className: 'field', style: { marginBottom: '12px' } }, [
                el('label', { textContent: 'Relevant Clinical Notes' }),
                el('textarea', { id: 'medImageNotes', placeholder: 'Enter patient history, symptoms or specific findings to look for...', style: { minHeight: '80px' } })
            ]),
            el('button', { className: 'btn-add', style: { padding: '10px 24px' }, textContent: '🤖 Run AI Analysis', onclick: performMedImageAnalysis })
        ]),
        el('div', { id: 'medImageResult' })
    ]));
};

const handleImagePreview = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const preview = document.getElementById('imagePreview');
        const img = document.getElementById('previewImg');
        img.src = ev.target.result;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
};

const performMedImageAnalysis = async () => {
    const fileInp = document.getElementById('medImageFile');
    const type = document.getElementById('medImageType').value;
    const notes = document.getElementById('medImageNotes').value;
    const resEl = document.getElementById('medImageResult');
    
    if (!fileInp.files[0]) return window.showToast('Please select an image', 'error');
    
    emptyNode(resEl);
    resEl.appendChild(el('div', { textContent: 'Analysing image...' }));

    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result.split(',')[1];
        const mime = fileInp.files[0].type;
        try {
            const text = await analyseMedicalImageService(base64, mime, type, notes);
            emptyNode(resEl);
            resEl.appendChild(el('div', { className: 'rx-card', style: { padding: '24px' } }, [
                el('div', { html: markdownToHtml(text) })
            ]));
        } catch(err) {
            resEl.innerHTML = `<div class="error-box">${err.message}</div>`;
        }
    };
    reader.readAsDataURL(fileInp.files[0]);
};

// Global Routing Bridge
window.showLabView = openLabViewSecure;
window.showDietView = openDietViewSecure;
window.showPortalView = openPortalViewSecure;
window.showMedImageView = openMedImageViewSecure;
