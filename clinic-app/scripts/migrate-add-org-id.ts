import * as admin from 'firebase-admin';

// Initialize firebase admin using application default credentials (ADC)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function migrate() {
  console.log('Starting multi-tenancy migration...');
  
  const superAdminPhone = '+919021550496';
  const defaultOrgId = 'default_org';

  // 1. Create a default organization for super_admin if not exists
  const orgRef = db.collection('organizations').doc(defaultOrgId);
  const orgSnap = await orgRef.get();
  
  if (!orgSnap.exists) {
    console.log(`Creating default organization: ${defaultOrgId}`);
    await orgRef.set({
      id: defaultOrgId,
      name: 'Default Q-PULSE Organization',
      slug: 'default-qpulse',
      owner_uid: 'system_migration',
      owner_phone: superAdminPhone,
      plan: 'pro',
      max_clinics: 10,
      max_tokens_per_day: 99999,
      billing_status: 'active',
      billing_cycle_end: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
      features: {
        sms_notifications: true,
        whatsapp_notifications: true,
        patient_records: true,
        prescription_storage: true,
        analytics_dashboard: true,
        custom_branding: true,
        api_access: true
      },
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // Add the super_admin phone to the admins collection with org_id linked
  console.log(`Linking super admin ${superAdminPhone} to ${defaultOrgId}`);
  await db.collection('admins').doc(superAdminPhone).set({
    phone: superAdminPhone,
    role: 'super_admin',
    org_id: defaultOrgId,
    is_active: true,
    added_by: 'system_migration',
    added_at: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // 2. Update clinics
  console.log('Migrating clinics...');
  const clinicsSnap = await db.collection('clinics').get();
  let clinicCount = 0;
  for (const docSnap of clinicsSnap.docs) {
    const data = docSnap.data();
    if (!data.org_id) {
      await docSnap.ref.update({ 
        org_id: defaultOrgId, 
        updated_at: admin.firestore.FieldValue.serverTimestamp() 
      });
      clinicCount++;
    }
  }
  console.log(`Successfully migrated ${clinicCount} clinics to default_org.`);

  // 3. Update appointments
  console.log('Migrating appointments...');
  const apptsSnap = await db.collection('appointments').get();
  let apptCount = 0;
  for (const docSnap of apptsSnap.docs) {
    const data = docSnap.data();
    if (!data.org_id) {
      await docSnap.ref.update({ org_id: defaultOrgId });
      apptCount++;
    }
  }
  console.log(`Successfully migrated ${apptCount} appointments to default_org.`);
  
  console.log('Migration completed successfully.');
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
