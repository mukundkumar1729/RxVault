// ═══════════════════════════════════════════════════════════════════
//  PATIENT SELF-SCHEDULE SERVICE (IMPROVED)
//  Allows patients to view available slots and book appointments
//  Mobile-friendly with progress steps
// ═══════════════════════════════════════════════════════════════════

(function() {
'use strict';

var _availableSlots = [];
var _currentStep = 1;
var _selectedDoctor = '';
var _selectedDate = '';
var _selectedTime = '';
var _selectedSymptom = '';

var SYMPTOMS = [
    { id: 'fever', label: 'Fever', icon: '🤒' },
    { id: 'cough', label: 'Cough/Cold', icon: '😷' },
    { id: 'pain', label: 'Pain', icon: '💊' },
    { id: 'checkup', label: 'General', icon: '🩺' },
    { id: 'followup', label: 'Follow-up', icon: '📅' },
    { id: 'stomach', label: 'Stomach', icon: '🤢' },
    { id: 'skin', label: 'Skin', icon: '🩹' },
    { id: 'other', label: 'Other', icon: '📝' }
];

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

function openPatientSelfSchedule() {
    var overlay = document.getElementById('patientSelfSchedule');
    if (overlay) { overlay.remove(); }

    _currentStep = 1;
    _selectedDoctor = '';
    _selectedDate = '';
    _selectedTime = '';
    _selectedSymptom = '';

    overlay = document.createElement('div');
    overlay.id = 'patientSelfSchedule';
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,34,64,0.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px';

    var clinicName = window.store && window.store.activeClinicName ? window.store.activeClinicName : 'Our Clinic';
    var clinicPhone = window.store && window.store.activeClinicPhone ? window.store.activeClinicPhone : '+91 XXXXX XXXXX';

    // Build symptom chips HTML
    var symptomChipsHtml = '';
    for (var s = 0; s < SYMPTOMS.length; s++) {
        symptomChipsHtml += '<button type="button" onclick="pss_selectSymptom(\'' + SYMPTOMS[s].id + '\')" id="pss_symptom_' + SYMPTOMS[s].id + '" ' +
            'style="padding:10px 12px;border:1px solid var(--border);border-radius:20px;background:var(--surface);color:var(--text-primary);cursor:pointer;font-size:12px;transition:all 0.2s;margin-bottom:4px">' + 
            SYMPTOMS[s].icon + ' ' + SYMPTOMS[s].label + '</button>';
    }

    var modalHtml = 
        '<div class="modal" style="max-width:420px;width:100%;border-radius:16px;max-height:90vh;display:flex;flex-direction:column;background:var(--surface);font-family:inherit">' +
            '<div class="modal-header" style="padding:16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">' +
                '<div><div class="modal-title" style="font-size:18px;font-weight:600">Book Appointment</div>' +
                '<div class="modal-subtitle" style="font-size:12px;color:var(--text-secondary)">' + clinicName + '</div></div>' +
                '<button type="button" onclick="closePatientSelfSchedule()" style="width:32px;height:32px;border:none;background:transparent;font-size:18px;cursor:pointer;border-radius:8px;color:var(--text-secondary)">✕</button>' +
            '</div>' +

            // Progress Steps
            '<div style="display:flex;padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border);gap:8px">' +
                '<div id="pss_step1" style="flex:1;text-align:center;padding:8px 4px;border-radius:8px;background:var(--teal);color:#fff;font-size:11px;font-weight:600">1. Select</div>' +
                '<div id="pss_step2" style="flex:1;text-align:center;padding:8px 4px;border-radius:8px;background:var(--border);color:var(--text-muted);font-size:11px;font-weight:600">2. Details</div>' +
                '<div id="pss_step3" style="flex:1;text-align:center;padding:8px 4px;border-radius:8px;background:var(--border);color:var(--text-muted);font-size:11px;font-weight:600">3. Confirm</div>' +
            '</div>' +

            '<div class="modal-body" id="pss_body" style="flex:1;overflow-y:auto;padding:16px">' +

                // STEP 1: Select Doctor & Date
                '<div id="pss_step1_content">' +
                    // Clinic Info Card
                    '<div style="background:var(--teal-pale);border:1px solid var(--teal);border-radius:12px;padding:12px;margin-bottom:16px">' +
                        '<div style="font-size:12px;font-weight:600;color:var(--teal);margin-bottom:4px">🏥 ' + clinicName + '</div>' +
                        '<div style="font-size:11px;color:var(--text-secondary)">📞 ' + clinicPhone + '</div>' +
                    '</div>' +

                    // Quick Symptom Select
                    '<div style="font-size:12px;font-weight:500;margin-bottom:8px">What brings you here?</div>' +
                    '<div id="pss_symptoms" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">' + symptomChipsHtml + '</div>' +

                    // Doctor Select
                    '<div style="margin-bottom:12px">' +
                        '<label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px">Select Doctor <span style="color:var(--red)">*</span></label>' +
                        '<select id="pss_docSelect" onchange="pss_onDoctorChange()" style="width:100%;padding:12px;font-size:14px;border:1px solid var(--border);border-radius:8px;background:var(--surface);min-height:48px;box-sizing:border-box">' +
                            '<option value="">— Select Doctor —</option>' +
                        '</select>' +
                    '</div>' +

                    // Date Select
                    '<div style="margin-bottom:12px">' +
                        '<label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px">Select Date <span style="color:var(--red)">*</span></label>' +
                        '<input type="date" id="pss_date" onchange="pss_onDateChange()" style="width:100%;padding:12px;font-size:14px;border:1px solid var(--border);border-radius:8px;background:var(--surface);min-height:48px;box-sizing:border-box">' +
                    '</div>' +

                    // Time Slots
                    '<div id="pss_slots" style="margin-bottom:12px"></div>' +

                    '<button type="button" onclick="pss_goToStep2()" id="pss_next1" disabled style="width:100%;padding:14px;border:none;border-radius:10px;background:var(--border);color:var(--text-muted);font-size:14px;font-weight:600;cursor:not-allowed;min-height:48px;margin-top:8px">Continue</button>' +
                '</div>' +

                // STEP 2: Patient Details
                '<div id="pss_step2_content" style="display:none">' +
                    '<div style="font-size:13px;font-weight:600;margin-bottom:12px">Your Details</div>' +

                    '<div style="margin-bottom:12px">' +
                        '<label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px">Your Name <span style="color:var(--red)">*</span></label>' +
                        '<input type="text" id="pss_name" oninput="pss_checkStep2Complete()" placeholder="Patient name" style="width:100%;padding:12px;font-size:14px;border:1px solid var(--border);border-radius:8px;background:var(--surface);min-height:48px;box-sizing:border-box">' +
                    '</div>' +

                    '<div style="margin-bottom:12px">' +
                        '<label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px">Phone <span style="color:var(--red)">*</span></label>' +
                        '<input type="tel" id="pss_phone" oninput="pss_checkStep2Complete()" placeholder="+91 XXXXX XXXXX" style="width:100%;padding:12px;font-size:14px;border:1px solid var(--border);border-radius:8px;background:var(--surface);min-height:48px;box-sizing:border-box">' +
                    '</div>' +

                    '<div style="margin-bottom:12px">' +
                        '<label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px">Email</label>' +
                        '<input type="email" id="pss_email" placeholder="email@example.com" style="width:100%;padding:12px;font-size:14px;border:1px solid var(--border);border-radius:8px;background:var(--surface);min-height:48px;box-sizing:border-box">' +
                    '</div>' +

                    '<div style="display:flex;gap:12px;margin-bottom:12px">' +
                        '<div style="flex:1">' +
                            '<label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px">Date of Birth</label>' +
                            '<input type="date" id="pss_dob" style="width:100%;padding:12px;font-size:14px;border:1px solid var(--border);border-radius:8px;background:var(--surface);min-height:48px;box-sizing:border-box">' +
                        '</div>' +
                        '<div style="flex:1">' +
                            '<label style="font-size:12px;font-weight:500;display:block;margin-bottom:4px">Gender</label>' +
                            '<select id="pss_gender" style="width:100%;padding:12px;font-size:14px;border:1px solid var(--border);border-radius:8px;background:var(--surface);min-height:48px;box-sizing:border-box">' +
                                '<option value="">Select</option>' +
                                '<option value="male">Male</option>' +
                                '<option value="female">Female</option>' +
                                '<option value="other">Other</option>' +
                            '</select>' +
                        '</div>' +
                    '</div>' +

                    '<div style="display:flex;gap:12px;margin-top:16px">' +
                        '<button type="button" onclick="pss_backToStep1()" style="flex:1;padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text-primary);font-size:14px;font-weight:600;cursor:pointer;min-height:48px">Back</button>' +
                        '<button type="button" onclick="pss_goToStep3()" id="pss_next2" style="flex:1;padding:14px;border:none;border-radius:10px;background:var(--border);color:var(--text-muted);font-size:14px;font-weight:600;cursor:not-allowed;min-height:48px">Review</button>' +
                    '</div>' +
                '</div>' +

                // STEP 3: Confirm
                '<div id="pss_step3_content" style="display:none">' +
                    '<div style="font-size:13px;font-weight:600;margin-bottom:12px">Booking Summary</div>' +

                    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px">' +
                        '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px"><span>Doctor:</span><span id="pss_summary_doc" style="font-weight:600"></span></div>' +
                        '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px"><span>Date:</span><span id="pss_summary_date" style="font-weight:600"></span></div>' +
                        '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px"><span>Time:</span><span id="pss_summary_time" style="font-weight:600;color:var(--teal)"></span></div>' +
                        '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px"><span>Reason:</span><span id="pss_summary_reason" style="font-weight:600"></span></div>' +
                        '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px"><span>Patient:</span><span id="pss_summary_name" style="font-weight:600"></span></div>' +
                        '<div style="display:flex;justify-content:space-between;font-size:13px"><span>Phone:</span><span id="pss_summary_phone" style="font-weight:600"></span></div>' +
                    '</div>' +

                    '<button type="button" onclick="pss_goToStep1()" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text-secondary);font-size:12px;cursor:pointer;margin-bottom:8px">Edit Booking Details</button>' +
                    '<button type="button" onclick="pss_goToStep2()" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;background:transparent;color:var(--text-secondary);font-size:12px;cursor:pointer;margin-bottom:16px">Edit Patient Details</button>' +

                    '<button type="button" onclick="pss_confirmBooking()" id="pss_confirmBtn" style="width:100%;padding:16px;border:none;border-radius:12px;background:var(--teal);color:#fff;font-size:15px;font-weight:700;cursor:pointer;min-height:56px">Confirm Booking</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    overlay.innerHTML = modalHtml;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    loadDoctorsForPSS();

    // Set min date to today
    var dateInput = document.getElementById('pss_date');
    if (dateInput) {
        var today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
    }
}

function pss_selectSymptom(id) {
    _selectedSymptom = id;
    
    // Update UI
    var buttons = document.querySelectorAll('[id^="pss_symptom_"]');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].style.background = 'var(--surface)';
        buttons[i].style.borderColor = 'var(--border)';
        buttons[i].style.color = 'var(--text-primary)';
    }
    
    var selectedBtn = document.getElementById('pss_symptom_' + id);
    if (selectedBtn) {
        selectedBtn.style.background = 'var(--teal)';
        selectedBtn.style.borderColor = 'var(--teal)';
        selectedBtn.style.color = '#fff';
    }
}

function loadDoctorsForPSS() {
    var select = document.getElementById('pss_docSelect');
    if (!select) return;

    // Try multiple sources for doctors
    var doctors = [];
    
    // Source 1: window.doctorRegistry
    if (window.doctorRegistry && window.doctorRegistry.length > 0) {
        doctors = window.doctorRegistry;
    } 
    // Source 2: doctorRegistry global
    else if (typeof doctorRegistry !== 'undefined' && doctorRegistry && doctorRegistry.length > 0) {
        doctors = doctorRegistry;
    }
    // Source 3: window.store.doctors
    else if (window.store && window.store.doctors && window.store.doctors.length > 0) {
        doctors = window.store.doctors;
    }
    
    // Debug: if still empty, try getting from DB directly
    if (doctors.length === 0 && window.activeClinicId && typeof window.dbGetDoctors === 'function') {
        // Will try async but can't await here easily, so show loading
        select.innerHTML = '<option value="">Loading doctors...</option>';
        window.dbGetDoctors(window.activeClinicId).then(function(docs) {
            doctors = docs || [];
            populateDoctorSelect(doctors);
        }).catch(function() {
            select.innerHTML = '<option value="">No doctors available</option>';
        });
        return;
    }
    
    populateDoctorSelect(doctors);
}

function populateDoctorSelect(doctors) {
    var select = document.getElementById('pss_docSelect');
    if (!select) return;
    
    if (!doctors || doctors.length === 0) {
        select.innerHTML = '<option value="">No doctors available</option>';
        return;
    }
    
    // Clear and populate
    select.innerHTML = '<option value="">— Select Doctor —</option>';
    for (var i = 0; i < doctors.length; i++) {
        var opt = document.createElement('option');
        opt.value = doctors[i].name;
        var type = doctors[i].specialization || doctors[i].type || '';
        opt.textContent = 'Dr. ' + doctors[i].name + (type ? ' (' + type + ')' : '');
        select.appendChild(opt);
    }
}

function pss_onDoctorChange() {
    var select = document.getElementById('pss_docSelect');
    _selectedDoctor = select ? select.value : '';
    pss_checkStep1Complete();
    pss_loadSlots();
}

function pss_onDateChange() {
    var dateInput = document.getElementById('pss_date');
    _selectedDate = dateInput ? dateInput.value : '';
    pss_checkStep1Complete();
    pss_loadSlots();
}

function pss_checkStep1Complete() {
    var nextBtn = document.getElementById('pss_next1');
    if (_selectedDoctor && _selectedDate && _selectedTime) {
        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.style.background = 'var(--teal)';
            nextBtn.style.color = '#fff';
            nextBtn.style.cursor = 'pointer';
        }
    } else {
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.style.background = 'var(--border)';
            nextBtn.style.color = 'var(--text-muted)';
            nextBtn.style.cursor = 'not-allowed';
        }
    }
}

function pss_checkStep2Complete() {
    var name = document.getElementById('pss_name');
    var phone = document.getElementById('pss_phone');
    var nextBtn = document.getElementById('pss_next2');
    
    if (name && name.value.trim() && phone && phone.value.trim()) {
        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.style.background = 'var(--teal)';
            nextBtn.style.color = '#fff';
            nextBtn.style.cursor = 'pointer';
        }
    } else {
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.style.background = 'var(--border)';
            nextBtn.style.color = 'var(--text-muted)';
            nextBtn.style.cursor = 'not-allowed';
        }
    }
}

function pss_loadSlots() {
    if (!_selectedDoctor || !_selectedDate) {
        var container = document.getElementById('pss_slots');
        if (container) container.innerHTML = '';
        return;
    }

    var container = document.getElementById('pss_slots');
    if (container) container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px">Loading slots...</div>';

    // Always generate mock slots for demo
    var mockSlots = [];
    for (var h = 9; h < 17; h++) {
        for (var m = 0; m < 60; m += 30) {
            var timeStr = h.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0');
            mockSlots.push({
                time: timeStr,
                display: (h > 12 ? h - 12 : h) + ':' + m.toString().padStart(2, '0') + (h >= 12 ? ' PM' : ' AM'),
                available: Math.random() > 0.3
            });
        }
    }
    
    // Simulate async load - get container fresh inside callback
    setTimeout(function() {
        var cont = document.getElementById('pss_slots');
        if (cont) {
            renderPSS_Slots(mockSlots, cont);
        }
    }, 500);
}

function renderPSS_Slots(slots, container) {
    if (!container) container = document.getElementById('pss_slots');
    if (!container) return;

    if (!slots || slots.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px">No slots available</div>';
        return;
    }

    var html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';
    var availableCount = 0;

    for (var i = 0; i < slots.length; i++) {
        var slot = slots[i];
        if (slot.available) {
            availableCount++;
            html += '<button type="button" class="pss-slot-btn" data-time="' + slot.time + '" ' +
                'style="padding:14px 8px;border:1px solid var(--teal);border-radius:10px;background:var(--teal-pale);color:var(--teal);cursor:pointer;font-size:13px;font-weight:500;min-height:48px;transition:all 0.2s">' + 
                slot.display + '</button>';
        } else {
            html += '<button type="button" disabled style="padding:14px 8px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--text-muted);cursor:not-allowed;font-size:13px;opacity:0.5;min-height:48px">' + 
                slot.display + '</button>';
        }
    }

    html += '</div>';

    if (availableCount === 0) {
        container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--red);font-size:12px">No slots. Try another date.</div>';
    } else {
        container.innerHTML = html;

        var buttons = container.querySelectorAll('.pss-slot-btn');
        for (var j = 0; j < buttons.length; j++) {
            buttons[j].onclick = function() {
                var allBtns = container.querySelectorAll('.pss-slot-btn');
                for (var k = 0; k < allBtns.length; k++) {
                    allBtns[k].style.background = '';
                    allBtns[k].style.color = '';
                    allBtns[k].style.borderColor = '';
                }
                this.style.background = 'var(--teal)';
                this.style.color = '#fff';
                this.style.borderColor = 'var(--teal)';

                _selectedTime = this.dataset.time;
                
                // Add hidden input for time
                var timeInp = document.getElementById('bk_timeInp');
                if (!timeInp) {
                    timeInp = document.createElement('input');
                    timeInp.id = 'bk_timeInp';
                    timeInp.type = 'hidden';
                    document.body.appendChild(timeInp);
                }
                timeInp.value = _selectedTime;

                pss_checkStep1Complete();
            };
        }
    }
}

function pss_goToStep2() {
    if (!_selectedDoctor || !_selectedDate || !_selectedTime) {
        alert('Please select doctor, date and time slot');
        return;
    }
    
    _currentStep = 2;
    updatePSS_Steps();
    
    document.getElementById('pss_step1_content').style.display = 'none';
    document.getElementById('pss_step2_content').style.display = 'block';
    document.getElementById('pss_step3_content').style.display = 'none';
}

function pss_backToStep1() {
    _currentStep = 1;
    updatePSS_Steps();
    
    document.getElementById('pss_step1_content').style.display = 'block';
    document.getElementById('pss_step2_content').style.display = 'none';
    document.getElementById('pss_step3_content').style.display = 'none';
}

function pss_goToStep3() {
    var name = document.getElementById('pss_name');
    var phone = document.getElementById('pss_phone');
    
    if (!name || !name.value.trim()) { alert('Please enter your name'); return; }
    if (!phone || !phone.value.trim()) { alert('Please enter phone number'); return; }

    // Clear validation first
    pss_checkStep2Complete();
    
    // Check if button is still disabled
    var nextBtn = document.getElementById('pss_next2');
    if (nextBtn && nextBtn.disabled) {
        return; // Don't proceed if validation failed
    }
    
    _currentStep = 3;
    updatePSS_Steps();

    // Update summary
    var docEl = document.getElementById('pss_summary_doc');
    var dateEl = document.getElementById('pss_summary_date');
    var timeEl = document.getElementById('pss_summary_time');
    var reasonEl = document.getElementById('pss_summary_reason');
    var nameEl = document.getElementById('pss_summary_name');
    var phoneEl = document.getElementById('pss_summary_phone');
    
    if (docEl) docEl.textContent = 'Dr. ' + _selectedDoctor;
    if (dateEl) dateEl.textContent = _selectedDate;
    if (timeEl) timeEl.textContent = _selectedTime;
    
    var reasonText = _selectedSymptom;
    for (var i = 0; i < SYMPTOMS.length; i++) {
        if (SYMPTOMS[i].id === _selectedSymptom) {
            reasonText = SYMPTOMS[i].icon + ' ' + SYMPTOMS[i].label;
            break;
        }
    }
    if (reasonEl) reasonEl.textContent = reasonText;
    if (nameEl) nameEl.textContent = name.value.trim();
    if (phoneEl) phoneEl.textContent = phone.value.trim();

    // Hide other steps, show confirmation
    var step1 = document.getElementById('pss_step1_content');
    var step2 = document.getElementById('pss_step2_content');
    var step3 = document.getElementById('pss_step3_content');
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'none';
    if (step3) step3.style.display = 'block';
}

function updatePSS_Steps() {
    var colors = ['var(--teal)', 'var(--border)'];
    var textColors = ['#fff', 'var(--text-muted)'];
    
    var step1 = document.getElementById('pss_step1');
    var step2 = document.getElementById('pss_step2');
    var step3 = document.getElementById('pss_step3');
    
    if (step1) { step1.style.background = _currentStep === 1 ? colors[0] : colors[1]; step1.style.color = _currentStep === 1 ? textColors[0] : textColors[1]; }
    if (step2) { step2.style.background = _currentStep === 2 ? colors[0] : colors[1]; step2.style.color = _currentStep === 2 ? textColors[0] : textColors[1]; }
    if (step3) { step3.style.background = _currentStep === 3 ? colors[0] : colors[1]; step3.style.color = _currentStep === 3 ? textColors[0] : textColors[1]; }
}

function pss_confirmBooking() {
    var name = document.getElementById('pss_name');
    var phone = document.getElementById('pss_phone');
    var age = document.getElementById('pss_age');

    if (!name || !name.value.trim()) { alert('Please enter your name'); return; }
    if (!phone || !phone.value.trim()) { alert('Please enter phone number'); return; }
    if (!_selectedDoctor || !_selectedDate || !_selectedTime) { alert('Please complete all fields'); return; }

    var btn = document.getElementById('pss_confirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Booking...'; }

    var clinicId = window.store && window.store.activeClinicId ? window.store.activeClinicId : null;

    var reasonText = 'Consultation';
    for (var i = 0; i < SYMPTOMS.length; i++) {
        if (SYMPTOMS[i].id === _selectedSymptom) {
            reasonText = SYMPTOMS[i].label;
            break;
        }
    }

    var appt = {
        id: 'appt_' + Date.now().toString(36),
        clinic_id: clinicId,
        patient_name: name.value.trim(),
        patient_phone: phone.value.trim(),
        patient_age: age && age.value ? age.value.trim() : null,
        doctor_name: _selectedDoctor,
        appt_date: _selectedDate,
        appt_time: _selectedTime,
        reason: reasonText,
        status: 'scheduled',
        visit_type: 'consultation',
        created_at: new Date().toISOString()
    };

    if (typeof window.dbUpsertAppointment === 'function') {
        window.dbUpsertAppointment(appt).then(function() {
            alert('Appointment booked for ' + name.value.trim() + ' on ' + _selectedDate + ' at ' + _selectedTime);
            closePatientSelfSchedule();
            pss_showWhatsAppShare(name.value.trim(), _selectedDate, _selectedTime, _selectedDoctor);
        }).catch(function(e) {
            alert('Failed to book: ' + e.message);
            if (btn) { btn.disabled = false; btn.textContent = 'Confirm Booking'; }
        });
    } else {
        // Demo mode - just show success
        alert('Appointment booked for ' + name.value.trim() + ' on ' + _selectedDate + ' at ' + _selectedTime + ' (Demo mode)');
        closePatientSelfSchedule();
    }
}

function pss_showWhatsAppShare(name, date, time, doctor) {
    var msg = 'Appointment Booked:%0ADr. ' + doctor + '%0ADate: ' + date + '%0ATime: ' + time + '%0APatient: ' + name + '%0A%0ABooked via RxVault';
    var waUrl = 'https://wa.me/?text=' + msg;
    
    window.open(waUrl, '_blank');
}

function closePatientSelfSchedule() {
    var overlay = document.getElementById('patientSelfSchedule');
    if (overlay) { overlay.remove(); }
    document.body.style.overflow = '';
}

window.openPatientSelfSchedule = openPatientSelfSchedule;
window.closePatientSelfSchedule = closePatientSelfSchedule;
window.pss_selectSymptom = pss_selectSymptom;
window.pss_onDoctorChange = pss_onDoctorChange;
window.pss_onDateChange = pss_onDateChange;
window.pss_checkStep2Complete = pss_checkStep2Complete;
window.pss_goToStep2 = pss_goToStep2;
window.pss_backToStep1 = pss_backToStep1;
window.pss_goToStep3 = pss_goToStep3;
window.pss_confirmBooking = pss_confirmBooking;
window.fetchAvailableSlots = fetchAvailableSlots;

})();