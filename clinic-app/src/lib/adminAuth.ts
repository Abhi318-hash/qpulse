/**
 * adminAuth.ts
 * Server-side admin verification — reads from Firestore `admins` collection.
 * NEVER uses NEXT_PUBLIC_ env vars for security checks.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface AdminRecord {
  phone: string;
  uid?: string;
  name: string;
  role: 'super_admin' | 'org_admin';
  org_id?: string;
  is_active: boolean;
  added_by: string;
}

/**
 * Check if a phone number is a registered active admin.
 * Uses a Firestore read — result should be cached in component state.
 */
export async function checkIsAdmin(phone: string | null | undefined): Promise<boolean> {
  if (!phone) return false;
  try {
    const ref = doc(db, 'admins', phone);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as AdminRecord;
    return data.is_active === true;
  } catch {
    return false;
  }
}

/**
 * Get the full admin record for a phone number.
 * Returns null if not an admin or not active.
 */
export async function getAdminRecord(phone: string | null | undefined): Promise<AdminRecord | null> {
  if (!phone) return null;
  try {
    const ref = doc(db, 'admins', phone);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as AdminRecord;
    if (!data.is_active) return null;
    return data;
  } catch {
    return null;
  }
}
