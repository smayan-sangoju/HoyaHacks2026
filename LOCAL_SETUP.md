# Local Setup & Testing Guide

## Prerequisites
- Node.js installed
- MongoDB Atlas account (or local MongoDB running)
- npm or yarn package manager

## Quick Start (2 Steps)

### Step 1: Start the Backend (Port 4000)
```bash
cd backend
npm start
```

You should see:
```
Seeded trash can: TC001 - Outside Trash Can
Connected to MongoDB
Server listening on port 4000
```

### Step 2: Start the Frontend (Port 3001)
In a new terminal:
```bash
cd public
PORT=3001 npm start
```

You should see:
```
Frontend running on http://127.0.0.1:3001
```

## Access the App
Open your browser and go to: **http://localhost:3001**

## Testing the QR Code Feature

### To test with your trash can (TC001):

1. **Manual Test via API**:
   ```bash
   # Get trash can details
   curl http://localhost:4000/api/trash-cans/TC001
   
   # Get QR code
   curl http://localhost:4000/api/qr?canId=TC001 -o qr.png
   ```

2. **In the App**:
   - Go to **Admin** tab
   - You should see TC001 listed with "Outside Trash Can" label
   - Click **Download QR** to get the QR code
   - When you scan it, the modal should show:
     - ✅ Your image
     - ✅ "Outside Trash Can" (label)
     - ✅ "Smayans house" (location)

## Troubleshooting

### MongoDB Connection Error
If you see `ECONNREFUSED` error:
- Make sure MongoDB Atlas is accessible from your network
- Or use local MongoDB: Change `MONGO_URI` in `.env` to `mongodb://localhost:27017/clearcycle`

### Port Already in Use
```bash
# Kill process on port 4000
lsof -i :4000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Kill process on port 3001
lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Frontend shows old data
1. Hard refresh browser: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)
2. Clear localStorage: Open DevTools → Application → Local Storage → Clear all

## File Structure

```
/backend
├── server.js                 # Main API server
├── models/TrashCan.js       # MongoDB model
├── trash-cans/              # Trash can database
│   ├── trash-cans.json      # Master data
│   └── images/TC001-*.png   # Your photo
└── .env                      # Config (MONGO_URI, PORT, etc)

/public
├── index.html               # Frontend (with QR scanning)
├── server.js                # Frontend server
└── node_modules/            # Dependencies
```

## Next Steps

### Add More Trash Cans
1. Edit `backend/trash-cans/trash-cans.json`
2. Add image to `backend/trash-cans/images/`
3. Restart backend

### Deploy
- Backend: Deploy to Railway, Heroku, or AWS
- Frontend: Deploy to Vercel or Netlify
- Make sure `FRONTEND_BASE_URL` in backend `.env` points to your deployed frontend

## API Endpoints

### Trash Cans
```
GET  /api/trash-cans              # List all
GET  /api/trash-cans/:canId       # Get specific
POST /api/trash-cans              # Create new
GET  /api/qr?canId=TC001          # Generate QR code
```

### Scanning
```
POST /api/recycle/session/start                 # Begin scan session
POST /api/recycle/session/:sessionId/product    # Scan product barcode
POST /api/recycle/session/:sessionId/bin        # Scan bin QR
POST /api/recycle/session/:sessionId/video      # Upload proof video
```

## Support
Check the backend logs for detailed error messages:
```bash
# Watch logs in real-time
tail -f /path/to/nohup.out
```
