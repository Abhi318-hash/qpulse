import { 
  collection, doc, getDoc, getDocs, addDoc, setDoc, 
  updateDoc, deleteDoc, query, orderBy, where, serverTimestamp, 
  writeBatch, Timestamp, arrayUnion, arrayRemove 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';

const PATIENTS_COL = 'patients';
const APPOINTMENTS_COL = 'appointments';
const CLINICS_COL = 'clinics';

// ─────────────────────────────────────────────────────────────────────────────
// FILE UPLOADS TO FIREBASE STORAGE
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadFileToStorage(
  patientId: string,
  file: File,
  folder: 'prescriptions' | 'lab_reports'
): Promise<{ downloadUrl: string; storagePath: string }> {
  if (!patientId || !file) throw new Error('Missing patient ID or file');

  const timestamp = Date.now();
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
  const storagePath = `${folder}/${patientId}/${timestamp}_${cleanFileName}`;
  const fileRef = ref(storage, storagePath);

  // Upload file
  await uploadBytes(fileRef, file);
  
  // Get public download URL
  const downloadUrl = await getDownloadURL(fileRef);

  return { downloadUrl, storagePath };
}

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT MEDICAL RECORDS AND PRESCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createMedicalRecord(
  patientId: string,
  appointmentId: string,
  clinicId: string,
  data: {
    doctorName: string;
    specialization: string;
    chiefComplaint: string;
    diagnosis: string;
    vitals?: {
      bpSystolic?: number;
      bpDiastolic?: number;
      heartRate?: number;
      temperature?: number;
      weightKg?: number;
      heightCm?: number;
      spo2?: number;
      bloodSugar?: number;
    };
    medications: {
      name: string;
      dosage: string;
      duration: string;
      instructions: string;
    }[];
    testsOrdered: string[];
    followUpDate?: string;
    doctorNotes: string;
    consultationFee: number;
    paymentMode: string;
    prescriptionImageUrls?: string[];
  }
) {
  // 1. Get clinic and organization details for audit & structure
  const clinicRef = doc(db, CLINICS_COL, clinicId);
  const clinicSnap = await getDoc(clinicRef);
  const orgId = clinicSnap.exists() ? (clinicSnap.data().org_id || '') : '';

  // 2. Create the medical record in the patient's sub-collection
  const recordRef = doc(collection(db, PATIENTS_COL, patientId, 'medical_records'));
  const recordPayload = {
    id: recordRef.id,
    patient_id: patientId,
    appointment_id: appointmentId,
    clinic_id: clinicId,
    org_id: orgId,
    visit_date: serverTimestamp(),
    doctor_name: data.doctorName,
    specialization: data.specialization,
    chief_complaint: data.chiefComplaint,
    diagnosis: data.diagnosis,
    vitals: data.vitals || {},
    medications_prescribed: data.medications,
    tests_ordered: data.testsOrdered,
    follow_up_date: data.followUpDate || '',
    doctor_notes: data.doctorNotes || '',
    consultation_fee: data.consultationFee,
    payment_mode: data.paymentMode || 'cash',
    fees_paid: true,
    prescription_image_urls: data.prescriptionImageUrls || [],
    lab_report_urls: [],
    created_at: serverTimestamp(),
  };

  await setDoc(recordRef, recordPayload);

  // 3. Increment total visits and spent in patient profile
  const patientRef = doc(db, PATIENTS_COL, patientId);
  const patientSnap = await getDoc(patientRef);
  
  if (patientSnap.exists()) {
    const pData = patientSnap.data();
    const currentClinics = pData.stats?.clinics_visited || [];
    const updatedClinics = currentClinics.includes(clinicId) 
      ? currentClinics 
      : [...currentClinics, clinicId];

    await updateDoc(patientRef, {
      'stats.total_visits': (pData.stats?.total_visits || 0) + 1,
      'stats.total_spent': (pData.stats?.total_spent || 0) + data.consultationFee,
      'stats.clinics_visited': updatedClinics,
      'stats.last_visited_clinic_id': clinicId,
      'stats.last_visited_at': serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  }

  // 4. If files are uploaded, also log them in the prescriptions sub-collection
  if (data.prescriptionImageUrls && data.prescriptionImageUrls.length > 0) {
    const batch = writeBatch(db);
    for (const url of data.prescriptionImageUrls) {
      const prescref = doc(collection(db, PATIENTS_COL, patientId, 'prescriptions'));
      batch.set(prescref, {
        id: prescref.id,
        patient_id: patientId,
        record_id: recordRef.id,
        clinic_id: clinicId,
        file_name: 'prescription.jpg',
        file_url: url,
        storage_path: '', // populated when manually uploaded
        file_type: 'prescription',
        file_size_bytes: 0,
        mime_type: 'image/jpeg',
        uploaded_by: 'staff',
        doctor_name: data.doctorName,
        clinic_name: clinicSnap.exists() ? clinicSnap.data().name : 'Clinic',
        visit_date: new Date().toISOString().split('T')[0],
        created_at: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return recordRef.id;
}

export async function addPatientPrescriptionDocument(
  patientId: string,
  data: {
    fileUrl: string;
    storagePath: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    clinicId: string;
    doctorName: string;
    notes?: string;
  }
) {
  const clinicRef = doc(db, CLINICS_COL, data.clinicId);
  const clinicSnap = await getDoc(clinicRef);
  const clinicName = clinicSnap.exists() ? clinicSnap.data().name : 'Clinic';

  const docRef = doc(collection(db, PATIENTS_COL, patientId, 'prescriptions'));
  await setDoc(docRef, {
    id: docRef.id,
    patient_id: patientId,
    record_id: '', // manually uploaded, not linked to a specific EHR record
    clinic_id: data.clinicId,
    file_name: data.fileName,
    file_url: data.fileUrl,
    storage_path: data.storagePath,
    file_type: data.mimeType.includes('pdf') ? 'lab_report' : 'prescription',
    file_size_bytes: data.fileSizeBytes,
    mime_type: data.mimeType,
    uploaded_by: 'patient',
    doctor_name: data.doctorName || 'General Doctor',
    clinic_name: clinicName,
    visit_date: new Date().toISOString().split('T')[0],
    notes: data.notes || '',
    created_at: serverTimestamp(),
  });

  return docRef.id;
}

export async function getPatientMedicalRecords(patientId: string) {
  const q = query(
    collection(db, PATIENTS_COL, patientId, 'medical_records'),
    orderBy('visit_date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPatientPrescriptions(patientId: string) {
  const q = query(
    collection(db, PATIENTS_COL, patientId, 'prescriptions'),
    orderBy('created_at', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────────────────────────────────────────────────────
// DPDP ACT 2023 COMPLIANCE (Data Privacy)
// ─────────────────────────────────────────────────────────────────────────────

export async function exportPatientData(patientId: string): Promise<string> {
  const patientRef = doc(db, PATIENTS_COL, patientId);
  const patientSnap = await getDoc(patientRef);
  
  if (!patientSnap.exists()) {
    throw new Error('Patient profile not found.');
  }

  const profile = patientSnap.data();
  const medicalRecords = await getPatientMedicalRecords(patientId);
  const prescriptions = await getPatientPrescriptions(patientId);

  const fullData = {
    export_timestamp: new Date().toISOString(),
    legal_basis: 'DPDP_ACT_2023_RIGHT_TO_PORTABILITY',
    profile,
    medical_records: medicalRecords,
    prescriptions: prescriptions,
  };

  return JSON.stringify(fullData, null, 2);
}

export async function deletePatientAccount(patientId: string, phone: string) {
  const batch = writeBatch(db);

  // 1. Delete prescriptions sub-collection docs
  const prescsSnap = await getDocs(collection(db, PATIENTS_COL, patientId, 'prescriptions'));
  for (const docSnap of prescsSnap.docs) {
    const pData = docSnap.data();
    if (pData.storage_path) {
      try {
        const fileRef = ref(storage, pData.storage_path);
        await deleteObject(fileRef);
      } catch (e) {
        console.warn('Failed to delete file from storage during account purge:', e);
      }
    }
    batch.delete(docSnap.ref);
  }

  // 2. Delete medical records sub-collection docs
  const recordsSnap = await getDocs(collection(db, PATIENTS_COL, patientId, 'medical_records'));
  for (const docSnap of recordsSnap.docs) {
    batch.delete(docSnap.ref);
  }

  // 3. Delete patient main document
  batch.delete(doc(db, PATIENTS_COL, patientId));

  // 4. Anonymize all past appointments associated with this patient's phone number
  const apptsQuery = query(
    collection(db, APPOINTMENTS_COL),
    where('user_phone', '==', phone)
  );
  const apptsSnap = await getDocs(apptsQuery);
  for (const docSnap of apptsSnap.docs) {
    batch.update(docSnap.ref, {
      patient_name: 'Anonymised Patient',
      user_phone: '[DELETED]',
      age: 0,
      disease: 'Purged',
      notes: 'Purged per DPDP Act 2023 request',
    });
  }

  // Commit batch
  await batch.commit();
}

export async function findOrCreatePatientByPhone(phone: string, name: string): Promise<string> {
  if (!phone) {
    // Generate a random patient doc for phone-less walk-ins
    const newPatientRef = doc(collection(db, PATIENTS_COL));
    await setDoc(newPatientRef, {
      id: newPatientRef.id,
      phone: '',
      full_name: name,
      medical_background: { chronic_conditions: [], allergies: [], current_medications: [], surgeries: [], family_history: [] },
      stats: { total_visits: 0, total_spent: 0, clinics_visited: [] },
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    return newPatientRef.id;
  }

  const q = query(collection(db, PATIENTS_COL), where('phone', '==', phone));
  const snap = await getDocs(q);
  if (!snap.empty) {
    return snap.docs[0].id;
  }

  // Create a placeholder patient document
  const newPatientRef = doc(collection(db, PATIENTS_COL));
  await setDoc(newPatientRef, {
    id: newPatientRef.id,
    phone: phone,
    full_name: name,
    medical_background: { chronic_conditions: [], allergies: [], current_medications: [], surgeries: [], family_history: [] },
    stats: { total_visits: 0, total_spent: 0, clinics_visited: [] },
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  });
  return newPatientRef.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT ACCESS CONTROL
// ─────────────────────────────────────────────────────────────────────────────

export async function grantClinicAccess(patientId: string, clinicId: string) {
  const patientRef = doc(db, PATIENTS_COL, patientId);
  await updateDoc(patientRef, {
    granted_access_clinics: arrayUnion(clinicId),
    updated_at: serverTimestamp()
  });
}

export async function revokeClinicAccess(patientId: string, clinicId: string) {
  const patientRef = doc(db, PATIENTS_COL, patientId);
  await updateDoc(patientRef, {
    granted_access_clinics: arrayRemove(clinicId),
    updated_at: serverTimestamp()
  });
}

export async function getPatientMedicalHistoryForClinic(phone: string, clinicId: string) {
  const q = query(collection(db, PATIENTS_COL), where('phone', '==', phone));
  const snap = await getDocs(q);
  if (snap.empty) {
    throw new Error('Patient profile not found.');
  }
  
  const patient = snap.docs[0].data();
  if (!patient.granted_access_clinics?.includes(clinicId)) {
    throw new Error('Access denied. Patient has not granted access to their medical history for this clinic.');
  }

  const appQ = query(
    collection(db, APPOINTMENTS_COL),
    where('user_phone', '==', phone),
    where('status', '==', 'COMPLETED')
  );
  const appSnap = await getDocs(appQ);
  let apps = appSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  apps.sort((a: any, b: any) => {
    const dateA = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
    const dateB = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
    return dateB - dateA;
  });
  return apps;
}
