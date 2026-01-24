# MongoDB Manual Setup - Add Trash Can Data

Since the automated seeding can't connect from this environment, here's how to manually add your trash can to MongoDB Atlas.

## Step 1: Open MongoDB Atlas Dashboard

1. Go to: https://account.mongodb.com/account/login
2. Log in with your credentials
3. Click on your **CycleAnna** cluster
4. Click **Browse Collections** or **Collections** tab

## Step 2: Navigate to Your Database

1. Look for database named: **clearcycle**
2. If it doesn't exist, create it:
   - Click **+ Create Database**
   - Name: `clearcycle`
   - Collection name: `trashcans`

3. Click on the **trashcans** collection

## Step 3: Insert Your Trash Can Document

In the MongoDB dashboard, click **Insert Document** (or **+** button).

Paste this JSON exactly:

```json
{
  "id": "TC001",
  "label": "Outside Trash Can",
  "location": "Smayans house",
  "image": "/uploads/outside-trash-can.png",
  "description": "Main outdoor trash can",
  "createdAt": {
    "$date": "2026-01-24T10:31:32Z"
  }
}
```

Then click **Insert**.

## Step 4: Verify It's There

1. Back in the **trashcans** collection, you should see 1 document
2. Click on it to view - confirm it shows:
   - `"id": "TC001"`
   - `"label": "Outside Trash Can"`
   - `"location": "Smayans house"`

## Step 5: Test in Your App

1. Make sure your backend is running: `npm start` in `/backend`
2. Refresh your frontend in browser
3. Go to **Admin** tab - you should see TC001 listed!
4. Scan the QR code again - it should now show:
   - ✅ "Outside Trash Can"
   - ✅ "Smayans house"
   - ✅ Your photo

---

## Alternative: Direct JavaScript Insert

If you have MongoDB shell access, you can also run:

```javascript
db.trashcans.insertOne({
  "id": "TC001",
  "label": "Outside Trash Can",
  "location": "Smayans house",
  "image": "/uploads/outside-trash-can.png",
  "description": "Main outdoor trash can",
  "createdAt": new Date("2026-01-24T10:31:32Z")
})
```

---

## Visual Guide

```
MongoDB Atlas Dashboard
└── CycleAnna (Cluster)
    └── clearcycle (Database)
        └── trashcans (Collection)
            └── [Your document with TC001]
```

---

## Troubleshooting

### Document not showing in app?
1. Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Make sure backend is running
3. Check browser console (F12) for errors

### Can't find your cluster?
1. You might be in the wrong MongoDB project
2. Click "Organization" dropdown in MongoDB Atlas
3. Make sure you're in the right one

### Still not working?
Contact MongoDB support or check your `.env` file to ensure:
```
MONGO_URI=mongodb+srv://hoyahacks:Tamannah_Sreeleela5541@cycleanna.ksqdvhw.mongodb.net/clearcycle?retryWrites=true&w=majority&appName=CycleAnna
```

---

## Next: Add More Trash Cans

Once this works, you can add more trash cans the same way:

1. Click **Insert Document** again
2. Paste a similar document with different `id`, `label`, `location`
3. Example:
```json
{
  "id": "TC002",
  "label": "Main Recycling Bin",
  "location": "Building A, Floor 2",
  "image": "/uploads/TC002-recycling.png",
  "description": "Secondary recycling station",
  "createdAt": {
    "$date": "2026-01-24T10:31:32Z"
  }
}
```

Done! 🎉
