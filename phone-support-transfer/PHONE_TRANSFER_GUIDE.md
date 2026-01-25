# Phone support – transfer to another device

Use this to add **phone + HTTPS + camera** support to your updated codebase on another device.

---

## Quick copy (same project layout)

From **this** repo, copy these into the **other** project (same paths):

```
scripts/gen-cert.sh      →  scripts/gen-cert.sh
start-https.sh           →  start-https.sh  (project root)
```

Then merge the **phone-related** parts of:

```
backend/server.js        →  backend/server.js
public/index.html        →  public/index.html  (or your main app)
package.json             →  package.json       (add "start-https" script)
.gitignore               →  .gitignore         (add backend/.cert/)
```

**One-liner** to create a zip of just those files (run from this repo root):

```bash
zip -r phone-support.zip scripts/gen-cert.sh start-https.sh backend/server.js public/index.html package.json .gitignore PHONE_TRANSFER_GUIDE.md
```

Copy `phone-support.zip` to the other device, unzip, then **merge** `server.js` and `index.html` with your updated versions (don’t overwrite blindly — use the sections below).

---

## 1. Files to add or copy as‑is

Copy these **entire files** into the same paths in your other project:

| File | Purpose |
|------|---------|
| `scripts/gen-cert.sh` | Generates self‑signed HTTPS cert (localhost + LAN IP) |
| `start-https.sh` | Starts single server (API + frontend) on HTTPS :3000 |

- Create `scripts/` if missing, then add `gen-cert.sh`.
- Put `start-https.sh` in the **project root** (next to `start.sh`).
- Run: `chmod +x scripts/gen-cert.sh start-https.sh`

---

## 2. Root `package.json`

Add the `start-https` script:

```json
"scripts": {
  "start": "./start.sh",
  "start-https": "./start-https.sh"
}
```

---

## 3. Backend (`backend/server.js`)

### 3.1 Env + frontend serving

- **`SERVE_FRONTEND`**  
  When `USE_HTTPS=1` (or `SERVE_FRONTEND=1`), backend also serves the frontend.

- **`PUBLIC_DIR`**  
  Path to frontend (e.g. `path.join(__dirname, '..', 'public')`).

- **`GET /`**  
  If `SERVE_FRONTEND`: serve `index.html` from `PUBLIC_DIR`. Else keep your existing JSON response.

- **Static + SPA fallback** (only when `SERVE_FRONTEND`):

  ```js
  app.use(express.static(PUBLIC_DIR))
  app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')))
  ```

  Add these **after** all `/api` and `/uploads` routes.

- **Global error handler** (always JSON, never HTML):

  ```js
  app.use((err, req, res, next) => {
    if (!res.headersSent)
      res.status(500).setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ error: 'Server error', details: err.message }))
  })
  ```

### 3.2 HTTPS + port

- When `USE_HTTPS=1` **and** `SERVE_FRONTEND`: listen on **3000** (or `FRONTEND_PORT`).
- Use `https.createServer({ key, cert }, app)` with certs from `backend/.cert/` (created by `gen-cert.sh`).
- Run `startServer()` **immediately**; do **not** block `listen` on DB seed (run seed in background).

### 3.3 `/api/network`

- Add `getLanIp()` (from `os.networkInterfaces()`, pick first IPv4 non‑internal).
- `GET /api/network` returns:

  ```js
  { phoneUrl: ip ? `${protocol}://${ip}:${port}` : null }
  ```

  Use `https` when `USE_HTTPS=1`, else `http`. `port` = 3000 (or your frontend port).

### 3.4 MongoDB‑optional behavior (so phone works without DB)

- **Session start** (`POST /api/recycle/session/start`): wrap `User.findOne` / `User.create` in `try/catch`. On DB error, use `userId: 'offline-demo'` and still create the in‑memory session.
- **Product lookup** (`GET /api/product`): wrap `Product.findOne` in `try/catch`; on error skip local DB and use OpenFoodFacts / UPCItemDB.
- **Video upload** (`POST .../video`): wrap cooldown/dup checks and `RecycleEvent`/`User` updates in `try/catch`. On error, set `mongoOk = false`, still run verification, return same JSON shape (and e.g. `mongoUnavailable: true`). Skip `User` update when `userId === 'offline-demo'`.

### 3.5 Certs and `.gitignore`

- Cert output: `backend/.cert/key.pem`, `backend/.cert/cert.pem`.
- Add `backend/.cert/` to `.gitignore`.

---

## 4. Frontend (`public/index.html` or your main app file)

### 4.1 API base

- When using the **single‑server** setup (backend serves frontend on :3000):  
  `const API = ''`  
  so all `/api` requests are same‑origin.

### 4.2 `safeJson` helper

- `async function safeJson(res)`:
  - `const text = await res.text()`
  - `try { return JSON.parse(text) } catch (e) { throw new Error('Server returned invalid response...') }`
- Use `safeJson(res)` instead of `res.json()` for:
  - Session start, product confirm, trash‑can confirm, video upload response, product lookup fetch.

### 4.3 Camera (scan + record)

- **Check** `navigator.mediaDevices && navigator.mediaDevices.getUserMedia` before starting camera. If missing, show a clear message: camera requires **HTTPS** on phone.
- **Rear camera**: `getUserMedia({ video: { facingMode: 'environment' }, audio: false })`. Fallback to `{ video: true }` if that fails.
- Use **your own** `getUserMedia` stream, then:
  - For **ZXing**: use `decodeFromStream(stream, videoElement, callback)` instead of `decodeFromVideoDevice`.
- Use the same rear‑camera logic for the **video recording** modal.
- **Cleanup**: stop tracks and reset reader when leaving the scan tab or starting a new scan.

### 4.4 Mobile‑friendly HTML

- Viewport:  
  `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />`
- Optional: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `mobile-web-app-capable`.

### 4.5 Error messages

- For network‑style or parse errors (e.g. “Load failed”, “invalid response”, “Backend unavailable”), add a short hint:  
  `Run from project root: npm run start-https. Ensure "npm install" was run in ./public` (if you use a separate frontend) or similar.

---

## 5. Optional: “Open on your phone” tip

- **Backend**: `GET /api/network` (see above).
- **Frontend**: e.g. on Scan tab, when on desktop, fetch `/api/network` and show a link like “Open on your phone” with `phoneUrl` (only if `phoneUrl` is present).

---

## 6. How to run with phone support

1. From **project root**:  
   `npm run start-https`
2. **Desktop**: `https://localhost:3000`  
   **Phone** (same Wi‑Fi): `https://<your‑ip>:3000` — accept the self‑signed cert once.
3. Camera (scan + record) works over HTTPS; use rear camera when available.

---

## 7. Minimal checklist

- [ ] `scripts/gen-cert.sh` and `start-https.sh` added and executable
- [ ] `package.json` has `"start-https": "./start-https.sh"`
- [ ] Backend: `SERVE_FRONTEND`, `PUBLIC_DIR`, serve `index.html` for `/` and `*`, HTTPS on :3000 when `USE_HTTPS=1`
- [ ] Backend: `GET /api/network` with `phoneUrl`; global JSON error handler
- [ ] Backend: server starts **before** DB seed; Mongo‑optional session/product/video logic
- [ ] Frontend: `API = ''` when same‑origin; `safeJson` for all relevant fetches
- [ ] Frontend: `mediaDevices` check, `facingMode: 'environment'`, `decodeFromStream`, same for record flow
- [ ] Frontend: viewport/mobile meta tags; clearer error messages for HTTPS/backend
- [ ] `backend/.cert/` in `.gitignore`

---

## 8. Reference: key files in this repo

- `scripts/gen-cert.sh` – cert generation
- `start-https.sh` – HTTPS single‑server startup
- `backend/server.js` – SERVE_FRONTEND, `/api/network`, static, HTTPS, Mongo‑optional logic
- `public/index.html` – `API`, `safeJson`, camera, viewport, errors

Use diff/merge against your updated project to apply only the phone‑related parts.
