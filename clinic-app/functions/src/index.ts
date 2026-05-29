import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function isSuperAdmin(phone: string | undefined): Promise<boolean> {
  if (!phone) return false;
  const adminSnap = await db.collection('admins').doc(phone).get();
  if (!adminSnap.exists) return false;
  const data = adminSnap.data()!;
  return data.role === 'super_admin' && data.is_active === true;
}

async function writeAuditLog(
  actorPhone: string,
  actorRole: string,
  action: string,
  details: string,
  targetId?: string,
  targetType?: string
) {
  await db.collection('system_audits').add({
    actor_phone: actorPhone,
    actor_role: actorRole,
    action,
    details,
    target_id: targetId || null,
    target_type: targetType || null,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION TRIGGER: Queue SMS + FCM when queue advances
// ─────────────────────────────────────────────────────────────────────────────

export const onQueueAdvanced = functions.firestore
  .document('appointments/{apptId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status === after.status || after.status !== 'COMPLETED') return;

    if (after.user_phone) {
      if (after.prescription_uploaded && after.prescription_url) {
        await db.collection('notifications_queue').add({
          type: 'WHATSAPP',
          status: 'pending',
          recipient_phone: after.user_phone,
          appointment_id: change.after.id,
          clinic_id: after.clinic_id,
          token_number: after.token_number,
          patient_name: after.patient_name,
          positions_ahead: -1,
          message: `Thank you for visiting! Your digital prescription is ready. Download it here: ${after.prescription_url}\n\nWe will securely save it to your Q-PULSE vault for your next visit!`,
          attempts: 0,
          scheduled_at: admin.firestore.FieldValue.serverTimestamp(),
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await db.collection('notifications_queue').add({
          type: 'WHATSAPP',
          status: 'pending',
          recipient_phone: after.user_phone,
          appointment_id: change.after.id,
          clinic_id: after.clinic_id,
          token_number: after.token_number,
          patient_name: after.patient_name,
          positions_ahead: -1,
          message: `Thank you for visiting! To keep your records safe, please reply to this message with a clear photo or PDF of your physical prescription. We will securely save it to your Q-PULSE vault for your next visit!`,
          attempts: 0,
          scheduled_at: admin.firestore.FieldValue.serverTimestamp(),
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    const clinicId = after.clinic_id;

    const waitingSnap = await db.collection('appointments')
      .where('clinic_id', '==', clinicId)
      .where('status', 'in', ['WAITING', 'IN_PROGRESS'])
      .orderBy('token_number', 'asc')
      .get();

    for (let i = 0; i < waitingSnap.docs.length; i++) {
      const appt = waitingSnap.docs[i].data();
      const apptId = waitingSnap.docs[i].id;
      if (!appt.user_phone) continue;

      const notifyAt = [0, 2];
      if (!notifyAt.includes(i)) continue;

      const isYourTurn = i === 0;
      const alreadySent = isYourTurn
        ? appt.notifications_sent?.your_turn
        : appt.notifications_sent?.near_turn;

      if (alreadySent) continue;

      const message = isYourTurn
        ? `Q-PULSE: Your turn is here! Token #${appt.token_number}. Please proceed to the doctor's room.`
        : `Q-PULSE: 2 patients ahead. Token #${appt.token_number}. Please be ready!`;

      await db.collection('notifications_queue').add({
        type: 'SMS',
        status: 'pending',
        recipient_phone: appt.user_phone,
        appointment_id: apptId,
        clinic_id: clinicId,
        token_number: appt.token_number,
        patient_name: appt.patient_name,
        positions_ahead: i,
        message,
        attempts: 0,
        scheduled_at: admin.firestore.FieldValue.serverTimestamp(),
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      try {
        const fcmDoc = await db.collection('fcm_tokens').doc(appt.user_phone).get();
        if (fcmDoc.exists) {
          const fcmToken = fcmDoc.data()?.token;
          if (fcmToken) {
            await db.collection('notifications_queue').add({
              type: 'FCM',
              status: 'pending',
              recipient_fcm_token: fcmToken,
              appointment_id: apptId,
              clinic_id: clinicId,
              token_number: appt.token_number,
              patient_name: appt.patient_name,
              positions_ahead: i,
              message,
              attempts: 0,
              scheduled_at: admin.firestore.FieldValue.serverTimestamp(),
              created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      } catch (fcmErr) {
        console.error(`Failed to check/queue FCM for phone ${appt.user_phone}:`, fcmErr);
      }

      await db.collection('notifications_queue').add({
        type: 'WHATSAPP',
        status: 'pending',
        recipient_phone: appt.user_phone,
        appointment_id: apptId,
        clinic_id: clinicId,
        token_number: appt.token_number,
        patient_name: appt.patient_name,
        positions_ahead: i,
        message,
        attempts: 0,
        scheduled_at: admin.firestore.FieldValue.serverTimestamp(),
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      const field = isYourTurn ? 'notifications_sent.your_turn' : 'notifications_sent.near_turn';
      await db.collection('appointments').doc(apptId).update({ [field]: true });
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION PROCESSOR: Send SMS / FCM from queue
// ─────────────────────────────────────────────────────────────────────────────

export const processNotificationJob = functions.firestore
  .document('notifications_queue/{jobId}')
  .onCreate(async (snap) => {
    const job = snap.data();
    if (!job || job.status !== 'pending') return;

    if (job.type === 'SMS') {
      const authKey = process.env.MSG91_AUTH_KEY;
      const templateId = process.env.MSG91_TEMPLATE_ID;

      if (!authKey || !templateId) {
        console.error('MSG91 credentials missing.');
        await snap.ref.update({
          status: 'failed',
          error_message: 'MSG91 credentials missing',
          attempts: (job.attempts || 0) + 1,
        });
        return;
      }

      try {
        const cleanPhone = job.recipient_phone.replace('+', '');
        const response = await fetch('https://control.msg91.com/api/v5/flow/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'authkey': authKey },
          body: JSON.stringify({
            template_id: templateId,
            recipients: [{ mobiles: cleanPhone, name: job.patient_name, token: `#${job.token_number}` }],
          }),
        });

        if (!response.ok) throw new Error(`MSG91 API error: HTTP ${response.status}`);
        const result = (await response.json()) as any;

        await snap.ref.update({
          status: 'sent',
          provider_message_id: result.request_id || 'success',
          sent_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err: any) {
        console.error('Failed to send SMS via MSG91:', err);
        await snap.ref.update({
          status: 'failed',
          error_message: err.message || 'Unknown error',
          attempts: (job.attempts || 0) + 1,
        });
      }
    } else if (job.type === 'FCM') {
      if (!job.recipient_fcm_token) {
        await snap.ref.update({ status: 'failed', error_message: 'FCM token missing', attempts: (job.attempts || 0) + 1 });
        return;
      }

      try {
        const response = await admin.messaging().send({
          notification: {
            title: job.positions_ahead === 0 ? 'Your Turn is Here!' : 'Your Turn is Near!',
            body: job.message,
          },
          token: job.recipient_fcm_token,
        });

        await snap.ref.update({
          status: 'sent',
          provider_message_id: response,
          sent_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err: any) {
        console.error('Failed to send FCM push notification:', err);
        await snap.ref.update({
          status: 'failed',
          error_message: err.message || 'Unknown error',
          attempts: (job.attempts || 0) + 1,
        });
      }
    } else if (job.type === 'WHATSAPP') {
      const twilioSid = process.env.TWILIO_SID;
      const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
      const twilioSender = process.env.TWILIO_SENDER_NUMBER;

      if (!twilioSid || !twilioAuth || !twilioSender) {
        console.error('Twilio credentials missing.');
        await snap.ref.update({
          status: 'failed',
          error_message: 'Twilio credentials missing',
          attempts: (job.attempts || 0) + 1,
        });
        return;
      }

      try {
        let toPhone = job.recipient_phone;
        if (!toPhone.startsWith('+')) toPhone = '+' + toPhone;

        const bodyParams = new URLSearchParams();
        bodyParams.append('To', `whatsapp:${toPhone}`);
        bodyParams.append('From', twilioSender);
        bodyParams.append('Body', job.message);

        const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');

        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': authHeader
          },
          body: bodyParams.toString()
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Twilio API error: ${response.status} - ${errorData}`);
        }
        
        const result = (await response.json()) as any;

        await snap.ref.update({
          status: 'sent',
          provider_message_id: result.sid || 'success',
          sent_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err: any) {
        console.error('Failed to send WhatsApp via Twilio:', err);
        await snap.ref.update({
          status: 'failed',
          error_message: err.message || 'Unknown error',
          attempts: (job.attempts || 0) + 1,
        });
      }
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT TRIGGER: Automatically log every appointment and clinic write
// Captures all actions by staff and doctors with full context.
// ─────────────────────────────────────────────────────────────────────────────

export const onAppointmentAudit = functions.firestore
  .document('appointments/{apptId}')
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data()! : null;
    const after = change.after.exists ? change.after.data()! : null;
    const apptId = context.params.apptId;

    if (!before && after) {
      // Created
      await writeAuditLog(
        after.user_phone || 'system',
        'patient_or_staff',
        'APPOINTMENT_CREATED',
        `Token #${after.token_number} booked for ${after.patient_name} at clinic ${after.clinic_id}`,
        apptId,
        'appointment'
      );
    } else if (before && after) {
      // Status changed
      if (before.status !== after.status) {
        await writeAuditLog(
          after.user_phone || 'system',
          'staff_or_doctor',
          `APPOINTMENT_STATUS_CHANGED`,
          `Token #${after.token_number} → ${before.status} to ${after.status} at clinic ${after.clinic_id}`,
          apptId,
          'appointment'
        );
      }
    }
  });

export const onClinicAudit = functions.firestore
  .document('clinics/{clinicId}')
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data()! : null;
    const after = change.after.exists ? change.after.data()! : null;
    const clinicId = context.params.clinicId;

    if (!before && after) {
      await writeAuditLog(
        after.authorized_phone || 'system',
        'org_admin_or_super_admin',
        'CLINIC_CREATED',
        `Clinic "${after.name}" created under org ${after.org_id}`,
        clinicId,
        'clinic'
      );
    } else if (before && after) {
      const changes: string[] = [];
      if (before.is_open !== after.is_open) changes.push(`is_open: ${before.is_open} → ${after.is_open}`);
      if (before.is_hidden !== after.is_hidden) changes.push(`is_hidden: ${before.is_hidden} → ${after.is_hidden}`);
      if (before.doctor_name !== after.doctor_name) changes.push(`doctor_name: ${before.doctor_name} → ${after.doctor_name}`);
      if (changes.length > 0) {
        await writeAuditLog(
          after.authorized_phone || 'system',
          'staff_or_admin',
          'CLINIC_UPDATED',
          `Clinic "${after.name}" updated: ${changes.join(', ')}`,
          clinicId,
          'clinic'
        );
      }
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// APPROVE ORG REQUEST — HTTPS Callable (Super Admin Only)
// Creates organization + admin record atomically, then updates request status.
// ─────────────────────────────────────────────────────────────────────────────

export const approveOrgRequest = functions.https.onCall(async (data, context) => {
  const callerPhone = context.auth?.token?.phone_number;
  if (!callerPhone || !(await isSuperAdmin(callerPhone))) {
    throw new functions.https.HttpsError('permission-denied', 'Only the Super Admin can approve requests.');
  }

  const { requestId } = data;
  if (!requestId) throw new functions.https.HttpsError('invalid-argument', 'requestId is required.');

  const reqRef = db.collection('org_requests').doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new functions.https.HttpsError('not-found', 'Request not found.');

  const req = reqSnap.data()!;
  if (req.status !== 'PENDING') throw new functions.https.HttpsError('failed-precondition', 'Request is not PENDING.');

  // Atomic batch: create org + admin record
  const batch = db.batch();

  const orgRef = db.collection('organizations').doc();
  batch.set(orgRef, {
    id: orgRef.id,
    name: req.org_name,
    type: req.org_type,
    city: req.city || '',
    owner_uid: req.submitter_uid || '',
    owner_phone: req.contact_phone,
    status: 'ACTIVE',
    plan: 'basic',
    max_clinics: 5,
    approved_by: callerPhone,
    approved_at: admin.firestore.FieldValue.serverTimestamp(),
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  const adminRef = db.collection('admins').doc(req.contact_phone);
  batch.set(adminRef, {
    phone: req.contact_phone,
    uid: req.submitter_uid || '',
    name: req.contact_name,
    role: 'org_admin',
    org_id: orgRef.id,
    is_active: true,
    added_by: callerPhone,
    added_at: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  batch.update(reqRef, {
    status: 'APPROVED',
    org_id_created: orgRef.id,
    reviewed_by: callerPhone,
    reviewed_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();

  await writeAuditLog(
    callerPhone,
    'super_admin',
    'ORG_REQUEST_APPROVED',
    `Approved request "${req.org_name}" (${requestId}). Created org ${orgRef.id} and granted access to ${req.contact_phone}.`,
    requestId,
    'org_request'
  );

  return { success: true, orgId: orgRef.id };
});

// ─────────────────────────────────────────────────────────────────────────────
// REJECT ORG REQUEST — HTTPS Callable (Super Admin Only)
// ─────────────────────────────────────────────────────────────────────────────

export const rejectOrgRequest = functions.https.onCall(async (data, context) => {
  const callerPhone = context.auth?.token?.phone_number;
  if (!callerPhone || !(await isSuperAdmin(callerPhone))) {
    throw new functions.https.HttpsError('permission-denied', 'Only the Super Admin can reject requests.');
  }

  const { requestId, reason } = data;
  if (!requestId) throw new functions.https.HttpsError('invalid-argument', 'requestId is required.');

  const reqRef = db.collection('org_requests').doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new functions.https.HttpsError('not-found', 'Request not found.');

  const req = reqSnap.data()!;

  await reqRef.update({
    status: 'REJECTED',
    rejection_reason: reason || 'No reason provided.',
    reviewed_by: callerPhone,
    reviewed_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  await writeAuditLog(
    callerPhone,
    'super_admin',
    'ORG_REQUEST_REJECTED',
    `Rejected request "${req.org_name}" (${requestId}). Reason: ${reason || 'None specified.'}`,
    requestId,
    'org_request'
  );

  return { success: true };
});

// ─────────────────────────────────────────────────────────────────────────────
// HARD DELETE ORGANIZATION — HTTPS Callable (Super Admin Only)
// Cascades: Org → Hospitals → Clinics → Appointments → Admin record → Audit log
// Uses batched writes in chunks to handle large datasets safely.
// ─────────────────────────────────────────────────────────────────────────────

export const hardDeleteOrganization = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    const callerPhone = context.auth?.token?.phone_number;
    if (!callerPhone || !(await isSuperAdmin(callerPhone))) {
      throw new functions.https.HttpsError('permission-denied', 'Only the Super Admin can hard-delete organizations.');
    }

    const { orgId, confirmName } = data;
    if (!orgId || !confirmName) {
      throw new functions.https.HttpsError('invalid-argument', 'orgId and confirmName are required.');
    }

    const orgSnap = await db.collection('organizations').doc(orgId).get();
    if (!orgSnap.exists) throw new functions.https.HttpsError('not-found', 'Organization not found.');

    const orgData = orgSnap.data()!;
    if (orgData.name.trim().toLowerCase() !== confirmName.trim().toLowerCase()) {
      throw new functions.https.HttpsError('invalid-argument', 'Confirmation name does not match organization name.');
    }

    const deletedSummary = { hospitals: 0, clinics: 0, appointments: 0, admins: 0 };

    // Helper: delete a collection of documents in batches
    async function deleteInBatches(snapshot: FirebaseFirestore.QuerySnapshot) {
      const CHUNK = 400;
      let i = 0;
      while (i < snapshot.docs.length) {
        const batch = db.batch();
        const chunk = snapshot.docs.slice(i, i + CHUNK);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
        i += CHUNK;
      }
      return snapshot.docs.length;
    }

    // 1. Get all clinics in this org
    const clinicsSnap = await db.collection('clinics').where('org_id', '==', orgId).get();
    const clinicIds = clinicsSnap.docs.map(d => d.id);

    // 2. Delete all appointments for each clinic (chunked by clinicId)
    for (const clinicId of clinicIds) {
      const apptsSnap = await db.collection('appointments').where('clinic_id', '==', clinicId).get();
      deletedSummary.appointments += await deleteInBatches(apptsSnap);
    }

    // 3. Delete all clinics
    deletedSummary.clinics += await deleteInBatches(clinicsSnap);

    // 4. Delete all hospitals in this org
    const hospitalsSnap = await db.collection('hospitals').where('org_id', '==', orgId).get();
    deletedSummary.hospitals += await deleteInBatches(hospitalsSnap);

    // 5. Delete the admin record for the org owner
    const adminsSnap = await db.collection('admins').where('org_id', '==', orgId).get();
    deletedSummary.admins += await deleteInBatches(adminsSnap);

    // 6. Delete the organization itself
    await db.collection('organizations').doc(orgId).delete();

    // 7. Write immutable audit log (even though everything is gone, the log remains)
    await writeAuditLog(
      callerPhone,
      'super_admin',
      'HARD_DELETE_ORGANIZATION',
      `PERMANENTLY DELETED org "${orgData.name}" (${orgId}). Cascade: ${deletedSummary.hospitals} hospitals, ${deletedSummary.clinics} clinics, ${deletedSummary.appointments} appointments, ${deletedSummary.admins} admin records wiped.`,
      orgId,
      'organization'
    );

    return { success: true, deleted: deletedSummary };
  });

// ─────────────────────────────────────────────────────────────────────────────
// SOFT SUSPEND ORGANIZATION — HTTPS Callable (Super Admin Only)
// ─────────────────────────────────────────────────────────────────────────────

export const suspendOrganization = functions.https.onCall(async (data, context) => {
  const callerPhone = context.auth?.token?.phone_number;
  if (!callerPhone || !(await isSuperAdmin(callerPhone))) {
    throw new functions.https.HttpsError('permission-denied', 'Only the Super Admin can suspend organizations.');
  }

  const { orgId, reason } = data;
  if (!orgId) throw new functions.https.HttpsError('invalid-argument', 'orgId is required.');

  const orgSnap = await db.collection('organizations').doc(orgId).get();
  if (!orgSnap.exists) throw new functions.https.HttpsError('not-found', 'Organization not found.');

  const orgData = orgSnap.data()!;
  const isCurrentlySuspended = orgData.status === 'SUSPENDED';
  const newStatus = isCurrentlySuspended ? 'ACTIVE' : 'SUSPENDED';
  const newIsActive = isCurrentlySuspended ? true : false;

  // 1. Fetch all descendants
  const clinicsSnap = await db.collection('clinics').where('org_id', '==', orgId).get();
  const hospitalsSnap = await db.collection('hospitals').where('org_id', '==', orgId).get();
  const adminsSnap = await db.collection('admins').where('org_id', '==', orgId).get();

  const allUpdates: { ref: FirebaseFirestore.DocumentReference, data: any }[] = [];

  // Add Org Update
  allUpdates.push({
    ref: db.collection('organizations').doc(orgId),
    data: {
      status: newStatus,
      suspended_by: isCurrentlySuspended ? null : callerPhone,
      suspended_at: isCurrentlySuspended ? null : admin.firestore.FieldValue.serverTimestamp(),
      suspension_reason: isCurrentlySuspended ? null : (reason || 'Suspended by Super Admin.'),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }
  });

  // Add Cascade Updates
  clinicsSnap.docs.forEach(d => allUpdates.push({ ref: d.ref, data: { status: newStatus, updated_at: admin.firestore.FieldValue.serverTimestamp() } }));
  hospitalsSnap.docs.forEach(d => allUpdates.push({ ref: d.ref, data: { status: newStatus, updated_at: admin.firestore.FieldValue.serverTimestamp() } }));
  adminsSnap.docs.forEach(d => allUpdates.push({ ref: d.ref, data: { is_active: newIsActive, updated_at: admin.firestore.FieldValue.serverTimestamp() } }));

  // Execute in batches to prevent 500 write limit exceptions
  const CHUNK = 400;
  for (let i = 0; i < allUpdates.length; i += CHUNK) {
    const batch = db.batch();
    const chunk = allUpdates.slice(i, i + CHUNK);
    chunk.forEach(update => batch.update(update.ref, update.data));
    await batch.commit();
  }

  await writeAuditLog(
    callerPhone,
    'super_admin',
    isCurrentlySuspended ? 'ORG_REINSTATED' : 'ORG_SUSPENDED',
    `${isCurrentlySuspended ? 'Reinstated' : 'Suspended'} org "${orgData.name}" (${orgId}). ${!isCurrentlySuspended ? 'Reason: ' + (reason || 'None') : ''}`,
    orgId,
    'organization'
  );

  return { success: true, newStatus };
});

// ─────────────────────────────────────────────────────────────────────────────
// TWILIO WEBHOOK: Receive WhatsApp Prescriptions
// ─────────────────────────────────────────────────────────────────────────────

export const twilioWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { From, NumMedia, MediaUrl0, MediaContentType0 } = req.body;

    if (!From || !From.startsWith('whatsapp:')) {
      res.status(200).send('<Response></Response>'); // Ignore non-whatsapp
      return;
    }

    const patientPhone = From.replace('whatsapp:', '');

    if (NumMedia && parseInt(NumMedia) > 0 && MediaUrl0) {
      // SECURITY: Prevent SSRF by validating the media URL is from Twilio
      if (!MediaUrl0.startsWith('https://api.twilio.com/')) {
        console.error('SSRF Attempt detected! Invalid MediaUrl0:', MediaUrl0);
        res.status(400).send('Invalid Media URL');
        return;
      }

      const twilioSid = process.env.TWILIO_SID;
      const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');

      // Fetch the media from Twilio
      const mediaRes = await fetch(MediaUrl0, {
        headers: { 'Authorization': authHeader }
      });
      
      if (!mediaRes.ok) {
        throw new Error('Failed to download media from Twilio');
      }

      const buffer = Buffer.from(await mediaRes.arrayBuffer());
      const extension = MediaContentType0 === 'application/pdf' ? 'pdf' : 'jpg';
      const filename = `prescriptions/${patientPhone}/${Date.now()}.${extension}`;

      // Upload to Firebase Storage
      const bucket = admin.storage().bucket();
      const file = bucket.file(filename);
      await file.save(buffer, {
        metadata: { contentType: MediaContentType0 || 'image/jpeg' }
      });
      await file.makePublic();
      const publicUrl = file.publicUrl();

      // Find the most recent COMPLETED appointment for this patient
      const apptsSnap = await db.collection('appointments')
        .where('user_phone', '==', patientPhone)
        .where('status', '==', 'COMPLETED')
        .orderBy('created_at', 'desc')
        .limit(1)
        .get();

      if (!apptsSnap.empty) {
        const apptDoc = apptsSnap.docs[0];
        let currentUrls = apptDoc.data().prescriptionImageUrls || [];
        currentUrls.push(publicUrl);

        await apptDoc.ref.update({
          prescriptionImageUrls: currentUrls,
          prescription_uploaded: true
        });

        // Reply to patient
        res.setHeader('Content-Type', 'text/xml');
        res.status(200).send(`
          <Response>
            <Message>Received! Your prescription has been securely saved to your vault.</Message>
          </Response>
        `);
        return;
      } else {
        res.setHeader('Content-Type', 'text/xml');
        res.status(200).send(`
          <Response>
            <Message>We received your file, but couldn't find a recent completed appointment to attach it to.</Message>
          </Response>
        `);
        return;
      }
    }

    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(`
      <Response>
        <Message>Please reply with a photo or PDF of your prescription to save it to your vault.</Message>
      </Response>
    `);
  } catch (error) {
    console.error('Twilio webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});
