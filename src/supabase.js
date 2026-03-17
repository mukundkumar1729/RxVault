// ═══════════════════════════════════════════════════════════
//  SUPABASE DATABASE LAYER — replaces localStorage
//  All app data goes through these functions.
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://wavakcolrtrwmjcjkdfc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_T0hi4JUMec0BU0si3U8UCQ_gShxYVYm';

// ─── Init Supabase client via CDN ────────────────────────
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Generic error handler ───────────────────────────────
function dbErr(label, error) {
  console.error(`[DB] ${label}:`, error?.message || error);
}

// ─── Global loading overlay ───────────────────────────────
// Defined here (supabase.js) so it loads first and is
// available to clinic.js, script.js and ai.js.
function showLoading(msg) {
  msg = msg || 'Loading…';
  let el = document.getElementById('dbLoadingOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dbLoadingOverlay';
    el.style.cssText = [
      'position:fixed', 'inset:0',
      'background:rgba(15,30,48,0.6)',
      'backdrop-filter:blur(3px)',
      'z-index:99999',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'flex-direction:column',
      'gap:14px',
      'color:#fff',
      'font-family:DM Sans,sans-serif'
    ].join(';');
    el.innerHTML =
      '<div style="width:38px;height:38px;border:3px solid rgba(255,255,255,0.2);' +
      'border-top-color:#fff;border-radius:50%;animation:rxSpinAnim 0.7s linear infinite"></div>' +
      '<div id="dbLoadingMsg" style="font-size:14px;font-weight:500;opacity:0.85">' + msg + '</div>';
    const style = document.createElement('style');
    style.textContent = '@keyframes rxSpinAnim{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
    document.body.appendChild(el);
  } else {
    const msgEl = document.getElementById('dbLoadingMsg');
    if (msgEl) msgEl.textContent = msg;
    el.style.display = 'flex';
  }
}

function hideLoading() {
  const el = document.getElementById('dbLoadingOverlay');
  if (el) el.style.display = 'none';
}

// ════════════════════════════════════════════════════════════
//  CLINICS
// ════════════════════════════════════════════════════════════
async function dbGetClinics() {
  const { data, error } = await db
    .from('clinics')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) { dbErr('getClinics', error); return []; }
  return (data || []).map(dbToClinic);
}

async function dbInsertClinic(clinic) {
  const payload = clinicToDb(clinic);
  console.log('[DB] insertClinic payload:', payload);
  const { data, error } = await db
    .from('clinics')
    .insert(payload)
    .select()
    .single();
  if (error) {
    dbErr('insertClinic', error);
    console.error('[DB] insertClinic full error:', JSON.stringify(error));
    return null;
  }
  console.log('[DB] insertClinic success:', data);
  return dbToClinic(data);
}

async function dbUpdateClinic(id, fields) {
  // Only send columns that are editable — never send id or created_at
  const row = {
    name:       fields.name       || '',
    address:    fields.address    || '',
    phone:      fields.phone      || '',
    email:      fields.email      || '',
    type:       fields.type       || 'multispecialty',
    logo:       fields.logo       || '🏥',
    pin:        fields.pin        || 'admin1234',
    plan:       fields.plan       || 'free',
    gemini_key: fields.geminiKey  || fields.gemini_key || ''
  };
  const { error } = await db
    .from('clinics')
    .update(row)
    .eq('id', id);
  if (error) { dbErr('updateClinic', error); return false; }
  return true;
}

async function dbDeleteClinic(id) {
  // CASCADE deletes doctors, patients, prescriptions automatically
  const { error } = await db.from('clinics').delete().eq('id', id);
  if (error) { dbErr('deleteClinic', error); return false; }
  return true;
}

// ─── Mappers ─────────────────────────────────────────────
function clinicToDb(c) {
  return {
    id:         c.id,
    name:       c.name        || '',
    address:    c.address     || '',
    phone:      c.phone       || '',
    email:      c.email       || '',
    type:       c.type        || 'multispecialty',
    logo:       c.logo        || '🏥',
    pin:        c.pin         || 'admin1234',
    plan:       c.plan        || 'free',
    gemini_key: c.geminiKey   || ''
    // created_at omitted — set by Supabase DEFAULT NOW()
  };
}
function dbToClinic(r) {
  return {
    id:        r.id,
    name:      r.name,
    address:   r.address    || '',
    phone:     r.phone      || '',
    email:     r.email      || '',
    type:      r.type       || 'multispecialty',
    logo:      r.logo       || '🏥',
    pin:       r.pin        || 'admin1234',
    plan:      r.plan       || 'free',
    geminiKey: r.gemini_key || '',
    createdAt: r.created_at
  };
}

// ════════════════════════════════════════════════════════════
//  PRESCRIPTIONS
// ════════════════════════════════════════════════════════════
async function dbGetPrescriptions(clinicId) {
  const { data, error } = await db
    .from('prescriptions')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('date', { ascending: false });
  if (error) { dbErr('getPrescriptions', error); return []; }
  return (data || []).map(dbToRx);
}

async function dbUpsertPrescription(rx) {
  const row = rxToDb(rx);
  const { error } = await db
    .from('prescriptions')
    .upsert(row, { onConflict: 'id' });
  if (error) { dbErr('upsertPrescription', error); return false; }
  return true;
}

async function dbDeletePrescription(id) {
  const { error } = await db.from('prescriptions').delete().eq('id', id);
  if (error) { dbErr('deletePrescription', error); return false; }
  return true;
}

// ─── Mappers ─────────────────────────────────────────────
function rxToDb(p) {
  return {
    id:              p.id,
    clinic_id:       p.clinicId,
    type:            p.type            || 'allopathy',
    patient_name:    p.patientName     || '',
    age:             p.age             || '',
    gender:          p.gender          || '',
    blood_group:     p.bloodGroup      || '',
    phone:           p.phone           || '',
    email:           p.email           || '',
    doctor_name:     p.doctorName      || '',
    specialization:  p.specialization  || '',
    hospital:        p.hospital        || '',
    reg_no:          p.regNo           || '',
    doctor_phone:    p.doctorPhone     || '',
    date:            p.date            || '',
    valid_until:     p.validUntil      || '',
    diagnosis:       p.diagnosis       || '',
    status:          p.status          || 'active',
    medicines:       p.medicines       || [],
    diagnostics:     p.diagnostics     || [],
    notes:           p.notes           || '',
    note_categories: p.noteCategories  || [],
    revisions:       p.revisions       || [],
    created_at:      p.createdAt       || new Date().toISOString(),
    updated_at:      p.updatedAt       || new Date().toISOString()
  };
}
function dbToRx(r) {
  return {
    id:             r.id,
    clinicId:       r.clinic_id,
    type:           r.type,
    patientName:    r.patient_name,
    age:            r.age            || '',
    gender:         r.gender         || '',
    bloodGroup:     r.blood_group    || '',
    phone:          r.phone          || '',
    email:          r.email          || '',
    doctorName:     r.doctor_name,
    specialization: r.specialization || '',
    hospital:       r.hospital       || '',
    regNo:          r.reg_no         || '',
    doctorPhone:    r.doctor_phone   || '',
    date:           r.date,
    validUntil:     r.valid_until    || '',
    diagnosis:      r.diagnosis      || '',
    status:         r.status         || 'active',
    medicines:      r.medicines      || [],
    diagnostics:    r.diagnostics    || [],
    notes:          r.notes          || '',
    noteCategories: r.note_categories || [],
    revisions:      r.revisions      || [],
    createdAt:      r.created_at,
    updatedAt:      r.updated_at
  };
}

// ════════════════════════════════════════════════════════════
//  DOCTORS
// ════════════════════════════════════════════════════════════
async function dbGetDoctors(clinicId) {
  const { data, error } = await db
    .from('doctors')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: true });
  if (error) { dbErr('getDoctors', error); return []; }
  return (data || []).map(dbToDoctor);
}

async function dbUpsertDoctor(doctor, clinicId) {
  const row = doctorToDb(doctor, clinicId);
  const { error } = await db
    .from('doctors')
    .upsert(row, { onConflict: 'id' });
  if (error) { dbErr('upsertDoctor', error); return false; }
  return true;
}

async function dbDeleteDoctor(id) {
  const { error } = await db.from('doctors').delete().eq('id', id);
  if (error) { dbErr('deleteDoctor', error); return false; }
  return true;
}

// ─── Mappers ─────────────────────────────────────────────
function doctorToDb(d, clinicId) {
  return {
    id:             d.id || ('dr_' + Date.now() + '_' + Math.random().toString(36).slice(2,6)),
    clinic_id:      clinicId || d.clinicId,
    reg_no:         d.regNo          || '',
    name:           d.name           || '',
    qualification:  d.qualification  || '',
    specialization: d.specialization || '',
    hospital:       d.hospital       || '',
    phone:          d.phone          || '',
    email:          d.email          || '',
    address:        d.address        || '',
    type:           d.type           || 'allopathy',
    availability:   d.availability   || [],
    unavailable:    d.unavailable    || false
  };
}
function dbToDoctor(r) {
  return {
    id:             r.id,
    clinicId:       r.clinic_id,
    regNo:          r.reg_no         || '',
    name:           r.name,
    qualification:  r.qualification  || '',
    specialization: r.specialization || '',
    hospital:       r.hospital       || '',
    phone:          r.phone          || '',
    email:          r.email          || '',
    address:        r.address        || '',
    type:           r.type           || 'allopathy',
    availability:   r.availability   || [],
    unavailable:    r.unavailable    || false
  };
}

// ════════════════════════════════════════════════════════════
//  PATIENTS
// ════════════════════════════════════════════════════════════
async function dbGetPatients(clinicId) {
  const { data, error } = await db
    .from('patients')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('registered_at', { ascending: false });
  if (error) { dbErr('getPatients', error); return []; }
  return (data || []).map(dbToPatient);
}

async function dbInsertPatient(patient) {
  const row = patientToDb(patient);
  const { error } = await db.from('patients').insert(row);
  if (error) { dbErr('insertPatient', error); return false; }
  return true;
}

// ─── Mappers ─────────────────────────────────────────────
function patientToDb(p) {
  return {
    id:                p.id,
    clinic_id:         p.clinicId,
    name:              p.name              || '',
    age:               p.age               || '',
    gender:            p.gender            || '',
    blood_group:       p.bloodGroup        || '',
    phone:             p.phone             || '',
    email:             p.email             || '',
    address:           p.address           || '',
    consultant_doctor: p.consultantDoctor  || '',
    consultant_fee:    p.consultantFee     || 0,
    payment_method:    p.paymentMethod     || 'Cash',
    registration_date: p.registrationDate  || '',
    registered_at:     p.registeredAt      || new Date().toISOString()
  };
}
function dbToPatient(r) {
  return {
    id:               r.id,
    clinicId:         r.clinic_id,
    name:             r.name,
    age:              r.age              || '',
    gender:           r.gender           || '',
    bloodGroup:       r.blood_group      || '',
    phone:            r.phone            || '',
    email:            r.email            || '',
    address:          r.address          || '',
    consultantDoctor: r.consultant_doctor || '',
    consultantFee:    r.consultant_fee   || 0,
    paymentMethod:    r.payment_method   || 'Cash',
    registrationDate: r.registration_date || '',
    registeredAt:     r.registered_at
  };
}

// ════════════════════════════════════════════════════════════
//  AI SEARCH — supabase RPC calls
// ════════════════════════════════════════════════════════════

// ─── Free: pg_trgm fuzzy search ──────────────────────────
async function dbSearchFuzzy(query, clinicId, limit = 10) {
  const { data, error } = await db.rpc('search_similar_fuzzy', {
    search_query:  query,
    p_clinic_id:   clinicId,
    result_limit:  limit,
    min_threshold: 0.1
  });
  if (error) { dbErr('searchFuzzy', error); return []; }
  return data || [];
}

// ─── Premium: pgvector semantic search ───────────────────
async function dbSearchSemantic(embedding, clinicId, limit = 10) {
  const { data, error } = await db.rpc('search_similar_semantic', {
    query_embedding: embedding,
    p_clinic_id:     clinicId,
    result_limit:    limit,
    min_threshold:   0.5
  });
  if (error) { dbErr('searchSemantic', error); return []; }
  return data || [];
}

// ─── Store embedding for a prescription (premium) ────────
async function dbStoreEmbedding(prescriptionId, embedding) {
  const { error } = await db
    .from('prescriptions')
    .update({ embedding: JSON.stringify(embedding) })
    .eq('id', prescriptionId);
  if (error) { dbErr('storeEmbedding', error); return false; }
  return true;
}

// ─── Update clinic plan + gemini key ─────────────────────
async function dbUpdateClinicPlan(clinicId, plan, geminiKey) {
  const { error } = await db
    .from('clinics')
    .update({ plan, gemini_key: geminiKey })
    .eq('id', clinicId);
  if (error) { dbErr('updateClinicPlan', error); return false; }
  return true;
}