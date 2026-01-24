# ClearCycle - Scan & Redeem (Hackathon Demo)

This repository contains a full-stack hackathon project: ClearCycle - Scan & Redeem.
Students scan items they throw away and earn dining credits if the disposal is verified.

This demo includes:

- Backend: Node.js + Express + MongoDB (Mongoose)
- Frontend: Vanilla JS + ZXing barcode scanning
- **Near-perfect barcode recognition system**: DB → OpenFoodFacts → General Barcode API → Manual Add (with confidence scoring)
- Fake AI verification (80% pass rate) and anti-fraud duplicate detection (video hash)
- Mobile-first **live camera** flow: **product barcode → product verification → bin barcode → 2s video** with server-enforced ordering + optional OpenRouter vision verification
- Product caching: Barcode lookups saved to MongoDB for instant repeat scans

Quick start (requires Node 18+ and a running MongoDB at `mongodb://localhost:27017`):

1. Backend
   cd backend
   npm install
   cp .env.example .env # edit MONGO_URI if needed
   node server.js

2. Frontend
   cd public
   npm install
   node server.js

Open http://127.0.0.1:3000 in your browser.

Notes:

- The backend will auto-create a demo user (demo@clear.cycle) on startup.
- Videos are stored in `backend/uploads` and served statically.
- Product lookups are cached in the `products` MongoDB collection.

## Product Recognition Cascade (Near-Perfect Barcode Matching)

When you scan a barcode, the system uses a smart cascade to identify products:

1. **Local Cache First** — Check MongoDB `products` collection
2. **OpenFoodFacts** — If not found, query OpenFoodFacts API (best for groceries)
3. **General Barcode API** — Fallback to general UPC database (configurable)
4. **Manual Add** — If still not found, user can manually add the product

Each product is scored by confidence:
- **High** — product name + image available
- **Medium** — only product name
- **Low** — missing name or very short name

**Frontend Flow:**
- If found with high confidence → instant confirmation
- If found with medium/low confidence → user can verify yes/no or edit
- If not found → manual form to add product

**Backend Endpoints:**

- `GET /api/product?barcode=...` — Lookup with cascade + caching
- `POST /api/product` — Manual product add/update

## Live camera recycle flow (judges)

Flow:

Scan product barcode → verify product (or add manually) → scan bin barcode → record 2-second video → server verifies order + (optional) OpenRouter vision → points awarded.

Backend endpoints:

- `POST /api/recycle/session/start` `{ email }`
- `POST /api/recycle/session/:sessionId/product` `{ barcode }`
- `POST /api/recycle/session/:sessionId/bin` `{ barcode }`
- `POST /api/recycle/session/:sessionId/video` `multipart/form-data` with:
  - `video`: the recorded clip
  - `frames`: JSON string array of 2–3 `data:image/jpeg;base64,...` frame URLs

Environment:

- Set `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`) in `backend/.env` to enable vision verification.
- For object storage (Cloudflare R2 / S3-compatible), see `backend/.env.example` (`S3_*` vars). If unset, videos are served from `backend/uploads`.

## MongoDB Collections

- `users` — User profiles with points
- `disposalEvents` — Legacy image uploads (not used in new flow)
- `recycleEvents` — Video-based recycling events with AI verification
- `products` — Cached barcode → product mappings with confidence scoring
