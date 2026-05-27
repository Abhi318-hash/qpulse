import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(req: NextRequest) {
  try {
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

    // Enforce Pro/Enterprise plan for API access
    if (orgData.plan !== 'pro' && orgData.plan !== 'enterprise') {
      return NextResponse.json({ error: 'Forbidden: API access requires a PRO or ENTERPRISE subscription' }, { status: 403 });
    }

    // 3. Query clinics for this organization
    const clinicsQuery = query(collection(db, 'clinics'), where('org_id', '==', orgDoc.id));
    const clinicsSnap = await getDocs(clinicsQuery);

    const clinics = clinicsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        doctor_name: data.doctor_name,
        dr_degree: data.dr_degree,
        specialization: data.specialization,
        location: data.location,
        fees: data.fees,
        is_open: data.is_open,
        is_hidden: data.is_hidden,
        patient_count: data.patient_count,
        last_issued_token: data.last_issued_token,
        currently_serving_token: data.currently_serving_token,
        operating_hours: data.operating_hours || '',
        phone_number: data.phone_number || '',
      };
    });

    return NextResponse.json({ organization: orgData.name, clinics });
  } catch (err: any) {
    console.error('API Error in GET /api/v1/clinics:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
  }
}
