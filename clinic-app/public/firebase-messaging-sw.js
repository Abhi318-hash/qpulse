importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyB-3gOeESdj3UzYOtTtZ0ddiJu5EhC6nbk",
  authDomain: "q-pluse.firebaseapp.com",
  projectId: "q-pluse",
  storageBucket: "q-pluse.firebasestorage.app",
  messagingSenderId: "723226852000",
  appId: "1:723226852000:web:90e4687d36180f6e7b27c5",
  measurementId: "G-DNB42L3R0C"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'Clinic Update';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new update.',
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
