// ════════════════════════════════════════════════════════════
//  PATIENT SELF-SCHEDULE SERVICE
//  Allows patients to view available slots and book appointments
// ════════════════════════════════════════════════════════════

(function() {
'use strict';

var _availableSlots = [];

function fetchAvailableSlots(clinicId, date, doctorName) {
    return new Promise(function(resolve, reject) {
        if (!clinicId || !date) {
            resolve([]);
            return;
        }

        var slots = [];
        var baseHours = 9;
        var endHours = 17;

        for (var hour = baseHours; hour < endHours; hour++) {
            for (var min = 0; min < 60; min += 30) {
                var timeStr = hour.toString().padStart(2, '0') + ':' + min.toString().padStart(2, '0');
                slots.push({
                    time: timeStr,
                    display: (hour > 12 ? (hour - 12) : hour) + ':' + min.toString().padStart(2, '0') + (hour >= 12 ? ' PM' : ' AM'),
                    available: Math.random() > 0.3
                });
            }
        }

        _availableSlots = slots;
        resolve(slots);
    });
}

function renderAvailableSlots(slots, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    if (!slots || slots.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">No slots available for selected date</div>';
        return;
    }

    var html = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">';
    var availableCount = 0;

    for (var i = 0; i < slots.length; i++) {
        var slot = slots[i];
        if (slot.available) {
            availableCount++;
            html += '<button class="slot-btn" data-time="' + slot.time + '" style="padding:10px 8px;border:1px solid var(--teal);border-radius:6px;background:var(--teal-pale);color:var(--teal);cursor:pointer;font-size:13px;transition:all 0.2s">' + slot.display + '</button>';
        } else {
            html += '<button disabled style="padding:10px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text-muted);cursor:not-allowed;font-size:13px;opacity:0.5">' + slot.display + '</button>';
        }
    }

    html += '</div>';

    if (availableCount === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--red)">No slots available. Please select another date.</div>';
    } else {
        container.innerHTML = html;

        var buttons = container.querySelectorAll('.slot-btn');
        for (var j = 0; j < buttons.length; j++) {
            buttons[j].onclick = function() {
                var allBtns = container.querySelectorAll('.slot-btn');
                for (var k = 0; k < allBtns.length; k++) {
                    allBtns[k].style.background = '';
                    allBtns[k].style.color = '';
                    allBtns[k].style.borderColor = '';
                }
                this.style.background = 'var(--teal)';
                this.style.color = '#fff';
                this.style.borderColor = 'var(--teal)';

                var timeInput = document.getElementById('bk_timeInp');
                if (timeInput) timeInput.value = this.dataset.time;
            };
        }
    }
}

function openPatientSelfSchedule() {
    var overlay = document.getElementById('patientSelfSchedule');
    if (overlay) { overlay.remove(); }

    overlay = document.createElement('div');
    overlay.id = 'patientSelfSchedule';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';

    var today = new Date().toISOString().split('T')[0];

    overlay.innerHTML =
        '<div class="modal" style="max-width:520px">' +
            '<div class="modal-header">' +
                '<div><div class="modal-title">📅 Book Your Appointment</div>' +
                '<div class="modal-subtitle">Select a convenient time slot</div></div>' +
                '<button class="modal-close" onclick="closePatientSelfSchedule()">✕</button>' +
            '</div>' +
            '<div class="modal-body">' +

                '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:14px;margin-bottom:16px">' +
                    '<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">📋 How it works</div>' +
                    '<ol style="font-size:12px;color:var(--text-secondary);padding-left:18px;line-height:1.8">' +
                        '<li>Select a doctor and date</li>' +
                        '<li>Pick an available time slot</li>' +
                        '<li>Enter your details and confirm</li>' +
                    '</ol>' +
                '</div>' +

                '<div class="field" style="margin-bottom:12px">' +
                    '<label>Select Doctor <span>*</span></label>' +
                    '<select id="pss_docSelect" onchange="loadPSS_slots()">' +
                        '<option value="">— Select Doctor —</option>' +
                    '</select>' +
                '</div>' +

                '<div class="field" style="margin-bottom:12px">' +
                    '<label>Select Date <span>*</span></label>' +
                    '<input type="date" id="pss_date" min="' + today + '" onchange="loadPSS_slots()">' +
                '</div>' +

                '<div id="pss_slots" style="margin-bottom:12px"></div>' +

                '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:8px">' +
                    '<div style="font-size:13px;font-weight:500;margin-bottom:8px">Your Details</div>' +
                    '<div class="field" style="margin-bottom:10px">' +
                        '<label>Your Name <span>*</span></label>' +
                        '<input type="text" id="pss_name" placeholder="Patient name">' +
                    '</div>' +
                    '<div class="field" style="margin-bottom:10px">' +
                        '<label>Phone <span>*</span></label>' +
                        '<input type="tel" id="pss_phone" placeholder="+91 XXXXX XXXXX">' +
                    '</div>' +
                    '<div class="field">' +
                        '<label>Symptoms / Reason</label>' +
                        '<input type="text" id="pss_reason" placeholder="e.g. General consultation, Follow-up...">' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="modal-footer">' +
                '<button class="btn-sm btn-outline-teal" onclick="closePatientSelfSchedule()">Cancel</button>' +
                '<button class="btn-sm btn-teal" id="pss_confirmBtn" onclick="pss_confirmBooking()">✅ Confirm Booking</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    loadDoctorsForPSS();
}

function loadDoctorsForPSS() {
    var select = document.getElementById('pss_docSelect');
    if (!select || typeof window.store === 'undefined' || !window.store.doctors) return;

    var doctors = window.store.doctors;
    for (var i = 0; i < doctors.length; i++) {
        var opt = document.createElement('option');
        opt.value = doctors[i].name;
        opt.textContent = 'Dr. ' + doctors[i].name + ' (' + (doctors[i].specialization || doctors[i].type) + ')';
        select.appendChild(opt);
    }

    var dateInput = document.getElementById('pss_date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
}

function loadPSS_slots() {
    var doc = document.getElementById('pss_docSelect')?.value;
    var date = document.getElementById('pss_date')?.value;

    if (!doc || !date) {
        var container = document.getElementById('pss_slots');
        if (container) container.innerHTML = '';
        return;
    }

    var container = document.getElementById('pss_slots');
    if (container) container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">⏳ Loading available slots...</div>';

    if (window.store && window.store.activeClinicId) {
        fetchAvailableSlots(window.store.activeClinicId, date, doc).then(function(slots) {
            renderAvailableSlots(slots, 'pss_slots');
        });
    }
}

async function pss_confirmBooking() {
    var name = document.getElementById('pss_name')?.value?.trim();
    var phone = document.getElementById('pss_phone')?.value?.trim();
    var doc = document.getElementById('pss_docSelect')?.value;
    var date = document.getElementById('pss_date')?.value;
    var time = document.getElementById('bk_timeInp')?.value;
    var reason = document.getElementById('pss_reason')?.value?.trim();

    if (!name) { showToast('Please enter your name', 'error'); return; }
    if (!phone) { showToast('Please enter your phone number', 'error'); return; }
    if (!doc || !date || !time) { showToast('Please select doctor, date and time slot', 'error'); return; }

    var btn = document.getElementById('pss_confirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Booking...'; }

    var clinicId = window.store?.activeClinicId || activeClinicId;

    var appt = {
        id: 'appt_' + Date.now().toString(36),
        clinic_id: clinicId,
        patient_name: name,
        patient_phone: phone,
        doctor_name: doc,
        appt_date: date,
        appt_time: time,
        reason: reason || 'Consultation',
        status: 'scheduled',
        visit_type: 'consultation',
        created_at: new Date().toISOString()
    };

    try {
        if (typeof window.dbUpsertAppointment === 'function') {
            await window.dbUpsertAppointment(appt);
            showToast('✅ Appointment booked for ' + name + ' on ' + date + ' at ' + time, 'success');
            closePatientSelfSchedule();
        } else {
            showToast('Booking service unavailable. Please contact clinic.', 'error');
        }
    } catch(e) {
        showToast('Failed to book. Please try again.', 'error');
    }

    if (btn) { btn.disabled = false; btn.textContent = '✅ Confirm Booking'; }
}

function closePatientSelfSchedule() {
    var overlay = document.getElementById('patientSelfSchedule');
    if (overlay) { overlay.remove(); }
    document.body.style.overflow = '';
}

window.openPatientSelfSchedule = openPatientSelfSchedule;
window.closePatientSelfSchedule = closePatientSelfSchedule;
window.fetchAvailableSlots = fetchAvailableSlots;
window.loadPSS_slots = loadPSS_slots;

})();