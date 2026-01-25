# Phone support – drop-in transfer

Copy this folder to your **other device** (USB, cloud, etc.), then merge into your updated project.

---

## On the other device

### 1. Copy files into your project (same layout)

| From this folder        | Into your project      |
|-------------------------|-------------------------|
| `scripts/gen-cert.sh`   | `scripts/gen-cert.sh`   |
| `start-https.sh`        | project root            |
| `backend/server.js`     | `backend/server.js`     |
| `public/index.html`     | `public/index.html`     |
| `package.json`          | project root (merge scripts) |
| `.gitignore`            | project root (merge)    |

### 2. If your project has newer changes

**Don’t overwrite** `backend/server.js` or `public/index.html` blindly. Use **diff/merge**:

- Keep your updates.
- Add the **phone-related** parts (see `PHONE_TRANSFER_GUIDE.md`):
  - Backend: `SERVE_FRONTEND`, `/api/network`, static + catch-all, HTTPS on :3000, Mongo-optional logic.
  - Frontend: `API = ''`, `safeJson`, camera + `facingMode: 'environment'`, viewport/meta, error hints.

### 3. Make scripts executable

```bash
chmod +x scripts/gen-cert.sh start-https.sh
```

### 4. Add `start-https` to `package.json`

```json
"scripts": {
  "start": "./start.sh",
  "start-https": "./start-https.sh"
}
```

### 5. Run with phone support

```bash
npm run start-https
```

Then open **https://localhost:3000** (desktop) or **https://&lt;your-ip&gt;:3000** (phone, same Wi‑Fi, accept cert once).

---

See **`PHONE_TRANSFER_GUIDE.md`** for detailed merge steps and snippets.
