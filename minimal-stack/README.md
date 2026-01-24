# ClearCycle — Minimal Stack Prototype

This folder contains a minimal Next.js prototype implementing the hackathon flow:

- Frontend: Next.js page with camera access (getUserMedia), barcode scanning (ZXing), and a 2-second MediaRecorder capture.
- Backend: Next.js API routes (session management, verify endpoint) with simple rate-limiting, video hash checking, and an OpenRouter AI verification stub.
- Database: Mongoose models (optional MongoDB Atlas). For a quick demo an in-memory store is used.
- Storage: pluggable — default writes to local /tmp for dev; configure R2/Supabase/Vultr for production.

Setup

1. From this folder, install dependencies:

   cd minimal-stack
   npm install

2. Environment variables (create a `.env.local`):

   # OpenRouter key (vision-capable model)

   OPENROUTER_API_KEY=your_openrouter_key

   # MongoDB (optional)

   MONGODB_URI=mongodb+srv://.../clearcycle

   # Storage provider config (optional)

   STORAGE_PROVIDER=local

Development

npm run dev

Open `http://localhost:3000` and follow the 3-step flow: scan product barcode → scan bin barcode → press Scan to record 2s video and submit.

Notes & Security

- This is a prototype. Replace in-memory session stores and local storage with robust services for production.
- You must deploy over HTTPS for camera access (Vercel + deployed API, or host on a server with TLS).
- OpenRouter integration in `lib/ai.js` shows how to call the API — keep your key secret.
