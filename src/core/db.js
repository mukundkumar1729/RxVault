import { store } from './store.js';
// ════════════════════════════════════════════════════════════
//  SUPABASE.JS — Full database layer for Rx Vault
//  Includes: core CRUD + AI search + auth functions
//  Load order: FIRST (before clinic.js, auth.js, script.js)
// ════════════════════════════════════════════════════════════

export const SUPABASE_URL = 'https://wavakcolrtrwmjcjkdfc.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_T0hi4JUMec0BU0si3U8UCQ_gShxYVYm';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
export const db = createClient(SUPABASE_URL, SUPABASE_KEY);

export const dbErr = function(label, error) {
  console.error('[DB] ' + label + ':', error?.message || error);
}

// ─── Loading overlay ──────────────────────────────────────
export const showLoading = function(msg) {
  msg = msg || 'Loading…';
  var el = document.getElementById('dbLoadingOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dbLoadingOverlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(15,30,48,0.55);backdrop-filter:blur(3px);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:#fff;font-family:DM Sans,sans-serif';
    el.innerHTML = '<div style="width:36px;height:36px;border:3px solid rgba(255,255,255,0.2);border-top-color:#fff;border-radius:50%;animation:dbSpin 0.7s linear infinite"></div><div id="dbLoadingMsg" style="font-size:14px;font-weight:500;opacity:0.85">' + msg + '</div>';
    var style = document.createElement('style');
    style.textContent = '@keyframes dbSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
    document.body.appendChild(el);
  } else {
    var msgEl = document.getElementById('dbLoadingMsg');
    if (msgEl) msgEl.textContent = msg;
    el.style.display = 'flex';
  }
}
export const hideLoading = function() {
  var el = document.getElementById('dbLoadingOverlay');
  if (el) el.style.display = 'none';
}

// ════════════════════════════════════════════════════════════
//  CLINICS
// ════════════════════════════════════════════════════════════
export const dbGetClinics = async function() {
  const { data, error } = await db.from('clinics').select('*').order('created_at', { ascending: true });
  if (error) { dbErr('getClinics', error); return []; }
  return (data || []).map(dbToClinic);
}
export const dbInsertClinic = async function(clinic) {
  const { data, error } = await db.from('clinics').insert(clinicToDb(clinic)).select().single();
  if (error) { dbErr('insertClinic', error); return null; }
  return dbToClinic(data);
}
export const dbUpdateClinic = async function(id, fields) {
  const row = clinicToDb(fields);
  delete row.id; delete row.created_at;
  const { error } = await db.from('clinics').update(row).eq('id', id);
  if (error) { dbErr('updateClinic', error); return false; }
  return true;
}
export const dbDeleteClinic = async function(id) {
  const { error } = await db.from('clinics').delete().eq('id', id);
  if (error) { dbErr('deleteClinic', error); return false; }
  return true;
}
export const clinicToDb = function(c) {
  return {
    id: c.id, name: c.name||'', address: c.address||'', phone: c.phone||'',
    email: c.email||'', type: c.type||'multispecialty', logo: c.logo||'🏥',
    pin: c.pin||'admin1234', plan: c.plan||'free', gemini_key: c.geminiKey||'',
    created_at: c.createdAt||new Date().toISOString()
  };
}
export const dbToClinic = function(r) {
  return {
    id: r.id, name: r.name, address: r.address||'', phone: r.phone||'',
    email: r.email||'', type: r.type||'multispecialty', logo: r.logo||'🏥',
    pin: r.pin||'admin1234', plan: r.plan||'free', geminiKey: r.gemini_key||'',
    createdAt: r.created_at
  };
}

// ════════════════════════════════════════════════════════════
//  PRESCRIPTIONS
// ════════════════════════════════════════════════════════════
export const dbGetPrescriptions = async function(clinicId) {
  const { data, error } = await db.from('prescriptions').select('*').eq('clinic_id', clinicId).order('date', { ascending: false });
  if (error) { dbErr('getPrescriptions', error); return []; }
  return (data || []).map(dbToRx);
}
export const dbUpsertPrescription = async function(rx) {
  const row = rxToDb(rx);
  const { error } = await db.from('prescriptions').upsert(row, { onConflict: 'id' });
  if (error) { dbErr('upsertPrescription', error); return false; }
  return true;
}
export const dbDeletePrescription = async function(id) {
  const { error } = await db.from('prescriptions').delete().eq('id', id);
  if (error) { dbErr('deletePrescription', error); return false; }
  return true;
}
export const rxToDb = function(p) {
  return {
    id: p.id, clinic_id: p.clinicId, type: p.type||'allopathy',
    patient_name: p.patientName||'', age: p.age||'', gender: p.gender||'',
    blood_group: p.bloodGroup||'', phone: p.phone||'', email: p.email||'',
    doctor_name: p.doctorName||'', specialization: p.specialization||'',
    hospital: p.hospital||'', reg_no: p.regNo||'', doctor_phone: p.doctorPhone||'',
    date: p.date||'', valid_until: p.validUntil||'', diagnosis: p.diagnosis||'',
    status: p.status||'active', medicines: p.medicines||[], diagnostics: p.diagnostics||[],
    notes: p.notes||'', note_categories: p.noteCategories||[], revisions: p.revisions||[], dispense_date: p.dispenseDate||null,
    created_at: p.createdAt||new Date().toISOString(), updated_at: p.updatedAt||new Date().toISOString()
  };
}
export const dbToRx = function(r) {
  return {
    id: r.id, clinicId: r.clinic_id, type: r.type, patientName: r.patient_name,
    age: r.age||'', gender: r.gender||'', bloodGroup: r.blood_group||'',
    phone: r.phone||'', email: r.email||'', doctorName: r.doctor_name,
    specialization: r.specialization||'', hospital: r.hospital||'',
    regNo: r.reg_no||'', doctorPhone: r.doctor_phone||'', date: r.date,
    validUntil: r.valid_until||'', diagnosis: r.diagnosis||'',
    status: r.status||'active', medicines: r.medicines||[], diagnostics: r.diagnostics||[],
    notes: r.notes||'', noteCategories: r.note_categories||[], revisions: r.revisions||[], dispenseDate: r.dispense_date||null,
    createdAt: r.created_at, updatedAt: r.updated_at
  };
}

// ════════════════════════════════════════════════════════════
//  DOCTORS
// ════════════════════════════════════════════════════════════
export const dbGetDoctors = async function(clinicId) {
  const { data, error } = await db.from('doctors').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: true });
  if (error) { dbErr('getDoctors', error); return []; }
  return (data || []).map(dbToDoctor);
}
export const dbUpsertDoctor = async function(doctor, clinicId) {
  const row = doctorToDb(doctor, clinicId);
  const { error } = await db.from('doctors').upsert(row, { onConflict: 'id' });
  if (error) { dbErr('upsertDoctor', error); return false; }
  return true;
}
export const dbDeleteDoctor = async function(id) {
  const { error } = await db.from('doctors').delete().eq('id', id);
  if (error) { dbErr('deleteDoctor', error); return false; }
  return true;
}
export const doctorToDb = function(d, clinicId) {
  return {
    id: d.id||('dr_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)),
    clinic_id: clinicId||d.clinicId, reg_no: d.regNo||'', name: d.name||'',
    qualification: d.qualification||'', specialization: d.specialization||'',
    hospital: d.hospital||'', phone: d.phone||'', email: d.email||'',
    address: d.address||'', type: d.type||'allopathy',
    availability: d.availability||[], unavailable: d.unavailable||false
  };
}
export const dbToDoctor = function(r) {
  return {
    id: r.id, clinicId: r.clinic_id, regNo: r.reg_no||'', name: r.name,
    qualification: r.qualification||'', specialization: r.specialization||'',
    hospital: r.hospital||'', phone: r.phone||'', email: r.email||'',
    address: r.address||'', type: r.type||'allopathy',
    availability: r.availability||[], unavailable: r.unavailable||false
  };
}

// ════════════════════════════════════════════════════════════
//  PATIENTS
// ════════════════════════════════════════════════════════════
export const dbGetPatients = async function(clinicId) {
  const { data, error } = await db.from('patients').select('*').eq('clinic_id', clinicId).order('registered_at', { ascending: false });
  if (error) { dbErr('getPatients', error); return []; }
  return (data || []).map(dbToPatient);
}
export const dbInsertPatient = async function(patient) {
  const row = patientToDb(patient);
  const { error } = await db.from('patients').upsert(row, { onConflict: 'id' });
  if (error) { dbErr('insertPatient', error); return false; }
  return true;
}
export const patientToDb = function(p) {
  return {
    id: p.id, clinic_id: p.clinicId, name: p.name||'', age: p.age||'',
    gender: p.gender||'', blood_group: p.bloodGroup||'', phone: p.phone||'',
    email: p.email||'', address: p.address||'', consultant_doctor: p.consultantDoctor||'',
    consultant_fee: p.consultantFee||0, payment_method: p.paymentMethod||'Cash',
    registration_date: p.registrationDate||'', registered_at: p.registeredAt||new Date().toISOString(),
    last_fee_date: p.lastFeeDate||null
  };
}
export const dbToPatient = function(r) {
  return {
    id: r.id, clinicId: r.clinic_id, name: r.name, age: r.age||'',
    gender: r.gender||'', bloodGroup: r.blood_group||'', phone: r.phone||'',
    email: r.email||'', address: r.address||'', consultantDoctor: r.consultant_doctor||'',
    consultantFee: r.consultant_fee||0, paymentMethod: r.payment_method||'Cash',
    registrationDate: r.registration_date||'', registeredAt: r.registered_at,
    lastFeeDate: r.last_fee_date||null
  };
}

// ════════════════════════════════════════════════════════════
//  AI SEARCH
// ════════════════════════════════════════════════════════════
export const dbSearchFuzzy = async function(query, clinicId, limit) {
  limit = limit || 10;
  const { data, error } = await db.rpc('search_similar_fuzzy', { p_query: query, p_clinic_id: clinicId, p_limit: limit });
  if (error) { dbErr('searchFuzzy', error); return []; }
  return data || [];
}
export const dbSearchSemantic = async function(embedding, clinicId, limit) {
  limit = limit || 10;
  const { data, error } = await db.rpc('search_similar_semantic', { p_embedding: embedding, p_clinic_id: clinicId, p_limit: limit });
  if (error) { dbErr('searchSemantic', error); return []; }
  return data || [];
}
export const dbStoreEmbedding = async function(prescriptionId, embedding) {
  const { error } = await db.from('prescriptions').update({ embedding }).eq('id', prescriptionId);
  if (error) { dbErr('storeEmbedding', error); }
}
export const dbUpdateClinicPlan = async function(clinicId, plan, geminiKey) {
  const { error } = await db.from('clinics').update({ plan, gemini_key: geminiKey||'' }).eq('id', clinicId);
  if (error) { dbErr('updateClinicPlan', error); return false; }
  return true;
}

// ════════════════════════════════════════════════════════════
//  AUTH DB FUNCTIONS
// ════════════════════════════════════════════════════════════
export const dbLogin = async function(email, password) {
  const { data, error } = await db.rpc('login_user', { p_email: email.toLowerCase().trim(), p_password: password });
  if (error) { dbErr('login', error); return null; }
  return (data && data.length > 0) ? data[0] : null;
}
export const dbGetUserClinics = async function(userId) {
  const { data, error } = await db.rpc('get_user_clinics', { p_user_id: userId });
  if (error) { dbErr('getUserClinics', error); return []; }
  return data || [];
}
export const dbGetClinicStaff = async function(clinicId) {
  const { data, error } = await db.rpc('get_clinic_staff', { p_clinic_id: clinicId });
  if (error) { dbErr('getClinicStaff', error); return []; }
  return data || [];
}
export const dbGetStaffMember = async function(clinicId, userId) {
  const { data, error } = await db.from('clinic_staff').select('*').eq('clinic_id', clinicId).eq('user_id', userId).maybeSingle();
  if (error) { dbErr('getStaffMember', error); return null; }
  return data;
}
export const dbCreateStaffUser = async function(name, email, password, role, clinicId, assignedBy, staffType) {
  var existing;
  try {
    const res = await db.from('users').select('id,email').eq('email', email.toLowerCase().trim()).maybeSingle();
    existing = res.data;
  } catch(e) {}

  var userId;
  if (existing) {
    userId = existing.id;
  } else {
    const { data: newUser, error: userErr } = await db.rpc('create_staff_user', {
      p_name: name, p_email: email.toLowerCase().trim(), p_password: password, p_role: 'staff'
    });
    if (userErr) { dbErr('createStaffUser', userErr); return { success: false, error: userErr.message }; }
    userId = newUser;
  }

  const { error: staffErr } = await db.from('clinic_staff').upsert({
    clinic_id: clinicId, user_id: userId, role: role,
    staff_type: staffType || 'permanent',
    is_active: true, assigned_by: assignedBy||null
  }, { onConflict: 'clinic_id,user_id' });

  if (staffErr) { dbErr('assignStaff', staffErr); return { success: false, error: staffErr.message }; }
  return { success: true, userId };
}
// ─── Clinic Calls (Digital Bell) ──────────────────────────
export const dbRingBell = async function(clinicId, callerName, message) {
  var { data, error } = await db.from('clinic_calls').insert({ clinic_id: clinicId, caller_name: callerName, message: message || 'Staff requested at OPD', status: 'active' });
  return !error;
}
export const dbGetActiveCalls = async function(clinicId) {
  var { data, error } = await db.from('clinic_calls').select('*').eq('clinic_id', clinicId).eq('status', 'active').order('created_at', { ascending: false });
  if (error) {
    dbErr('getActiveCalls', error);
    return [];
  }
  return data || [];
}

export const dbClearCall = async function(callId) {
  var { data, error } = await db.from('clinic_calls').update({ status: 'cleared' }).eq('id', callId);
  return !error;
}
export const dbUpdateStaffStatus = async function(clinicId, userId, status, until) {
  const { error } = await db.from('clinic_staff').update({
    status: status,
    status_until: until,
    updated_at: new Date().toISOString()
  }).eq('clinic_id', clinicId).eq('user_id', userId);
  if (error) { 
    console.error('[dbUpdateStaffStatus] failed:', error);
    dbErr('updateStaffStatus', error); 
    return false; 
  }
  return true;
}
export const dbUpdateStaffRole = async function(clinicId, userId, newRole) {
  const { error } = await db.from('clinic_staff').update({ role: newRole, updated_at: new Date().toISOString() }).eq('clinic_id', clinicId).eq('user_id', userId);
  if (error) { dbErr('updateStaffRole', error); return false; }
  return true;
}
export const dbUpdateStaffType = async function(clinicId, userId, newType) {
  const { error } = await db.from('clinic_staff').update({ staff_type: newType, updated_at: new Date().toISOString() }).eq('clinic_id', clinicId).eq('user_id', userId);
  if (error) { dbErr('updateStaffType', error); return false; }
  return true;
}
export const dbToggleStaffActive = async function(clinicId, userId, isActive) {
  const { error } = await db.from('clinic_staff').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('clinic_id', clinicId).eq('user_id', userId);
  if (error) { dbErr('toggleStaffActive', error); return false; }
  return true;
}
export const dbAdminResetPassword = async function(userId, newPassword) {
  const { error } = await db.rpc('admin_reset_password', { p_user_id: userId, p_new_pass: newPassword });
  if (error) { dbErr('adminResetPassword', error); return false; }
  return true;
}
export const dbChangePassword = async function(userId, oldPassword, newPassword) {
  const { data, error } = await db.rpc('change_password', { p_user_id: userId, p_old_pass: oldPassword, p_new_pass: newPassword });
  if (error) { dbErr('changePassword', error); return false; }
  return data === true;
}
export const dbGenerateResetToken = async function(email) {
  const { data, error } = await db.rpc('generate_reset_token', { p_email: email.toLowerCase().trim() });
  if (error) { dbErr('generateResetToken', error); return null; }
  return (data && data.length > 0) ? data[0] : null; // { token, user_name }
}
export const dbConsumeResetToken = async function(email, token, newPassword) {
  const { data, error } = await db.rpc('consume_reset_token', {
    p_email: email.toLowerCase().trim(), p_token: token.trim(), p_new_pass: newPassword
  });
  if (error) { dbErr('consumeResetToken', error); return 'error'; }
  return data; // 'ok' | 'invalid' | 'expired' | 'used'
}

export const dbCreateUserWithPassword = async function(name, email, password, role) {
  const { data, error } = await db.rpc('create_staff_user', {
    p_name: name, p_email: email.toLowerCase().trim(), p_password: password, p_role: role||'staff'
  });
  if (error) { dbErr('createUserWithPassword', error); return null; }
  return data;
}
export const dbAssignStaff = async function(clinicId, userId, role, assignedBy) {
  const { error } = await db.from('clinic_staff').upsert({
    clinic_id: clinicId, user_id: userId, role: role,
    is_active: true, assigned_by: assignedBy||null, updated_at: new Date().toISOString()
  }, { onConflict: 'clinic_id,user_id' });
  if (error) { dbErr('assignStaff', error); return false; }
  return true;
}
export const dbRemoveStaff = async function(clinicId, userId) {
  const { error } = await db.from('clinic_staff').delete().eq('clinic_id', clinicId).eq('user_id', userId);
  if (error) { dbErr('removeStaff', error); return false; }
  return true;
}
export const dbAudit = async function(action, tableName, recordId, oldData, newData) {
  try {
    await db.from('audit_log').insert({
      user_id:    typeof currentUser !== 'undefined' && currentUser ? currentUser.id : null,
      clinic_id:  typeof activeClinicId !== 'undefined' ? activeClinicId : null,
      action, table_name: tableName,
      record_id:  recordId ? String(recordId) : null,
      old_data:   oldData||null, new_data: newData||null
    });
  } catch(e) { console.warn('[Audit]', e); }
}

// ════════════════════════════════════════════════════════════
//  APPOINTMENTS
// ════════════════════════════════════════════════════════════

export const dbGetAppointments = async function(clinicId, date) {
  var query = db.from('appointments').select('*').eq('clinic_id', clinicId);
  if (date) query = query.eq('appt_date', date);
  var { data, error } = await query.order('appt_date', { ascending: true })
                                    .order('token_no',  { ascending: true });
  if (error) { dbErr('getAppointments', error); return []; }
  return data || [];
}

export const dbUpsertAppointment = async function(appt) {
  var { error } = await db.from('appointments').upsert(appt, { onConflict: 'id' });
  if (error) { dbErr('upsertAppointment', error); return false; }
  return true;
}

export const dbDeleteAppointment = async function(id) {
  var { error } = await db.from('appointments').delete().eq('id', id);
  if (error) { dbErr('deleteAppointment', error); return false; }
  return true;
}

export const dbGetNextToken = async function(clinicId, date) {
  var { data, error } = await db
    .from('appointments')
    .select('token_no')
    .eq('clinic_id', clinicId)
    .eq('appt_date', date)
    .order('token_no', { ascending: false })
    .limit(1);
  if (error || !data || !data.length) return 1;
  return (data[0].token_no || 0) + 1;
}

// ════════════════════════════════════════════════════════════
//  INVOICES
// ════════════════════════════════════════════════════════════

export const dbGetInvoices = async function(clinicId) {
  var { data, error } = await db
    .from('invoices')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false });
  if (error) { dbErr('getInvoices', error); return []; }
  return data || [];
}

export const dbUpsertInvoice = async function(inv) {
  var { error } = await db.from('invoices').upsert(inv, { onConflict: 'id' });
  if (error) { dbErr('upsertInvoice', error); return false; }
  return true;
}

export const dbGetNextInvoiceNo = async function(clinicId) {
  var { data, error } = await db
    .from('invoices')
    .select('invoice_no')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data || !data.length) return 'INV-1001';
  // Parse last number and increment
  var last = data[0].invoice_no || 'INV-1000';
  var match = last.match(/(\d+)$/);
  if (!match) return 'INV-1001';
  var next = parseInt(match[1], 10) + 1;
  return 'INV-' + next;
}

// ════════════════════════════════════════════════════════════
//  VITALS
// ════════════════════════════════════════════════════════════

export const dbGetVitals = async function(clinicId, patientName) {
  var query = db.from('vitals').select('*').eq('clinic_id', clinicId);
  if (patientName) query = query.ilike('patient_name', patientName);
  var { data, error } = await query.order('recorded_at', { ascending: false });
  if (error) { dbErr('getVitals', error); return []; }
  return data || [];
}

export const dbInsertVitals = async function(record) {
  var { error } = await db.from('vitals').insert(record);
  if (error) { dbErr('insertVitals', error); return false; }
  return true;
}


