🏥 Q-PULSE — Project Breakdown
What is it?
Q-PULSE is a live clinic patient queue tracker. Its tagline is "Skip the wait, stay in the pulse." It lets patients check how many people are currently waiting at a clinic before showing up — in real time.
________________________________________
👥 Who is it For? (3 User Roles)
Role	URL	Access
Public / Patient	/	View live queue counts for all clinics
Admin	/admin	Password-protected portal to manage clinics
Clinic Recipient	/clinic/[id]?secret=xxx	Secret-link terminal for clinic staff to update queues
________________________________________
🛠️ Tech Stack
Layer	Technology
Framework	Next.js 16 (App Router)

Language	TypeScript + React 19
Database (Cloud)	Turso — hosted LibSQL (SQLite-compatible)

Database (Local Dev)	better-sqlite3 → clinic.db file
DB Client	@libsql/client
Icons	lucide-react
Styling	Vanilla CSS with glassmorphism dark-mode design
Hosting	Vercel (environment vars in .env.local)
________________________________________
🔧 How the Backend Works
There is no separate backend server. Everything runs inside Next.js using Server Actions ('use server'), which are server-side functions callable directly from client components.
📁 File: src/lib/db.ts — Database Layer
TURSO_URL + TURSO_TOKEN  ──→  @libsql/client  ──→  Turso cloud DB
                     (falls back to local clinic.db if no env vars)
•	On startup, initDb() runs and creates the clinics table if it doesn't exist.
•	Uses non-destructive migrations — wraps ALTER TABLE in try/catch so re-runs don't crash.
Schema: clinics table
Column	Type	Purpose
id	TEXT (UUID)	Primary key
name	TEXT	Clinic display name
doctor_name	TEXT	Primary doctor (editable by recipient)
location	TEXT	Clinic location
is_open	BOOLEAN	Whether clinic is accepting patients
is_hidden	BOOLEAN	Soft-delete — hides from public view
patient_count	INTEGER	Live queue count
recipient_secret	TEXT	Short UUID used as access password
created_at	TIMESTAMP	Creation time
________________________________________
📁 File: src/lib/actions.ts — Backend Logic (Server Actions)
All backend functions live here, marked 'use server'. They run on the server, never exposed to the browser.
Admin Actions (no secret needed — just password check):
•	verifyAdminPassword(password) — compares against ADMIN_PASSWORD env var
•	addClinic(name, doctorName, location) — inserts new clinic, auto-generates a recipientSecret
•	hideClinic(id) / unhideClinic(id) — soft delete/restore
Recipient Actions (all require secret verification):
•	incrementPatient(id, secret) — adds 1 to queue
•	decrementPatient(id, secret) — subtracts 1 (floor = 0, never negative)
•	toggleClinicStatus(id, secret) — flips is_open 0↔1
•	updateDoctorName(id, secret, name) — lets clinic staff update their doc's name
Query Functions:
•	getClinics() — public view, filters is_hidden = 0
•	getClinicsAdmin() — admin view, returns ALL clinics including hidden
•	getClinic(id) — fetch a single clinic by ID
After every mutation, revalidatePath('/') and revalidatePath('/admin') are called to bust Next.js's cache and force a data refresh.
________________________________________
🗺️ Page Architecture
/                    → Public dashboard (polls every 10s, search by clinic/doctor/location)
/admin               → Admin portal (password gate → manage clinics, copy recipient links)
/clinic/[id]         → Recipient terminal (secret in URL query param → +/- queue, toggle open/closed)
________________________________________
🔐 Security Model
Concern	How it's handled
Admin access	Single shared password in ADMIN_PASSWORD env var
Recipient access	Per-clinic recipient_secret (short UUID), passed as ?secret= in URL
Data visibility	is_hidden flag separates public vs admin views at the DB query level
Patient count floor	MAX(0, patient_count - 1) in SQL prevents negatives
________________________________________
In summary: Q-PULSE is a full-stack Next.js app where the entire backend is a single actions.ts file of server actions connecting to a Turso cloud SQLite database, serving three distinct user roles with no separate API server needed.

