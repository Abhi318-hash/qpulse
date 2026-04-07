// Firestore Client implementation
import { collection, doc, query, where, orderBy, onSnapshot, addDoc, updateDoc, increment, serverTimestamp, getDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';

const CLINICS_COLLECTION = 'clinics';
const APPOINTMENTS_COLLECTION = 'appointments';

// Subscription hooks for Real-time Updates (Replacing polling)
export function subscribeToActiveClinics(callback: (clinics: any[]) => void) {
  const q = query(
    collection(db, CLINICS_COLLECTION), 
    where('is_hidden', '==', false)
  );
  
  return onSnapshot(q, (snapshot) => {
    let clinics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort manually in JS to avoid Firebase Composite Index requirement
    clinics.sort((a: any, b: any) => {
       const dateA = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
       const dateB = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
       return dateB - dateA;
    });
    callback(clinics);
  }, (error) => {
    console.error("Firebase Snapshot Error (Clinics):", error);
  });
}

export function subscribeToAllClinicsAdmin(callback: (clinics: any[]) => void) {
  const q = query(
    collection(db, CLINICS_COLLECTION),
    orderBy('created_at', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const clinics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(clinics);
  });
}

export function subscribeToSingleClinic(id: string, callback: (clinic: any | null) => void) {
  const docRef = doc(db, CLINICS_COLLECTION, id);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  });
}


// --- Admin & Audit Logging ---
const AUDIT_COLLECTION = 'system_audits';

export async function logAdminAction(adminPhone: string, action: string, details: string) {
  if (!adminPhone) return;
  await addDoc(collection(db, AUDIT_COLLECTION), {
    admin_phone: adminPhone,
    action: action,
    details: details,
    created_at: serverTimestamp(),
  });
}

export function subscribeToAuditLogs(callback: (logs: any[]) => void) {
  const q = query(collection(db, AUDIT_COLLECTION), orderBy('created_at', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(logs);
  });
}

// --- Admin Mutations ---

export async function addClinic(name: string, doctorName: string, location: string, authorizedPhone: string, adminPhone: string) {
  if (!name) throw new Error("Missing name");
  
  // Clean phone number before saving to ensure robust matching
  const cleanPhone = authorizedPhone ? authorizedPhone.replace(/[^0-9+]/g, '') : '';
  const finalPhone = cleanPhone && !cleanPhone.startsWith('+') ? `+91${cleanPhone}` : cleanPhone;

  const docRef = await addDoc(collection(db, CLINICS_COLLECTION), {
    name,
    doctor_name: doctorName || 'TBD',
    location: location || 'General',
    authorized_phone: finalPhone || '',
    is_open: true,
    is_hidden: false,
    patient_count: 0,
    created_at: serverTimestamp(),
  });
  
  await logAdminAction(adminPhone, 'CREATE_CLINIC', `Created clinic: ${name} (ID: ${docRef.id})`);
  return docRef.id;
}

export async function hideClinic(id: string, adminPhone: string) {
  const docRef = doc(db, CLINICS_COLLECTION, id);
  await updateDoc(docRef, { is_hidden: true });
  await logAdminAction(adminPhone, 'HIDE_CLINIC', `Hid clinic ID: ${id}`);
}

export async function unhideClinic(id: string, adminPhone: string) {
  const docRef = doc(db, CLINICS_COLLECTION, id);
  await updateDoc(docRef, { is_hidden: false });
  await logAdminAction(adminPhone, 'UNHIDE_CLINIC', `Unhid clinic ID: ${id}`);
}

export async function updateDoctorName(id: string, doctorName: string, adminPhone: string) {
  const docRef = doc(db, CLINICS_COLLECTION, id);
  await updateDoc(docRef, { doctor_name: doctorName.trim() });
  await logAdminAction(adminPhone, 'UPDATE_DOCTOR', `Updated Doctor Name for clinic ID: ${id} to ${doctorName}`);
}

export async function updateAuthorizedPhone(id: string, phone: string, adminPhone: string) {
  const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';
  const finalPhone = cleanPhone && !cleanPhone.startsWith('+') ? `+91${cleanPhone}` : cleanPhone;
  const docRef = doc(db, CLINICS_COLLECTION, id);
  await updateDoc(docRef, { authorized_phone: finalPhone });
  await logAdminAction(adminPhone, 'UPDATE_AUTH_PHONE', `Changed authorized phone for clinic ID: ${id}`);
}

// --- Phase 2: Appointments & Token System ---

export async function addPatientToken(clinicId: string, patientName: string, age: number, fees: number, disease: string, userPhone: string = '') {
  // 1. Get the current clinic to determine the next token number
  const clinicRef = doc(db, CLINICS_COLLECTION, clinicId);
  const clinicSnap = await getDoc(clinicRef);
  if (!clinicSnap.exists()) throw new Error("Clinic not found");

  const clinicData = clinicSnap.data();
  const nextToken = (clinicData.last_issued_token || 0) + 1;

  // 2. Create the appointment document
  const appointmentDoc = await addDoc(collection(db, APPOINTMENTS_COLLECTION), {
    clinic_id: clinicId,
    patient_name: patientName,
    age: age,
    fees: fees,
    disease: disease,
    user_phone: userPhone, // Empty string if walk-in, otherwise their phone
    token_number: nextToken,
    status: 'WAITING', // 'WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
    created_at: serverTimestamp()
  });

  // 3. Update the clinic's total count and last issued token
  await updateDoc(clinicRef, {
    last_issued_token: nextToken,
    patient_count: increment(1) // Keep the global counter synced!
  });

  return appointmentDoc.id;
}

export function subscribeToClinicRoster(clinicId: string, callback: (appointments: any[]) => void) {
  const q = query(
    collection(db, APPOINTMENTS_COLLECTION),
    where('clinic_id', '==', clinicId),
    where('status', 'in', ['WAITING', 'IN_PROGRESS']),
    orderBy('token_number', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(apps);
  });
}

export async function getClinicHistory(clinicId: string, limitCount: number = 200) {
  // Fetch only COMPLETED or CANCELLED items, ordered by creation date descending
  const q = query(
    collection(db, APPOINTMENTS_COLLECTION),
    where('clinic_id', '==', clinicId),
    where('status', '==', 'COMPLETED')
  );
  
  const snapshot = await getDocs(q);
  let apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Sort descending by token/date so newest are first
  apps.sort((a: any, b: any) => b.token_number - a.token_number);
  
  return apps.slice(0, limitCount);
}

// --- Public User Functions ---
export function subscribeToUserActiveTokens(userPhone: string, callback: (tokens: any[]) => void) {
  const q = query(
    collection(db, APPOINTMENTS_COLLECTION),
    where('user_phone', '==', userPhone),
    where('status', 'in', ['WAITING', 'IN_PROGRESS'])
  );
  
  return onSnapshot(q, (snapshot) => {
    const tokens = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(tokens);
  });
}

export async function cancelUserToken(clinicId: string, appointmentId: string) {
  const appRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
  await updateDoc(appRef, { status: 'CANCELLED' });

  const clinicRef = doc(db, CLINICS_COLLECTION, clinicId);
  await updateDoc(clinicRef, {
    patient_count: increment(-1)
  });
}

export async function getUserMedicalHistory(userPhone: string, limitCount: number = 50) {
  const q = query(
    collection(db, APPOINTMENTS_COLLECTION),
    where('user_phone', '==', userPhone),
    where('status', '==', 'COMPLETED')
  );
  
  const snapshot = await getDocs(q);
  let apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Sort descending manually to avoid composite logic requirements immediately
  apps.sort((a: any, b: any) => {
     const dateA = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
     const dateB = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
     return dateB - dateA;
  });
  
  return apps.slice(0, limitCount);
}

// Replaces incrementPatient/decrementPatient -> advanceQueue
export async function advanceTokenQueue(clinicId: string, completedAppointmentId: string, finalFee: number = 0) {
  // 1. Mark the current one as completed
  const appRef = doc(db, APPOINTMENTS_COLLECTION, completedAppointmentId);
  const snap = await getDoc(appRef);
  if (!snap.exists()) return;
  const completedTokenNumber = snap.data().token_number;
  const currentSavedFee = snap.data().fees || 0;
  
  // Only override fee if explicitly specified, otherwise keep what was inputted during Walk-In
  await updateDoc(appRef, { 
    status: 'COMPLETED',
    fees: finalFee > 0 ? finalFee : currentSavedFee
  });

  // 2. Find the next appointment in line (to figure out the new active token)
  const q = query(
    collection(db, APPOINTMENTS_COLLECTION),
    where('clinic_id', '==', clinicId),
    where('status', 'in', ['WAITING', 'IN_PROGRESS']),
    orderBy('token_number', 'asc')
  );
  const queueSnap = await getDocs(q);
  
  let nextTokenDisplay = '--';
  if (!queueSnap.empty) {
     nextTokenDisplay = queueSnap.docs[0].data().token_number;
  } else {
     // Queue is empty now
     nextTokenDisplay = 'Empty';
  }

  // 3. Update global counter for public visibility
  const clinicRef = doc(db, CLINICS_COLLECTION, clinicId);
  await updateDoc(clinicRef, {
    patient_count: increment(-1),
    currently_serving_token: nextTokenDisplay
  });
}

export async function toggleClinicStatus(id: string, currentStatus: boolean) {
  const docRef = doc(db, CLINICS_COLLECTION, id);
  await updateDoc(docRef, {
    is_open: !currentStatus
  });
}
