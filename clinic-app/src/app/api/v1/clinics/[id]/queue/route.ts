import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clinicId } = await params;
    const apiKey = req.headers.get('x-api-key') || req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!apiKey) {
      return NextResponse.json({ error: 'Unauthorized: Missing API Key' }, { status: 401 });
    }

    // 1. Resolve Organization by API Key
    const orgsQuery = query(collection(db, 'organizations'), where('api_key', '==', apiKey));
    const orgsSnap = await getDocs(orgsQuery);

    if (orgsSnap.empty) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    const orgDoc = orgsSnap.docs[0];
    const orgData = orgDoc.data();

    // 2. Validate billing status and API access permissions
    if (orgData.billing_status === 'suspended') {
      return NextResponse.json({ error: 'Payment Required: Organization workspace suspended' }, { status: 402 });
    }

    if (orgData.plan !== 'pro' && orgData.plan !== 'enterprise') {
      return NextResponse.json({ error: 'Forbidden: API access requires a PRO or ENTERPRISE subscription' }, { status: 403 });
    }

    // 3. Resolve Clinic and ensure it belongs to this Organization
    const clinicRef = doc(db, 'clinics', clinicId);
    const clinicSnap = await getDoc(clinicRef);

    if (!clinicSnap.exists()) {
      return NextResponse.json({ error: 'Not Found: Clinic not found' }, { status: 404 });
    }

    const clinicData = clinicSnap.data();
    if (clinicData.org_id !== orgDoc.id) {
      return NextResponse.json({ error: 'Forbidden: Clinic does not belong to your organization' }, { status: 403 });
    }

    // 4. Query Roster of WAITING and IN_PROGRESS appointments for this clinic
    const apptsQuery = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('status', 'in', ['WAITING', 'IN_PROGRESS']),
      orderBy('token_number', 'asc')
    );
    const apptsSnap = await getDocs(apptsQuery);

    const roster = apptsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        patient_name: data.patient_name,
        age: data.age,
        user_phone: data.user_phone ? `${data.user_phone.slice(0, 6)}****` : 'Walk-in', // Mask for privacy
        disease: data.disease,
        token_number: data.token_number,
        status: data.status,
        queued_at: data.queued_at?.toDate() || null,
      };
    });

    return NextResponse.json({
      clinic: {
        id: clinicSnap.id,
        name: clinicData.name,
        doctor_name: clinicData.doctor_name,
        specialization: clinicData.specialization,
        is_open: clinicData.is_open,
        patient_count: clinicData.patient_count,
        last_issued_token: clinicData.last_issued_token,
        currently_serving_token: clinicData.currently_serving_token,
      },
      queue_length: roster.length,
      roster,
    });
  } catch (err: any) {
    console.error('API Error in GET /api/v1/clinics/[id]/queue:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
  }
}
