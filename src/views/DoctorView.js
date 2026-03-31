// ════════════════════════════════════════════════════════════
//  DOCTORS VIEW CONTROLLER
//  Handles secure rendering of doctor cards and availability
// ════════════════════════════════════════════════════════════

import { store, subscribe } from '../core/store.js';
import { el, emptyNode, escapeHtml } from '../utils/dom.js';
import { formatDate, capitalize } from '../utils/formatters.js';

const TODAY_NAME = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

/**
 * Initializes the view listeners to auto-render based on store changes
 */
export const initDoctorsView = () => {
    // When the doctor registry updates, re-render the view if active
    subscribe('doctors', (newList) => {
        if (store.currentView === 'doctors') {
            renderDoctorsGrid(newList);
        }
    });
};

/**
 * Secures standard HTML `.innerHTML` building with safe `el()` creation
 */
export const renderDoctorsGrid = (list = store.doctors) => {
    const grid = document.getElementById('doctorsGrid');
    const banner = document.getElementById('todayBanner');
    if (!grid) return;
    
    emptyNode(grid);

    if (!list || !list.length) {
        if (banner) banner.style.display = 'none';
        grid.appendChild(
            el('div', { className: 'empty-state' }, [
                el('div', { className: 'empty-icon', textContent: '👨‍⚕️' }),
                el('div', { className: 'empty-title', textContent: store.doctors?.length ? 'No doctors match your filter.' : 'No Doctors Registered' }),
                el('div', { className: 'empty-sub', textContent: store.doctors?.length ? 'Try clearing the filter.' : 'Contact the admin to register doctors.' })
            ])
        );
        return;
    }

    // Render Today Banner
    const todayDrs = list.filter(d => (d.availability || []).some(s => s.day === TODAY_NAME));
    if (banner) {
        banner.style.display = '';
        emptyNode(banner);
        
        if (todayDrs.length) {
            banner.appendChild(el('span', { className: 'today-dot', textContent: '🟢 ' }));
            const strong = el('strong', { textContent: `${todayDrs.length} doctor${todayDrs.length > 1 ? 's' : ''} available today ` });
            banner.appendChild(strong);
            banner.appendChild(document.createTextNode(`(${TODAY_NAME}) — ${todayDrs.map(d => `Dr. ${d.name}`).join(', ')}`));
        } else {
            banner.appendChild(el('span', { textContent: '📅 ' }));
            banner.appendChild(document.createTextNode(`No doctors available today (${TODAY_NAME})`));
        }
    }

    const typeIcon = { allopathy: '💉', homeopathy: '🌿', ayurveda: '🌱' };
    const typeBg = { allopathy: 'var(--allopathy-bg)', homeopathy: 'var(--homeopathy-bg)', ayurveda: 'var(--ayurveda-bg)' };
    const typeClr = { allopathy: 'var(--allopathy)', homeopathy: 'var(--homeopathy)', ayurveda: 'var(--ayurveda)' };

    list.forEach(d => {
        const availToday = (d.availability || []).find(s => s.day === TODAY_NAME);
        const isUnavail = !!d.unavailable;

        const card = el('div', { 
            className: `dr-card ${availToday && !isUnavail ? 'dr-card-available' : ''} ${isUnavail ? 'dr-card-unavailable' : ''}` 
        }, [
            // Card Header
            el('div', { className: 'dr-card-header' }, [
                el('div', { 
                    className: 'dr-avatar', 
                    style: { background: (typeBg[d.type] || '#eee'), color: (typeClr[d.type] || '#333') },
                    textContent: typeIcon[d.type] || '🩺' 
                }),
                el('div', { className: 'dr-info' }, [
                    el('div', { className: 'dr-name' }, [
                        document.createTextNode(`Dr. ${d.name}`),
                        d.status && d.status !== 'available' ? el('small', { 
                            className: `status-badge status-${d.status.split('_')[0]}`,
                            style: { fontSize: '9px', verticalAlign: 'middle', marginLeft: '4px' },
                            textContent: formatStatusLabel(d.status)
                        }) : null
                    ]),
                    el('div', { className: 'dr-spec', textContent: d.specialization || '' }),
                    el('div', { className: 'dr-reg-badge', textContent: d.regNo })
                ]),
                isUnavail 
                    ? el('div', { className: 'dr-unavail-badge', textContent: '🔴 Not Available' }) 
                    : (availToday ? el('div', { className: 'dr-today-badge' }, [
                        document.createTextNode('Today ✓'),
                        el('br'),
                        el('small', { textContent: availToday.time })
                    ]) : null)
            ]),
            
            // Card Body
            el('div', { className: 'dr-card-body' }, [
                d.hospital ? el('div', { className: 'dr-detail', textContent: `🏥 ${d.hospital}` }) : null,
                d.qualification ? el('div', { className: 'dr-detail', textContent: `🎓 ${d.qualification}` }) : null,
                d.phone ? el('div', { className: 'dr-detail', textContent: `📞 ${d.phone}` }) : null,
                d.email ? el('div', { className: 'dr-detail', textContent: `✉️ ${d.email}` }) : null,
                d.address ? el('div', { className: 'dr-detail', textContent: `📍 ${d.address}` }) : null,
                
                // Weekly Schedule
                el('div', { className: 'dr-schedule' }, [
                    el('div', { className: 'dr-schedule-title', textContent: '📅 Weekly Schedule' }),
                    isUnavail ? el('div', { className: 'dr-unavail-notice', textContent: '⚠️ Doctor is currently marked as unavailable.' }) : null,
                    el('div', { className: 'dr-slots' }, (d.availability || []).length ? d.availability.map(s => {
                        return el('div', { className: `dr-slot ${s.day === TODAY_NAME && !isUnavail ? 'dr-slot-today' : ''}` }, [
                            el('span', { className: 'dr-slot-day', textContent: s.day.substring(0,3) }),
                            el('span', { className: 'dr-slot-time', textContent: s.time })
                        ]);
                    }) : [el('span', { style: { color: 'var(--text-muted)', fontSize: '12px' }, textContent: 'No schedule listed' })])
                ])
            ])
        ]);

        grid.appendChild(card);
    });
};

function formatStatusLabel(s) {
    if (!s) return '';
    return s.replace(/_/g, ' ').toUpperCase();
}
