**https://qpluse.vercel.app/**

**https://youtu.be/ttI4K9mtY8Y?si=O4K68aaJW51Y0je5**

**https://wooble.org/in/abhishekpatil9021193dfc/projects/e26a51b5-3075-42bf-9e6d-1dfb3d59b278?ref=copy**

## What this is
Q-PULSE is a TypeScript Next.js clinic patient queue tracker that lets patients check real-time wait lengths before they arrive and lets clinics manage queues. The frontend is a Next.js (App Router) TypeScript React app and the backend uses Firebase (Firestore + Cloud Functions + FCM) for realtime data, rules, and server-side logic.

### Stack
- **Language(s):** TypeScript (primary), small JS/CSS
- **Framework / runtime:** Next.js (App Router) + React; Firebase (Firestore, Cloud Functions, FCM)
- **Notable libraries / systems that shape the code:** Next.js (App Router), React/TSX components, Firebase SDK (client-side + admin/functions), Firestore security rules & indexes, server-side functions (TypeScript)

## How it's organized
Top-level important entries (annotated):
```
README.md                  repo overview and usage
.gitignore
clinic-app/                main Next.js + Firebase application
  .firebaserc              firebase project mapping
  firebase.json            Firebase hosting / functions config
  firestore.rules          Firestore security rules
  firestore.indexes.json   Firestore indexes
  next.config.ts
  package.json
  tsconfig.json
  public/                  static assets
  src/
    app/                   Next.js App Router routes & pages (page.tsx, layout.tsx, globals.css)
      about/ admin/ clinic/ consult/ login/ onboard/ org/ profile/ super-admin/ etc.
      page.tsx
      error.tsx
    components/            shared UI (TopNav, PhoneAuth, LanguageSelector, DoctorAvatar, telemetry)
    lib/                   app logic & integrations (firebase.ts, fcm.ts, actions.ts, patientActions.ts, generatePrescriptionPDF.ts)
  functions/               Firebase Cloud Functions (TypeScript, src/index.ts)
```

How it fits together:
- The Next.js app under clinic-app/src is the public UI (patients, admins, clinics). UI components call functions in src/lib to interact with Firestore and Firebase services.
- clinic-app/src/lib contains the client-side Firebase setup, patient/admin action logic, and utilities (including PDF generation and telemetry).
- clinic-app/functions contains server-side TypeScript functions (Firebase Functions) for tasks that require privileged access or background processing (deployed with Firebase).
- Firestore rules and indexes live at the repo root of clinic-app to enforce security and optimize queries; firebase.json/.firebaserc configure hosting and functions.

## How to run it
Shortest path (local dev, assuming you have Node.js, npm, and Firebase tools installed):

1. Frontend (Next.js app)
```
git clone https://github.com/Abhi318-hash/qpulse.git
cd qpulse/clinic-app
npm install
npm run dev
# opens at http://localhost:3000 by default (Next.js)
```

2. Functions (Firebase Cloud Functions)
```
cd clinic-app/functions
npm install
# build if there's a TypeScript build step (e.g. npm run build)
# run locally with the Firebase emulator:
firebase emulators:start --only functions,firestore,hosting
# or deploy:
firebase deploy --only functions,hosting,firestore
```

Required / recommended environment and credentials (obvious from repo layout):
- Firebase project configuration (API keys / authDomain / projectId) for clinic-app/src/lib/firebase.ts.
- Service account / Firebase credentials for deploying or running admin Cloud Functions.
- FCM credentials for push notifications (used by fcm.ts).
- Any environment variables referenced in package.json or next.config.ts (check those files before running).
