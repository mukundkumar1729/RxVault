import { store } from '../core/store.js';
import { el, emptyNode, hideAllViews } from '../utils/dom.js';
import { formatDate } from '../utils/formatters.js';
import { fetchAppointments, saveAppointment, updateAppointmentStatus, toggleAppointmentArrival, deleteAppointment, getNextToken, computeQueueStats } from '../services/appointmentService.js';

let apptFilterState = { patient: '', doctor: '', phone: '', time: '', date: '' };

/**
 * Main entry point for Appointment View
 */
export const openAppointmentViewSecure = async () => {
    store.currentView = 'appointments';
    hideAllViews();

    let v = document.getElementById('appointmentView');
    if (!v) {
        v = el('div', { id: 'appointmentView' });
        document.querySelector('.main').appendChild(v);
    }
    v.style.display = '';

    if (typeof window.setNavActive === 'function') window.setNavActive('navAppointments');
    
    const title = document.getElementById('pageTitle');
    const sub = document.getElementById('pageSubtitle');
    const addBtn = document.getElementById('btnAddRx');
    
    if (title) title.textContent = '📅 Appointments & Queue';
    if (sub) sub.textContent = 'Today\'s patient queue and appointment management';
    if (addBtn) {
        addBtn.style.display = 'flex';
        addBtn.onclick = openBookAppointmentModal;
        addBtn.innerHTML = '<span>➕ Book Appointment</span>';
    }

    // Set initial date filter to today if empty
    if (!apptFilterState.date) {
        apptFilterState.date = new Date().toISOString().split('T')[0];
    }

    await refreshAppointmentView();
};

const refreshAppointmentView = async () => {
    const container = document.getElementById('appointmentView');
    if (!container) return;
    
    emptyNode(container);
    
    // Load data
    await fetchAppointments(store.activeClinicId, apptFilterState.date);
    
    // Render Layout
    const statsRow = el('div', { id: 'apptStats', className: 'stats-grid', style: { display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' } });
    const filterBar = el('div', { id: 'apptFilterBar', style: { marginBottom: '16px' } });
    const listWrap = el('div', { id: 'apptList' });
    
    container.append(statsRow, filterBar, listWrap);
    
    renderStats(statsRow);
    renderFilters(filterBar);
    renderList(listWrap);
};

const renderStats = (container) => {
    emptyNode(container);
    const stats = computeQueueStats(apptFilterState.date);
    
    const cards = [
        { label: 'Total', val: stats.total, icon: '📋', bg: 'var(--surface2)', clr: 'var(--text-primary)' },
        { label: 'Arrived', val: stats.arrived, icon: '🟢', bg: '#e8f5e9', clr: 'var(--green)' },
        { label: 'In Room', val: stats.inRoom, icon: '🔵', bg: 'var(--teal-pale)', clr: 'var(--teal)' },
        { label: 'Done', val: stats.done, icon: '✅', bg: 'var(--green-bg, #e8f5e9)', clr: 'var(--green)' },
    ];
    
    cards.forEach(s => {
        container.appendChild(el('div', { 
            style: { background: s.bg, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '100px' } 
        }, [
            el('div', { style: { fontSize: '22px' }, textContent: s.icon }),
            el('div', {}, [
                el('div', { style: { fontSize: '24px', fontWeight: '700', color: s.clr, fontFamily: '"DM Serif Display", serif' }, textContent: s.val }),
                el('div', { style: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.08em' }, textContent: s.label })
            ])
        ]));
    });
};

const renderFilters = (container) => {
    emptyNode(container);
    
    const inputStyle = { width: '100%', padding: '7px 10px 7px 30px', border: '1px solid var(--border)', borderRadius: '20px', fontSize: '12.5px', fontFamily: 'DM Sans, sans-serif', background: 'var(--surface)', boxSizing: 'border-box' };
    const iconStyle = { position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', pointerEvents: 'none' };
    
    const searchGroup = (icon, id, placeholder, val) => el('div', { style: { position: 'relative', flex: '1', minWidth: '140px' } }, [
        el('span', { style: iconStyle, textContent: icon }),
        el('input', { 
            id, type: 'text', placeholder, 
            attributes: { value: val },
            oninput: (e) => { 
                const field = id.replace('apptF', '').toLowerCase();
                apptFilterState[field] = e.target.value.toLowerCase().trim();
                renderList(document.getElementById('apptList'));
            } 
        }, [], { style: inputStyle })
    ]);

    container.appendChild(el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', padding: '12px 0 8px' } }, [
        // Date selector
        el('div', { style: { position: 'relative', minWidth: '140px' } }, [
            el('span', { style: iconStyle, textContent: '📅' }),
            el('input', { 
                type: 'date', 
                style: { ...inputStyle, paddingLeft: '32px' },
                attributes: { value: apptFilterState.date },
                onchange: (e) => { 
                    apptFilterState.date = e.target.value;
                    refreshAppointmentView();
                }
            })
        ]),
        searchGroup('👤', 'apptFPatient', 'Patient name', apptFilterState.patient),
        searchGroup('🩺', 'apptFDoctor', 'Doctor name', apptFilterState.doctor),
        el('button', { 
            style: { padding: '7px 14px', border: '1px solid var(--border)', borderRadius: '20px', background: 'var(--surface)', fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' },
            textContent: '✕ Clear',
            onclick: () => {
                apptFilterState = { patient: '', doctor: '', phone: '', time: '', date: new Date().toISOString().split('T')[0] };
                refreshAppointmentView();
            }
        })
    ]));
};

const renderList = (container) => {
    emptyNode(container);
    const list = store.appointments || [];
    const f = apptFilterState;
    
    const filtered = list.filter(a => {
        if (f.patient && !(a.patient_name || '').toLowerCase().includes(f.patient)) return false;
        if (f.doctor && !(a.doctor_name || '').toLowerCase().includes(f.doctor)) return false;
        return true;
    });

    if (!filtered.length) {
        container.appendChild(el('div', { className: 'empty-state', style: { padding: '32px', textAlign: 'center', color: 'var(--text-muted)' } }, [
            el('div', { style: { fontSize: '32px', marginBottom: '8px' }, textContent: '📅' }),
            el('div', { textContent: 'No appointments match your filters.' })
        ]));
        return;
    }

    const visitTypeConfig = {
        'consultation': { icon: '🩺', label: 'Consultation', clr: 'var(--teal)' },
        'follow-up': { icon: '🔄', label: 'Follow-up', clr: 'var(--allopathy)' },
        'emergency': { icon: '🚨', label: 'Emergency', clr: 'var(--red)' },
        'procedure': { icon: '⚕️', label: 'Procedure', clr: 'var(--homeopathy)' },
    };
    
    const statusConfig = {
        'waiting': { label: '⏳ Waiting', bg: 'var(--allopathy-bg)', clr: 'var(--allopathy)', border: 'rgba(26,111,219,0.3)' },
        'in-room': { label: '🔵 In Room', bg: 'var(--teal-pale)', clr: 'var(--teal)', border: 'rgba(10,124,110,0.3)' },
        'done': { label: '✅ Done', bg: '#e8f5e9', clr: 'var(--green)', border: 'rgba(22,163,74,0.3)' },
        'cancelled': { label: '❌ Cancelled', bg: 'var(--red-bg)', clr: 'var(--red)', border: 'rgba(220,38,38,0.3)' },
    };

    const listNodes = filtered.map(a => {
        const sc = statusConfig[a.status] || statusConfig['waiting'];
        const vtc = visitTypeConfig[a.visit_type] || visitTypeConfig['consultation'];
        const arrived = !!a.arrived;
        const isRegistered = !!a.is_registered;

        const regPill = isRegistered
            ? el('span', { style: { background: '#e8f5e9', color: 'var(--green)', border: '1px solid rgba(22,163,74,0.3)', fontSize: '10px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px' }, textContent: '✅ Registered' })
            : el('span', { 
                style: { background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.3)', fontSize: '10px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', cursor: 'pointer' },
                textContent: '⚠️ Unregistered',
                onclick: () => promptRegistration(a.patient_name)
            });

        const arrivalPill = el('span', {
            style: { background: arrived ? '#e8f5e9' : 'var(--surface2)', color: arrived ? 'var(--green)' : 'var(--text-muted)', border: `1px solid ${arrived ? 'rgba(22,163,74,0.3)' : 'var(--border)'}`, fontSize: '10px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', cursor: isRegistered ? 'pointer' : 'not-allowed', opacity: isRegistered ? 1 : 0.5, whiteSpace: 'nowrap' },
            textContent: arrived ? '🟢 In Clinic' : '⚪ Not Arrived',
            onclick: async () => { if (isRegistered) { await toggleAppointmentArrival(a.id); refreshAppointmentView(); } }
        });

        return el('div', { 
            style: { background: 'var(--surface)', border: `1px solid ${arrived ? 'rgba(10,124,110,0.25)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', transition: 'box-shadow 0.2s', opacity: arrived ? 1 : 0.82 }
        }, [
            // Token Badge
            el('div', { 
                style: { background: 'linear-gradient(135deg,var(--teal-light),var(--teal))', color: '#fff', width: '46px', height: '46px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: '700', flexShrink: '0', fontFamily: '"DM Serif Display", serif', boxShadow: '0 3px 10px rgba(10,124,110,0.3)' },
                textContent: a.token_no
            }),
            
            // Patient Info
            el('div', { style: { flex: '1', minWidth: '0' } }, [
                el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, [
                    el('span', { style: { fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }, textContent: a.patient_name }),
                    el('span', { style: { background: `${vtc.clr}18`, color: vtc.clr, fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }, textContent: `${vtc.icon} ${vtc.label}` }),
                    regPill,
                    arrivalPill
                ]),
                el('div', { style: { fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '12px' } }, [
                    a.doctor_name ? el('span', { textContent: `🩺 Dr. ${a.doctor_name}` }) : null,
                    a.appt_time ? el('span', { textContent: `🕐 ${a.appt_time}` }) : null,
                    a.notes ? el('span', { textContent: `💬 ${a.notes}` }) : null
                ])
            ]),

            // Status
            el('div', { 
                style: { background: sc.bg, color: sc.clr, border: `1px solid ${sc.border}`, padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', flexShrink: '0', whiteSpace: 'nowrap' },
                textContent: sc.label
            }),

            // Actions
            el('div', { style: { display: 'flex', gap: '6px', flexShrink: '0' } }, [
                a.status === 'waiting' && arrived && isRegistered 
                    ? el('button', { className: 'btn-sm btn-teal', textContent: '▶ Call', onclick: async () => { await updateAppointmentStatus(a.id, 'in-room'); refreshAppointmentView(); } })
                    : (a.status === 'waiting' ? el('button', { className: 'btn-sm', attributes: { disabled: true }, style: { opacity: 0.5, cursor: 'not-allowed' }, textContent: '▶ Call' }) : null),
                
                a.status === 'in-room'
                    ? el('button', { className: 'btn-sm btn-teal', textContent: '📝 Rx', onclick: () => openRxForAppointment(a) }) 
                    : null,

                (a.status !== 'done' && a.status !== 'cancelled')
                    ? el('button', { className: 'btn-sm btn-outline-teal', textContent: '✅', onclick: async () => { await updateAppointmentStatus(a.id, 'done'); refreshAppointmentView(); } })
                    : null,

                el('button', { className: 'btn-sm btn-outline-red', textContent: '🗑️', onclick: async () => { if (confirm('Delete?')) { await deleteAppointment(a.id); refreshAppointmentView(); } } })
            ])
        ]);
    });

    container.appendChild(el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, listNodes));
};

/**
 * Modern Booking Modal
 */
export const openBookAppointmentModal = async () => {
    let overlay = document.getElementById('bookApptOverlay');
    if (!overlay) {
        overlay = el('div', { id: 'bookApptOverlay', className: 'modal-overlay' });
        document.body.appendChild(overlay);
    }
    emptyNode(overlay);

    const doctors = store.doctors || [];
    const patients = store.patients || [];
    const today = new Date().toISOString().split('T')[0];

    let selectedPatient = null;

    const modal = el('div', { className: 'modal', style: { maxWidth: '580px' } }, [
        el('div', { className: 'modal-header' }, [
            el('div', {}, [
                el('div', { className: 'modal-title', textContent: '📅 Book Appointment' }),
                el('div', { className: 'modal-subtitle', textContent: 'Schedule a patient visit and assign token' })
            ]),
            el('button', { className: 'modal-close', textContent: '✕', onclick: () => overlay.classList.remove('open') })
        ]),
        el('div', { className: 'modal-body' }, [
            // Patient Picker
            el('div', { className: 'field' }, [
                el('label', { textContent: 'Select Patient (Start typing to search or create new)' }),
                el('input', { 
                    id: 'bk_patSearch', placeholder: 'Search name or ID...',
                    attributes: { list: 'bk_searchList' },
                    oninput: (e) => {
                        const val = e.target.value.toLowerCase();
                        const match = patients.find(p => p.name.toLowerCase() === val || p.id.toLowerCase() === val);
                        const msg = document.getElementById('bk_verifyMsg');
                        if (match) {
                            selectedPatient = match;
                            msg.textContent = `✅ Found: ${match.name} (${match.id})`;
                            msg.style.color = 'var(--green)';
                        } else {
                            selectedPatient = null;
                            msg.textContent = val ? '⚠️ New patient (will require registration later)' : 'Enter patient name';
                            msg.style.color = val ? 'var(--ayurveda)' : 'var(--text-muted)';
                        }
                    }
                }),
                el('datalist', { id: 'bk_searchList' }, patients.map(p => el('option', { value: p.name }))),
                el('div', { id: 'bk_verifyMsg', style: { fontSize: '12px', marginTop: '6px', color: 'var(--text-muted)' }, textContent: 'Enter name or ID' })
            ]),

            el('div', { className: 'form-row', style: { marginTop: '14px' } }, [
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Doctor' }),
                    el('select', { id: 'bk_docInp' }, [
                        el('option', { value: '', textContent: '— Select —' }),
                        ...doctors.map(d => el('option', { value: d.name, textContent: `Dr. ${d.name} (${d.specialization || d.type})` }))
                    ])
                ]),
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Visit Type' }),
                    el('select', { id: 'bk_visitTypeInp' }, [
                        el('option', { value: 'consultation', textContent: 'Consultation' }),
                        el('option', { value: 'follow-up', textContent: 'Follow-up' }),
                        el('option', { value: 'emergency', textContent: 'Emergency' }),
                        el('option', { value: 'procedure', textContent: 'Procedure' })
                    ])
                ])
            ]),

            el('div', { className: 'form-row', style: { marginTop: '14px' } }, [
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Date' }),
                    el('input', { id: 'bk_dateInp', type: 'date', attributes: { value: today, min: today } })
                ]),
                el('div', { className: 'field' }, [
                    el('label', { textContent: 'Notes' }),
                    el('input', { id: 'bk_notesInp', placeholder: 'e.g. Fever, routine check...' })
                ])
            ])
        ]),
        el('div', { className: 'modal-footer' }, [
            el('button', { className: 'btn-sm btn-outline-teal', textContent: 'Cancel', onclick: () => overlay.classList.remove('open') }),
            el('button', { className: 'btn-sm btn-teal', textContent: '📅 Confirm Booking', onclick: async () => {
                const name = document.getElementById('bk_patSearch').value.trim();
                const doc = document.getElementById('bk_docInp').value;
                const type = document.getElementById('bk_visitTypeInp').value;
                const date = document.getElementById('bk_dateInp').value;
                const notes = document.getElementById('bk_notesInp').value;

                if (!name || !date) return window.showToast('Name and Date are required', 'error');

                const token = await getNextToken(store.activeClinicId, date);
                const appt = {
                    id: 'appt_' + Date.now(),
                    clinic_id: store.activeClinicId,
                    patient_name: name,
                    doctor_name: doc,
                    appt_date: date,
                    visit_type: type,
                    notes: notes,
                    token_no: token,
                    status: 'waiting',
                    arrived: false,
                    is_registered: !!selectedPatient,
                    patient_id: selectedPatient ? selectedPatient.id : '',
                    created_at: new Date().toISOString()
                };

                const ok = await saveAppointment(appt);
                if (ok) {
                    overlay.classList.remove('open');
                    window.showToast(`✅ Token #${token} assigned to ${name}`, 'success');
                    refreshAppointmentView();
                }
            } })
        ])
    ]);

    overlay.appendChild(modal);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
};

/** Bridge helpers **/
const promptRegistration = (name) => {
    if (confirm(`Patient "${name}" is not registered. Register now?`)) {
        if (window.openRegisterModal) {
            window.openRegisterModal();
            setTimeout(() => {
                const inp = document.getElementById('regName');
                if (inp) inp.value = name;
            }, 300);
        }
    }
};

const openRxForAppointment = (appt) => {
    const patient = (store.patients || []).find(p => (p.name || '').toLowerCase() === appt.patient_name.toLowerCase());
    if (patient && window.openPrescriptionForPatient) {
        window.openPrescriptionForPatient(patient);
    } else if (window.openAddModal) {
        window.openAddModal();
        setTimeout(() => {
            const inp = document.getElementById('fPatientName');
            if (inp) inp.value = appt.patient_name;
        }, 100);
    }
};

// Global Routing Bridge
window.showAppointmentView = openAppointmentViewSecure;
window.openBookAppointment = openBookAppointmentModal;
