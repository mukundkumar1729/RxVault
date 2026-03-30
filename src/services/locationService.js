// ════════════════════════════════════════════════════════════
//  LOCATION SERVICE
//  Handles cross-referencing DB map tables with dynamic entities
// ════════════════════════════════════════════════════════════

import { store } from '../core/store.js';
import { db } from '../core/db.js';

export const loadActiveLocations = async () => {
    let entries = [];
    if (!store.activeClinicId) return entries;
    
    try {
        const { data } = await db.from('location_directory')
                                 .select('*')
                                 .eq('clinic_id', store.activeClinicId)
                                 .order('entity_type')
                                 .order('name');
        entries = data || [];
    } catch(e) {
        // Fallback for missing table during deployment
        try { 
            entries = JSON.parse(localStorage.getItem(`loc_dir_${store.activeClinicId}`) || '[]'); 
        } catch(e2) { 
            entries = []; 
        }
    }

    store.activeLocations = entries;
    return entries;
};

/**
 * Merges physical location mapping pins with algorithmic entity arrays (like dynamic Doctors)
 * Filters by Search Query and entityType
 */
export const executeLocationSearch = (searchQuery = '', entityType = '') => {
    const rawLocations = store.activeLocations || [];
    const doctors = window.doctorRegistry || []; // Fallback till Doctor extraction in Phase 5 part 2
    
    const term = searchQuery.toLowerCase().trim();

    // 1. Filter explicitly defined locations
    const explicitMatches = rawLocations.filter(e => {
        if (entityType && e.entity_type !== entityType) return false;
        if (term) {
            const haystack = [(e.name || ''), (e.floor || ''), (e.block || ''), (e.cabin || ''), (e.notes || ''), (e.entity_type || '')].join(' ').toLowerCase();
            return haystack.includes(term);
        }
        return true;
    });

    // 2. Extrapolate undocumented Doctors computationally
    if (!entityType || entityType === 'doctor') {
        doctors.forEach(d => {
            const exists = explicitMatches.find(e => e.entity_type === 'doctor' && (e.name || '').toLowerCase() === (`Dr. ${d.name}`).toLowerCase());
            if (!exists && (!term || d.name.toLowerCase().includes(term))) {
                explicitMatches.push({
                    id: `dr_${d.id}`,
                    entity_type: 'doctor',
                    name: `Dr. ${d.name}`,
                    specialization: d.specialization || '',
                    floor: '—',
                    block: '—',
                    cabin: '—',
                    notes: '',
                    phone: d.phone || '',
                    _auto: true
                });
            }
        });
    }

    return explicitMatches;
};
