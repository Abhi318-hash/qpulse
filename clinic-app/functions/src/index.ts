import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

export const onQueueAdvanced = functions.firestore
  .document('appointments/{apptId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only trigger when an appointment's status becomes COMPLETED
    if (before.status === after.status || after.status !== 'COMPLETED') return;

    const clinicId = after.clinic_id;

    // Get all remaining waiting patients in order
    const waitingSnap = await db.collection('appointments')
      .where('clinic_id', '==', clinicId)
      .where('status', 'in', ['WAITING', 'IN_PROGRESS'])
      .orderBy('token_number', 'asc')
      .get();

    for (let i = 0; i < waitingSnap.docs.length; i++) {
      const appt = waitingSnap.docs[i].data();
      const apptId = waitingSnap.docs[i].id;
      if (!appt.user_phone) continue;

      const notifyAt = [0, 2]; // positions to notify: 0 (current turn), 2 (2 patients ahead)
      if (!notifyAt.includes(i)) continue;

      const isYourTurn = i === 0;
      const alreadySent = isYourTurn
        ? appt.notifications_sent?.your_turn
        : appt.notifications_sent?.near_turn;

      if (alreadySent) continue;

      const message = isYourTurn
        ? `Q-PULSE: Your turn is here! Token #${appt.token_number}. Please proceed to the doctor's room.`
        : `Q-PULSE: 2 patients ahead. Token #${appt.token_number}. Please be ready!`;

      // 1. Queue the SMS notification job
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

      // 2. Queue the FCM push notification job if a token exists for this phone number
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

      // Mark notification as sent in the appointment document
      const field = isYourTurn
        ? 'notifications_sent.your_turn'
        : 'notifications_sent.near_turn';
      await db.collection('appointments').doc(apptId).update({ [field]: true });
    }
  });

export const processNotificationJob = functions.firestore
  .document('notifications_queue/{jobId}')
  .onCreate(async (snap) => {
    const job = snap.data();
    if (!job || job.status !== 'pending') return;

    if (job.type === 'SMS') {
      const authKey = process.env.MSG91_AUTH_KEY;
      const templateId = process.env.MSG91_TEMPLATE_ID;

      if (!authKey || !templateId) {
        console.error('MSG91 credentials missing. Please set MSG91_AUTH_KEY and MSG91_TEMPLATE_ID env variables.');
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
          headers: {
            'Content-Type': 'application/json',
            'authkey': authKey,
          },
          body: JSON.stringify({
            template_id: templateId,
            recipients: [
              {
                mobiles: cleanPhone,
                name: job.patient_name,
                token: `#${job.token_number}`,
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`MSG91 API error: HTTP ${response.status}`);
        }

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
        await snap.ref.update({
          status: 'failed',
          error_message: 'FCM registration token missing',
          attempts: (job.attempts || 0) + 1,
        });
        return;
      }

      try {
        const payload = {
          notification: {
            title: job.positions_ahead === 0 ? 'Your Turn is Here!' : 'Your Turn is Near!',
            body: job.message,
          },
          token: job.recipient_fcm_token,
        };

        const response = await admin.messaging().send(payload);

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
    }
  });
