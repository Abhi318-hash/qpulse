import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const isClient = typeof window !== 'undefined';

export async function requestPushPermission(): Promise<string | null> {
  if (!isClient) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted:', permission);
      return null;
    }

    const messaging = getMessaging();
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.error('NEXT_PUBLIC_FIREBASE_VAPID_KEY is not defined in environment variables.');
      return null;
    }

    const token = await getToken(messaging, { vapidKey });
    return token;
  } catch (error) {
    console.error('An error occurred while retrieving token:', error);
    return null;
  }
}

export function onMessageListener() {
  if (!isClient) return new Promise(() => {});

  try {
    const messaging = getMessaging();
    return new Promise((resolve) => {
      onMessage(messaging, (payload) => {
        resolve(payload);
      });
    });
  } catch (error) {
    console.error('Error initializing message listener:', error);
    return new Promise(() => {});
  }
}
