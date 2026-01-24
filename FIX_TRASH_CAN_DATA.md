# Fix: Trash Can Shows "Unknown Location"

## Problem
The QR code shows "Unknown Location" instead of "Smayans house" because the trash can data wasn't seeded to MongoDB.

## Root Cause
MongoDB Atlas couldn't connect when the backend started, so `ensureTrashCans()` never populated the database.

## Solution - 2 Options

### Option 1: Manual Seed (Recommended - 3 steps)

**Step 1:** Make sure your backend is running
```bash
cd backend
npm start
```

**Step 2:** In a NEW terminal, run the seed script
```bash
cd backend
node seed-quick.js
```

You should see:
```
🔄 Connecting to MongoDB...
✅ Connected!
✨ Created: TC001 - Outside Trash Can

✅ Seeding complete!
```

**Step 3:** Refresh your frontend in the browser
- Hard refresh: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)
- Try scanning the QR code again

---

### Option 2: Direct API Call

If you're technical, you can also create the trash can directly via API:

```bash
curl -X POST http://localhost:4000/api/trash-cans \
  -H "Content-Type: application/json" \
  -d '{
    "id": "TC001",
    "label": "Outside Trash Can",
    "location": "Smayans house",
    "image": "/uploads/outside-trash-can.png"
  }'
```

---

## Verify It Works

After seeding, test with:

```bash
# Should return your trash can data
curl http://localhost:4000/api/trash-cans/TC001
```

Expected output:
```json
{
  "can": {
    "_id": "...",
    "id": "TC001",
    "label": "Outside Trash Can",
    "location": "Smayans house",
    "image": "/uploads/outside-trash-can.png",
    "createdAt": "2026-01-24T..."
  }
}
```

---

## What Should Happen Next

When you scan TC001 QR code, the modal should show:
- ✅ Title: **"Outside Trash Can"**
- ✅ Text: **"Smayans house"**
- ✅ Meta info: **"Location: Smayans house"**
- ✅ Your photo (if image uploaded correctly)

---

## Still Not Working?

Check your backend logs for errors:
```bash
# Look for "Seeded trash can" or error messages
grep -i "trash" /path/to/backend/output.log
```

Common issues:
1. **MongoDB still can't connect** → Check your `.env` MONGO_URI
2. **Image path wrong** → Make sure `/uploads/outside-trash-can.png` exists
3. **Old data cached** → Do a hard refresh and clear localStorage:
   - Open DevTools (F12)
   - Application → Local Storage → Delete `cc_points`
   - Then refresh

---

## Automatic Seeding (Future)

The backend now automatically seeds trash cans on startup IF:
1. MongoDB connects successfully
2. `trash-cans.json` exists
3. Trash cans don't already exist in DB

So next time you restart, if MongoDB works, seeding will happen automatically!
