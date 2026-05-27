import { NextResponse } from 'next/server';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || '';

    // Verify cryptographic webhook signature if a secret is provided
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
        
      if (expectedSignature !== signature) {
        console.error('Cryptographic Verification Failed for Webhook');
        return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
      }
    }

    const event = JSON.parse(rawBody);
    const subscription = event.payload?.subscription?.entity;
    
    if (!subscription) {
      return NextResponse.json({ status: 'ignored', reason: 'No subscription payload found' });
    }

    const subscriptionId = subscription.id;
    const orgId = subscription.notes?.orgId;

    if (!orgId) {
      console.warn('Webhook received without orgId notes:', subscriptionId);
      return NextResponse.json({ error: 'No orgId metadata in subscription' }, { status: 400 });
    }

    const orgRef = doc(db, 'organizations', orgId);

    // Process different Razorpay billing statuses
    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged':
        await updateDoc(orgRef, {
          billing_status: 'active',
          razorpay_subscription_id: subscriptionId,
          billing_cycle_end: new Date(subscription.current_end * 1000), // convert Epoch to Date
          updated_at: serverTimestamp()
        });
        console.log(`Organization ${orgId} subscription activated/charged: ${subscriptionId}`);
        break;
        
      case 'subscription.cancelled':
        await updateDoc(orgRef, {
          billing_status: 'cancelled',
          updated_at: serverTimestamp()
        });
        console.log(`Organization ${orgId} subscription cancelled: ${subscriptionId}`);
        break;
        
      case 'subscription.pending':
      case 'subscription.halted':
        await updateDoc(orgRef, {
          billing_status: 'suspended',
          updated_at: serverTimestamp()
        });
        console.warn(`Organization ${orgId} subscription suspended: ${subscriptionId}`);
        break;
        
      default:
        console.log('Unmapped Webhook Event Type:', event.event);
    }

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error('Razorpay Webhook handler error:', error);
    return NextResponse.json({ error: error.message || 'Webhook processing failed' }, { status: 500 });
  }
}
