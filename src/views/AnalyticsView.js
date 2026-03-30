// ════════════════════════════════════════════════════════════
//  ANALYTICS VIEW CONTROLLER
//  A DOM-safe statistics and charting renderer
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';
import { el, emptyNode, escapeHtml } from '../utils/dom.js';
import { computeClinicalDashboard, generateReportCSV } from '../services/analyticsService.js';

/**
 * Main dashboard composition function without string interpolation
 */
export const openAnalyticsDashboardSecure = () => {
    store.currentView = 'analytics';
    
    let container = document.getElementById('analyticsView');
    if (!container) {
        container = el('div', { id: 'analyticsView' });
        document.querySelector('.main').appendChild(container);
    }
    
    emptyNode(container);

    if (typeof window.setNavActive === 'function') window.setNavActive('navAnalytics');
    const pgTitle = document.getElementById('pageTitle');
    const pgSub = document.getElementById('pageSubtitle');
    if (pgTitle) pgTitle.textContent = '📊 Clinical Dashboard';
    if (pgSub) pgSub.textContent = 'Analytics, trends and exportable reports';

    // Computation Payload
    const data = computeClinicalDashboard();

    // 1. Export Bar
    const exportBar = el('div', { style: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginBottom: '16px' } }, [
        el('select', { 
            id: 'analyticsPeriod', 
            style: { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '13px', fontFamily: 'DM Sans,sans-serif', background: 'var(--surface)' } 
        }, [
            el('option', { value: 'all', textContent: 'All Time' }),
            el('option', { value: '30', textContent: 'Last 30 Days' }),
            el('option', { value: '90', textContent: 'Last 90 Days' }),
            el('option', { value: '365', textContent: 'Last Year' })
        ]),
        el('button', { className: 'btn-sm btn-outline-teal', textContent: '📤 Export Report', onClick: generateReportCSV })
    ]);

    // 2. KPI Top Row
    const kpisRow = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' } }, [
        createKpiCard('📋', data.total, 'Total Prescriptions', 'var(--teal)', 'var(--teal-pale)'),
        createKpiCard('✅', data.activeRx, 'Active', 'var(--green)', '#e8f5e9'),
        createKpiCard('📅', data.thisMonth, 'This Month', 'var(--allopathy)', 'var(--allopathy-bg)'),
        createKpiCard('👥', data.patientCount, 'Patients', 'var(--homeopathy)', 'var(--homeopathy-bg)')
    ]);

    // 3. Trends Charts
    const trendsRow = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' } }, [
        el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' } }, [
            el('div', { style: { fontWeight: '700', fontSize: '15px', marginBottom: '16px', color: 'var(--text-primary)' }, textContent: '📈 Prescription Trend (6 months)' }),
            buildBarChartGraph(data.monthlyData.map(d => ({ label: d.month, value: d.count })), 'var(--teal)', 200, false)
        ]),
        el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' } }, [
            el('div', { style: { fontWeight: '700', fontSize: '15px', marginBottom: '16px', color: 'var(--text-primary)' }, textContent: '💰 Revenue Trend (6 months)' }),
            window.invoices && window.invoices.length ? buildBarChartGraph(data.monthlyRevenue.map(d => ({ label: d.month, value: d.rev })), 'var(--green)', 200, true) : el('div', { style: { height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }, textContent: 'No invoice data available' })
        ])
    ]);

    // 4. Diagnoses & Medicines Horizontal Rankings
    const rankingsRow = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' } }, [
        el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' } }, [
            el('div', { style: { fontWeight: '700', fontSize: '15px', marginBottom: '14px', color: 'var(--text-primary)' }, textContent: '🔬 Top Diagnoses' }),
            data.topDiags.length ? buildHorizontalBarsNode(data.topDiags, 'var(--allopathy)') : el('div', { style: { color: 'var(--text-muted)', fontSize: '13px', padding: '20px 0', textAlign: 'center' }, textContent: 'No diagnosis data' })
        ]),
        el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' } }, [
            el('div', { style: { fontWeight: '700', fontSize: '15px', marginBottom: '14px', color: 'var(--text-primary)' }, textContent: '💊 Most Prescribed Medicines' }),
            data.topMeds.length ? buildHorizontalBarsNode(data.topMeds, 'var(--teal)') : el('div', { style: { color: 'var(--text-muted)', fontSize: '13px', padding: '20px 0', textAlign: 'center' }, textContent: 'No medicine data' })
        ])
    ]);

    // 5. Doctor Perf & Donut Dist
    const perfRow = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' } }, [
        // Doctors Table
        el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', gridColumn: 'span 2' } }, [
            el('div', { style: { fontWeight: '700', fontSize: '15px', marginBottom: '14px', color: 'var(--text-primary)' }, textContent: '🩺 Doctor Performance' }),
            data.topDoctors.length ? buildDoctorPerfTable(data.topDoctors, data.total) : el('div', { style: { color: 'var(--text-muted)', fontSize: '13px', padding: '20px 0', textAlign: 'center' }, textContent: 'No data' })
        ]),
        // Donut Chart
        el('div', { style: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' } }, [
            el('div', { style: { fontWeight: '700', fontSize: '15px', marginBottom: '14px', color: 'var(--text-primary)' }, textContent: '🏥 Type Distribution' }),
            buildDonutChartSvg([
                { label: 'Allopathy',  value: data.typeDist.allopathy, color: 'var(--allopathy)' },
                { label: 'Homeopathy', value: data.typeDist.homeopathy, color: 'var(--homeopathy)' },
                { label: 'Ayurveda',   value: data.typeDist.ayurveda, color: 'var(--ayurveda)' }
            ], data.total),
            // Legends
            el('div', { style: { marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' } }, 
                [['💉 Allopathy', data.typeDist.allopathy, 'var(--allopathy)'], ['🌿 Homeopathy', data.typeDist.homeopathy, 'var(--homeopathy)'], ['🌱 Ayurveda', data.typeDist.ayurveda, 'var(--ayurveda)']].map(r => {
                    return el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' } }, [
                        el('span', { textContent: r[0] }),
                        el('span', { style: { fontWeight: '700', color: r[2] }, textContent: `${r[1]} (${data.total > 0 ? Math.round(r[1]/data.total*100) : 0}%)` })
                    ]);
                })
            )
        ])
    ]);

    container.appendChild(exportBar);
    container.appendChild(kpisRow);
    container.appendChild(trendsRow);
    container.appendChild(rankingsRow);
    container.appendChild(perfRow);
};

// ── Helpers ──

function createKpiCard(icon, value, label, clr, bg) {
    return el('div', { style: { background: bg, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px' } }, [
        el('div', { style: { fontSize: '20px', marginBottom: '6px' }, textContent: icon }),
        el('div', { style: { fontSize: '26px', fontWeight: '700', color: clr, fontFamily: 'DM Serif Display, serif' }, textContent: value }),
        el('div', { style: { fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: '2px' }, textContent: label })
    ]);
}

function buildBarChartGraph(dataArr, color, height = 200, isCurrency = false) {
    if (!dataArr.length) return el('div', { style: { height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }, textContent: 'No data' });
    
    const maxVal = Math.max(...dataArr.map(d => d.value)) || 1;
    const wrapper = el('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '6px', height: `${height}px`, paddingBottom: '24px', position: 'relative' } });

    dataArr.forEach(d => {
        const h = Math.round((d.value / maxVal) * (height - 40));
        const label = isCurrency ? `₹${d.value >= 1000 ? (d.value/1000).toFixed(1)+'k' : d.value}` : d.value;
        const col = el('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' } }, [
            el('div', { style: { fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }, textContent: d.value ? label : '' }),
            el('div', { style: { width: '100%', background: color, borderRadius: '4px 4px 0 0', height: `${Math.max(h,2)}px`, opacity: 0.85, transition: 'height 0.4s' } }),
            el('div', { style: { fontSize: '10px', color: 'var(--text-muted)', transform: 'rotate(-35deg)', transformOrigin: 'top left', whiteSpace: 'nowrap', marginTop: '4px' }, textContent: d.label })
        ]);
        wrapper.appendChild(col);
    });

    return wrapper;
}

function buildHorizontalBarsNode(dataMap, color) {
    const max = dataMap[0] ? dataMap[0][1] : 1;
    const wrapper = el('div');
    dataMap.forEach(d => {
        const pct = Math.round((d[1] / max) * 100);
        wrapper.appendChild(el('div', { style: { marginBottom: '10px' } }, [
            el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' } }, [
                el('span', { style: { fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }, textContent: d[0] }),
                el('span', { style: { fontWeight: '700', color: color, flexShrink: 0 }, textContent: d[1] })
            ]),
            el('div', { style: { background: 'var(--bg)', borderRadius: '4px', height: '8px', overflow: 'hidden' } }, [
                el('div', { style: { background: color, height: '100%', width: `${pct}%`, transition: 'width 0.4s', opacity: 0.8 } })
            ])
        ]));
    });
    return wrapper;
}

function buildDoctorPerfTable(topDoctors, total) {
    const table = el('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' } });
    const theadTr = el('tr', { style: { background: 'var(--surface2)' } });
    theadTr.appendChild(el('th', { style: { padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }, textContent: 'Doctor' }));
    theadTr.appendChild(el('th', { style: { padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }, textContent: 'Rx Count' }));
    theadTr.appendChild(el('th', { style: { padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }, textContent: 'Share' }));
    table.appendChild(el('thead', {}, [theadTr]));

    const tbody = el('tbody');
    topDoctors.forEach(d => {
        const pct = total > 0 ? Math.round((d[1] / total) * 100) : 0;
        const tr = el('tr', { style: { borderBottom: '1px solid var(--border)' } });
        tr.appendChild(el('td', { style: { padding: '10px 12px', fontWeight: '600' }, textContent: `Dr. ${d[0]}` }));
        tr.appendChild(el('td', { style: { padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--teal)' }, textContent: d[1] }));
        
        const perfCell = el('td', { style: { padding: '10px 12px' } }, [
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                el('div', { style: { flex: 1, background: 'var(--bg)', borderRadius: '4px', height: '8px', overflow: 'hidden' } }, [
                    el('div', { style: { background: 'var(--teal)', height: '100%', width: `${pct}%`, transition: 'width 0.4s' } })
                ]),
                el('span', { style: { fontSize: '12px', color: 'var(--text-muted)', width: '32px' }, textContent: `${pct}%` })
            ])
        ]);
        tr.appendChild(perfCell);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
}

// Generates SVG graph precisely without explicit innerHTML vulnerabilities using Namespace API
function buildDonutChartSvg(segments, total) {
    if (!total) return el('div', { style: { height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }, textContent: 'No data' });
    
    const size = 120, cx = 60, cy = 60, r = 44, innerR = 28;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

    let angle = -Math.PI / 2;
    segments.forEach(seg => {
        if (!seg.value) return;
        const sweep = (seg.value / total) * 2 * Math.PI;
        const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
        const x2 = cx + r * Math.cos(angle + sweep), y2 = cy + r * Math.sin(angle + sweep);
        const largeArc = sweep > Math.PI ? 1 : 0;
        const xi1 = cx + innerR * Math.cos(angle + sweep), yi1 = cy + innerR * Math.sin(angle + sweep);
        const xi2 = cx + innerR * Math.cos(angle), yi2 = cy + innerR * Math.sin(angle);
        
        const pathData = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${xi2} ${yi2} Z`;
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', seg.color);
        path.setAttribute('opacity', '0.85');
        svg.appendChild(path);

        angle += sweep;
    });

    const valText = document.createElementNS(svgNS, 'text');
    valText.setAttribute('x', cx);
    valText.setAttribute('y', cy + 4);
    valText.setAttribute('text-anchor', 'middle');
    valText.setAttribute('font-size', '14');
    valText.setAttribute('font-weight', '700');
    valText.setAttribute('fill', 'var(--text-primary)');
    valText.textContent = total;
    svg.appendChild(valText);

    const lblText = document.createElementNS(svgNS, 'text');
    lblText.setAttribute('x', cx);
    lblText.setAttribute('y', cy + 16);
    lblText.setAttribute('text-anchor', 'middle');
    lblText.setAttribute('font-size', '9');
    lblText.setAttribute('fill', 'var(--text-muted)');
    lblText.textContent = 'Total';
    svg.appendChild(lblText);

    const wrapper = el('div', { style: { display: 'flex', justifyContent: 'center' } });
    wrapper.appendChild(svg);
    return wrapper;
}
