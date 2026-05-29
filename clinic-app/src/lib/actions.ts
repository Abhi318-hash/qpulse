/**
 * actions.ts — Firestore Client Library (All Phases)
 * 
 * All Firestore operations live here. This is the single source of truth
 * for data access patterns across the entire Q-PULSE application.
 * 
 * PHASE 1: Security hardening — runTransaction for atomic token assignment
 * PHASE 2: Notification fields on appointments
 * PHASE 3: Patient profile + medical record creation
 */

import {
  collection, doc, query, where, orderBy,
  onSnapshot, addDoc, updateDoc, increment,
  serverTimestamp, getDoc, getDocs, setDoc,
  runTransaction, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

// ─────────────────────────────────────────────────────────────────────────────
// COLLECTION NAMES — single source of truth
// ─────────────────────────────────────────────────────────────────────────────
const CLINICS_COL        = 'clinics';
const APPOINTMENTS_COL   = 'appointments';
const AUDIT_COL          = 'system_audits';
const PATIENTS_COL       = 'patients';
const NOTIF_QUEUE_COL    = 'notifications_queue';

// ─────────────────────────────────────────────────────────────────────────────
// REAL-TIME SUBSCRIPTIONS (Clinics)
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeToActiveClinics(callback: (clinics: any[]) => void, onError?: (error: any) => void) {
  const q = query(
    collection(db, CLINICS_COL),
    where('is_hidden', '==', false)
  );
  return onSnapshot(q, (snapshot) => {
    let clinics = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    clinics = clinics.filter((c: any) => c.status !== 'SUSPENDED');
    // Sort in JS to avoid requiring composite index
    clinics.sort((a: any, b: any) => {
      const dateA = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
      const dateB = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
      return dateB - dateA;
    });
    callback(clinics);
  }, (error) => {
    console.error('Firebase Snapshot Error (Clinics):', error);
    if (onError) onError(error);
  });
}

export function subscribeToAllClinicsAdmin(callback: (clinics: any[]) => void) {
  const q = query(
    collection(db, CLINICS_COL),
    orderBy('created_at', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const clinics = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(clinics);
  });
}

export function subscribeToSingleClinic(id: string, callback: (clinic: any | null) => void) {
  const docRef = doc(db, CLINICS_COL, id);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGGING
// ─────────────────────────────────────────────────────────────────────────────

export async function logAdminAction(adminPhone: string, action: string, details: string) {
  if (!adminPhone) return;
  await addDoc(collection(db, AUDIT_COL), {
    admin_phone: adminPhone,
    action,
    details,
    created_at: serverTimestamp(),
  });
}

export function subscribeToAuditLogs(callback: (logs: any[]) => void) {
  const q = query(collection(db, AUDIT_COL), orderBy('created_at', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(logs);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN MUTATIONS (Clinic Management)
// ─────────────────────────────────────────────────────────────────────────────

export async function addClinic(
  name: string,
  doctorName: string,
  location: string,
  authorizedPhone: string,
  adminPhone: string
) {
  if (!name) throw new Error('Missing name');

  const cleanPhone = authorizedPhone ? authorizedPhone.replace(/[^0-9+]/g, '') : '';
  const finalPhone = cleanPhone && !cleanPhone.startsWith('+') ? `+91${cleanPhone}` : cleanPhone;

  const docRef = await addDoc(collection(db, CLINICS_COL), {
    name,
    doctor_name: doctorName || 'TBD',
    location: location || 'General',
    authorized_phone: finalPhone || '',
    org_id: '',                        // Phase 4: will be set during multi-tenancy migration
    is_open: true,
    is_hidden: false,
    patient_count: 0,
    last_issued_token: 0,
    currently_serving_token: '--',
    // Default notification config — Phase 2 will make these configurable
    notification_config: {
      sms_enabled: false,
      fcm_enabled: false,
      whatsapp_enabled: false,
      notify_at_positions_before: 2,
      notify_message_template: 'Your token #{token} is coming up at {clinic}!',
    },
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  await logAdminAction(adminPhone, 'CREATE_CLINIC', `Created clinic: ${name} (ID: ${docRef.id})`);
  return docRef.id;
}

export async function hideClinic(id: string, adminPhone: string) {
  await updateDoc(doc(db, CLINICS_COL, id), { is_hidden: true, updated_at: serverTimestamp() });
  await logAdminAction(adminPhone, 'HIDE_CLINIC', `Hid clinic ID: ${id}`);
}

export async function unhideClinic(id: string, adminPhone: string) {
  await updateDoc(doc(db, CLINICS_COL, id), { is_hidden: false, updated_at: serverTimestamp() });
  await logAdminAction(adminPhone, 'UNHIDE_CLINIC', `Unhid clinic ID: ${id}`);
}

export async function updateDoctorName(id: string, doctorName: string, adminPhone: string) {
  await updateDoc(doc(db, CLINICS_COL, id), { doctor_name: doctorName.trim(), updated_at: serverTimestamp() });
  await logAdminAction(adminPhone, 'UPDATE_DOCTOR', `Updated Doctor Name for clinic ID: ${id} to ${doctorName}`);
}

export async function updateDoctorProfileImage(clinicId: string, imageUrl: string, staffPhone: string) {
  await updateDoc(doc(db, CLINICS_COL, clinicId), { doctor_image_url: imageUrl, updated_at: serverTimestamp() });
  await logAdminAction(staffPhone, 'UPDATE_DOCTOR_IMAGE', `Updated doctor profile image for clinic ID: ${clinicId}`);
}

export async function updateClinicProfile(id: string, profileData: any, adminPhone: string) {
  await updateDoc(doc(db, CLINICS_COL, id), {
    doctor_name:     (profileData.doctor_name || '').trim(),
    dr_degree:       (profileData.dr_degree || '').trim(),
    specialization:  (profileData.specialization || '').trim(),
    phone_number:    (profileData.phone_number || '').trim(),
    operating_hours: (profileData.operating_hours || '').trim(),
    booking_end_time: (profileData.booking_end_time || '').trim(),
    fees:            (profileData.fees || '').toString().trim(),
    updated_at:      serverTimestamp(),
  });
  await logAdminAction(adminPhone, 'UPDATE_CLINIC_PROFILE', `Updated full profile for clinic ID: ${id}`);
}

export async function updateAuthorizedPhone(id: string, phone: string, adminPhone: string) {
  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';
  const finalPhone = cleanPhone && !cleanPhone.startsWith('+') ? `+91${cleanPhone}` : cleanPhone;
  await updateDoc(doc(db, CLINICS_COL, id), { authorized_phone: finalPhone, updated_at: serverTimestamp() });
  await logAdminAction(adminPhone, 'UPDATE_AUTH_PHONE', `Changed authorized phone for clinic ID: ${id}`);
}

export async function toggleClinicStatus(id: string, currentStatus: boolean) {
  await updateDoc(doc(db, CLINICS_COL, id), {
    is_open: !currentStatus,
    updated_at: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN SYSTEM — PHASE 1: Atomic token assignment via runTransaction
// This guarantees no two patients ever get the same token number,
// even under high concurrent load.
// ─────────────────────────────────────────────────────────────────────────────

export async function addPatientToken(
  clinicId: string,
  patientName: string,
  age: number,
  fees: number,
  disease: string,
  userPhone: string = '',
  bookingSource: 'online' | 'walkin' | 'staff' | 'whatsapp' = 'online',
  insurance?: { provider_name: string; policy_number?: string; card_image_url?: string; verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED' },
  consultation_type: 'IN_PERSON' | 'VIDEO' = 'IN_PERSON'
): Promise<string> {
  const clinicRef = doc(db, CLINICS_COL, clinicId);
  const now = new Date();

  return await runTransaction(db, async (transaction) => {
    // 1. Read clinic inside transaction — atomic snapshot
    const clinicSnap = await transaction.get(clinicRef);
    if (!clinicSnap.exists()) throw new Error('Clinic not found');

    const clinicData = clinicSnap.data();
    
    // Check booking end time
    if (clinicData.booking_end_time) {
      const [endHour, endMinute] = clinicData.booking_end_time.split(':').map(Number);
      const endDateTime = new Date(now);
      endDateTime.setHours(endHour, endMinute, 0, 0);
      if (now > endDateTime) {
        throw new Error('Booking is closed for today.');
      }
    }

    const todayStr = now.toISOString().split('T')[0];

    let nextToken = 1;
    if (clinicData.current_date_string === todayStr) {
      nextToken = (clinicData.last_issued_token || 0) + 1;
    }

    // 2. Prepare appointment document reference
    const newApptRef = doc(collection(db, APPOINTMENTS_COL));

    // 3. Write appointment atomically
    transaction.set(newApptRef, {
      clinic_id:       clinicId,
      org_id:          clinicData.org_id || '',   // Phase 4: org isolation
      patient_name:    patientName,
      age:             age,
      fees:            fees,
      disease:         disease || 'General',
      user_phone:      userPhone,
      token_number:    nextToken,
      status:          'WAITING',
      fees_paid:       false,
      payment_mode:    'cash',
      booking_source:  userPhone ? bookingSource : 'walkin',
      consultation_type,
      // Timing fields for analytics (Phase 5)
      queued_at:       serverTimestamp(),
      date_string:     todayStr,
      day_of_week:     now.getDay(),
      hour_of_day:     now.getHours(),
      // Notification state — Phase 2
      notifications_sent: {
        queued_confirmation: false,
        near_turn:           false,
        your_turn:           false,
        completed:           false,
      },
      // Insurance fields — Phase 5
      insurance: insurance || null,
      created_at: serverTimestamp(),
    });

    // 4. Update clinic counters atomically
    transaction.update(clinicRef, {
      last_issued_token: nextToken,
      patient_count:     increment(1),
      current_date_string: todayStr,
      updated_at:        serverTimestamp(),
    });

    return newApptRef.id;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeToClinicRoster(clinicId: string, callback: (appointments: any[]) => void) {
  const q = query(
    collection(db, APPOINTMENTS_COL),
    where('clinic_id', '==', clinicId),
    where('status', 'in', ['WAITING', 'IN_PROGRESS', 'LATE', 'SPILLOVER'])
  );
  return onSnapshot(q, (snapshot) => {
    const apps = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort by time queued (Spillovers from yesterday will naturally sort before today's tokens)
    apps.sort((a: any, b: any) => {
      const tA = a.queued_at?.toMillis ? a.queued_at.toMillis() : 0;
      const tB = b.queued_at?.toMillis ? b.queued_at.toMillis() : 0;
      return tA - tB;
    });
    callback(apps);
  });
}

export function subscribeToPatientsAheadCount(clinicId: string, queuedAtMillis: number, callback: (count: number) => void) {
  const q = query(
    collection(db, APPOINTMENTS_COL),
    where('clinic_id', '==', clinicId),
    where('status', 'in', ['WAITING', 'IN_PROGRESS', 'LATE', 'SPILLOVER'])
  );
  return onSnapshot(q, (snapshot) => {
    let count = 0;
    snapshot.docs.forEach(doc => {
      const qTime = doc.data().queued_at?.toMillis ? doc.data().queued_at.toMillis() : 0;
      if (qTime < queuedAtMillis) count++;
    });
    callback(count);
  });
}

export async function getClinicHistory(clinicId: string, limitCount: number = 200) {
  const q = query(
    collection(db, APPOINTMENTS_COL),
    where('clinic_id', '==', clinicId),
    where('status', 'in', ['COMPLETED', 'CANCELLED', 'NO_SHOW'])
  );
  const snapshot = await getDocs(q);
  let apps = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  apps.sort((a: any, b: any) => {
    const tA = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
    const tB = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
    return tB - tA;
  });
  return apps.slice(0, limitCount);
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE ADVANCEMENT — marks current as COMPLETED, promotes next
// ─────────────────────────────────────────────────────────────────────────────

export async function advanceTokenQueue(
  clinicId: string,
  completedAppointmentId: string,
  finalFee: number = 0,
  prescriptionUrl?: string
) {
  const appRef = doc(db, APPOINTMENTS_COL, completedAppointmentId);
  const snap = await getDoc(appRef);
  if (!snap.exists()) return;

  const currentSavedFee = snap.data().fees || 0;
  const completedAt = new Date();

  // Calculate wait time if queued_at exists
  const queuedAt = snap.data().queued_at?.toDate?.();
  const waitMins = queuedAt
    ? Math.round((completedAt.getTime() - queuedAt.getTime()) / 60000)
    : null;

  // 1. Mark current appointment as COMPLETED
  const updateData: any = {
    status:             'COMPLETED',
    fees:               finalFee > 0 ? finalFee : currentSavedFee,
    fees_paid:          true,
    completed_at:       serverTimestamp(),
    wait_time_minutes:  waitMins,
    'notifications_sent.completed': true,
  };

  if (prescriptionUrl) {
    updateData.prescription_url = prescriptionUrl;
    updateData.prescription_uploaded = true;
  }

  await updateDoc(appRef, updateData);

  // 2. Find next patient in queue
  const q = query(
    collection(db, APPOINTMENTS_COL),
    where('clinic_id', '==', clinicId),
    where('status', 'in', ['WAITING', 'IN_PROGRESS'])
  );
  const queueSnap = await getDocs(q);
  const apps = queueSnap.docs.map(d => d.data());
  apps.sort((a: any, b: any) => {
    const tA = a.queued_at?.toMillis ? a.queued_at.toMillis() : 0;
    const tB = b.queued_at?.toMillis ? b.queued_at.toMillis() : 0;
    return tA - tB;
  });

  const nextTokenDisplay = apps.length === 0
    ? 'Empty'
    : apps[0].token_number;

  // 3. Update clinic's serving token and patient count
  const clinicRef = doc(db, CLINICS_COL, clinicId);
  await updateDoc(clinicRef, {
    patient_count:             increment(-1),
    currently_serving_token:   nextTokenDisplay,
    updated_at:                serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LIFECYCLE EDGES: LATE, NO SHOW, SPILLOVER
// ─────────────────────────────────────────────────────────────────────────────

export async function markTokenAsLate(clinicId: string, appointmentId: string) {
  const appRef = doc(db, APPOINTMENTS_COL, appointmentId);
  await updateDoc(appRef, {
    status: 'LATE',
    marked_late_at: serverTimestamp(),
  });
  
  // Update currently serving token to next available
  const q = query(
    collection(db, APPOINTMENTS_COL),
    where('clinic_id', '==', clinicId),
    where('status', 'in', ['WAITING', 'IN_PROGRESS'])
  );
  const queueSnap = await getDocs(q);
  const apps = queueSnap.docs.map(d => d.data());
  apps.sort((a: any, b: any) => {
    const tA = a.queued_at?.toMillis ? a.queued_at.toMillis() : 0;
    const tB = b.queued_at?.toMillis ? b.queued_at.toMillis() : 0;
    return tA - tB;
  });
  const nextTokenDisplay = apps.length === 0 ? 'Empty' : apps[0].token_number;
  
  await updateDoc(doc(db, CLINICS_COL, clinicId), {
    currently_serving_token: nextTokenDisplay,
    updated_at: serverTimestamp(),
  });
}

export async function markAsNoShow(clinicId: string, appointmentId: string) {
  const appRef = doc(db, APPOINTMENTS_COL, appointmentId);
  await updateDoc(appRef, {
    status: 'NO_SHOW',
    completed_at: serverTimestamp(),
  });
  
  await updateDoc(doc(db, CLINICS_COL, clinicId), {
    patient_count: increment(-1),
    updated_at: serverTimestamp(),
  });
}

export async function restoreLatePatient(clinicId: string, appointmentId: string) {
  const appRef = doc(db, APPOINTMENTS_COL, appointmentId);
  await updateDoc(appRef, {
    status: 'WAITING',
    marked_late_at: null,
  });
  
  // Re-evaluate serving token
  const q = query(
    collection(db, APPOINTMENTS_COL),
    where('clinic_id', '==', clinicId),
    where('status', 'in', ['WAITING', 'IN_PROGRESS'])
  );
  const queueSnap = await getDocs(q);
  const apps = queueSnap.docs.map(d => d.data());
  apps.sort((a: any, b: any) => {
    const tA = a.queued_at?.toMillis ? a.queued_at.toMillis() : 0;
    const tB = b.queued_at?.toMillis ? b.queued_at.toMillis() : 0;
    return tA - tB;
  });
  const nextTokenDisplay = apps.length === 0 ? 'Empty' : apps[0].token_number;
  
  await updateDoc(doc(db, CLINICS_COL, clinicId), {
    currently_serving_token: nextTokenDisplay,
    updated_at: serverTimestamp(),
  });
}

export async function moveRemainingQueueToTomorrow(clinicId: string) {
  const q = query(
    collection(db, APPOINTMENTS_COL),
    where('clinic_id', '==', clinicId),
    where('status', 'in', ['WAITING', 'LATE'])
  );
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return 0;

  const batch = writeBatch(db);
  let count = 0;
  
  snapshot.docs.forEach((d) => {
    batch.update(d.ref, {
      status: 'SPILLOVER',
      moved_at: serverTimestamp()
    });
    count++;
  });
  
  const clinicRef = doc(db, CLINICS_COL, clinicId);
  batch.update(clinicRef, {
    patient_count: increment(-count),
    currently_serving_token: '--',
    updated_at: serverTimestamp(),
  });
  
  await batch.commit();
  return count;
}

export async function assignSpilloverTokens(clinicId: string) {
  const q = query(
    collection(db, APPOINTMENTS_COL),
    where('clinic_id', '==', clinicId),
    where('status', '==', 'MOVED_TO_NEXT_DAY')
  );
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return 0;
  
  const batch = writeBatch(db);
  let count = 0;
  
  snapshot.docs.forEach((appDoc) => {
    // Revert status to WAITING, clear marked_late_at so they re-enter active queue
    // Their old token_number and queued_at timestamp are preserved!
    batch.update(appDoc.ref, { 
      status: 'WAITING',
      marked_late_at: null
    });
    count++;
  });
  
  const clinicRef = doc(db, CLINICS_COL, clinicId);
  batch.update(clinicRef, {
    patient_count: increment(count),
    updated_at: serverTimestamp()
  });
  
  await batch.commit();
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT / PUBLIC FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeToUserActiveTokens(userPhone: string, callback: (tokens: any[]) => void) {
  const q = query(
    collection(db, APPOINTMENTS_COL),
    where('user_phone', '==', userPhone),
    where('status', 'in', ['WAITING', 'IN_PROGRESS'])
  );
  return onSnapshot(q, (snapshot) => {
    const tokens = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(tokens);
  });
}

export async function cancelUserToken(clinicId: string, appointmentId: string) {
  const appRef = doc(db, APPOINTMENTS_COL, appointmentId);
  await updateDoc(appRef, { status: 'CANCELLED' });

  const clinicRef = doc(db, CLINICS_COL, clinicId);
  await updateDoc(clinicRef, {
    patient_count: increment(-1),
    updated_at:    serverTimestamp(),
  });
}

export async function getUserMedicalHistory(userPhone: string, limitCount: number = 50) {
  const q = query(
    collection(db, APPOINTMENTS_COL),
    where('user_phone', '==', userPhone),
    where('status', '==', 'COMPLETED')
  );
  const snapshot = await getDocs(q);
  let apps = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  apps.sort((a: any, b: any) => {
    const dateA = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
    const dateB = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
    return dateB - dateA;
  });
  return apps.slice(0, limitCount);
}

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT PROFILE — Phase 3
// Auto-creates patient doc on first login; idempotent.
// ─────────────────────────────────────────────────────────────────────────────

export async function ensurePatientProfile(uid: string, phone: string, name: string = '') {
  if (!uid || !phone) return;
  const q = query(
    collection(db, PATIENTS_COL),
    where('phone', '==', phone)
  );
  const snap = await getDocs(q);
  const q2 = query(
    collection(db, PATIENTS_COL),
    where('recovery_phone', '==', phone)
  );
  const snap2 = await getDocs(q2);

  if (!snap.empty || !snap2.empty) {
    return; // Profile already exists (either primary or recovery matched)
  }

  // Create new profile mapped to their current auth uid
  const patientRef = doc(db, PATIENTS_COL, uid);
  await setDoc(patientRef, {
    id:         uid,
    phone:      phone,
    recovery_phone: null,
    full_name:  name,
    medical_background: {
      chronic_conditions: [],
      allergies:          [],
      current_medications: [],
      surgeries:          [],
      family_history:     [],
    },
    stats: {
      total_visits:          0,
      total_spent:           0,
      clinics_visited:       [],
      last_visited_clinic_id: '',
    },
    data_consent:     false,
    created_at:       serverTimestamp(),
    updated_at:       serverTimestamp(),
  });
}

export async function getPatientProfile(uid: string, phone?: string) {
  if (!uid) return null;
  
  if (phone) {
    const q1 = query(collection(db, PATIENTS_COL), where('phone', '==', phone));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) return { id: snap1.docs[0].id, ...snap1.docs[0].data() };

    const q2 = query(collection(db, PATIENTS_COL), where('recovery_phone', '==', phone));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return { id: snap2.docs[0].id, ...snap2.docs[0].data() };
  }
  
  const snap = await getDoc(doc(db, PATIENTS_COL, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updatePatientProfile(uid: string, data: Partial<any>, phone?: string) {
  if (!uid) return;
  
  let targetId = uid;
  if (phone) {
    const p = await getPatientProfile(uid, phone);
    if (p) targetId = p.id;
  }
  
  await updateDoc(doc(db, PATIENTS_COL, targetId), {
    ...data,
    updated_at: serverTimestamp(),
  });
}

export async function saveFcmToken(phone: string, token: string) {
  if (!phone || !token) return;
  await setDoc(doc(db, 'fcm_tokens', phone), {
    token,
    updated_at: serverTimestamp(),
  });
}

export async function updateInsuranceStatus(appointmentId: string, status: 'VERIFIED' | 'REJECTED') {
  await updateDoc(doc(db, APPOINTMENTS_COL, appointmentId), {
    'insurance.verification_status': status,
  });
}
