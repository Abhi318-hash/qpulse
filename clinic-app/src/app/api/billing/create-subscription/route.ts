import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { plan, orgId } = await req.json();
    
    // MOCK MODE FALLBACK: If Razorpay keys are not set, allow the developer to test billing immediately
    if (!process.env.RAZORPAY_KEY_ID) {
      console.warn('RAZORPAY_KEY_ID is missing. Defaulting to Q-PULSE MOCK Billing Engine.');
      return NextResponse.json({ 
        subscription_id: `sub_mock_${Math.random().toString(36).substring(2, 10)}`,
        isMock: true
      });
    }

    // Dynamic require to prevent loading issues if keys are not present
    const Razorpay = require('razorpay');
    const razorpay = new Razorpay({ 
      key_id: process.env.RAZORPAY_KEY_ID!, 
      key_secret: process.env.RAZORPAY_KEY_SECRET! 
    });

    const planIds = { 
      basic: process.env.RAZORPAY_PLAN_BASIC || 'plan_basic_mock', 
      pro: process.env.RAZORPAY_PLAN_PRO || 'plan_pro_mock',
      enterprise: process.env.RAZORPAY_PLAN_ENT || 'plan_ent_mock'
    };
    
    const targetPlanId = planIds[plan as keyof typeof planIds];
    if (!targetPlanId) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: targetPlanId,
      customer_notify: 1, 
      total_count: 12,
      notes: { orgId }
    });

    return NextResponse.json({ subscription_id: subscription.id, isMock: false });
  } catch (error: any) {
    console.error('Razorpay Subscription API error:', error);
    return NextResponse.json({ error: error.message || 'Subscription generation failed' }, { status: 500 });
  }
}
