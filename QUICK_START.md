# Quick Start Guide - All Platforms

## ⚡ 5-Minute Setup (Windows, Mac, Linux)

### Step 1: Install Prerequisites
Make sure you have these installed:
- **Node.js 18+** → https://nodejs.org/
- **Git** → https://git-scm.com/
- **MongoDB Atlas Account** → https://www.mongodb.com/cloud/atlas

### Step 2: Clone & Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd HoyaHacks

# Check if your system is compatible
cd backend
node check-compatibility.js
# Should show all ✅ checks pass

cd ..
```

### Step 3: Configure MongoDB
1. Go to MongoDB Atlas: https://www.mongodb.com/cloud/atlas
2. Get your connection string (looks like):
   ```
   mongodb+srv://username:password@cluster.mongodb.net/clearcycle
   ```
3. Create `.env` file in `/backend/`:
   ```bash
   # Windows (PowerShell)
   echo "MONGO_URI=your_connection_string_here" > backend\.env
   echo "PORT=4000" >> backend\.env
   
   # Mac/Linux
   echo "MONGO_URI=your_connection_string_here" > backend/.env
   echo "PORT=4000" >> backend/.env
   ```

### Step 4: Start Backend
```bash
cd backend
npm install
npm start
```
You should see:
```
✅ Connected to MongoDB
✨ Seeded trash can: TC001 - Outside Trash Can
Server listening on port 4000
```

### Step 5: Start Frontend (New Terminal)
```bash
cd public
npm install
npm start
```
You should see:
```
Frontend running on http://127.0.0.1:3000
```

### Step 6: Open in Browser
Go to: **http://localhost:3000**

---

## 🎯 What Should Work

- ✅ Home page loads
- ✅ Scan tab with camera
- ✅ QR code scanning
- ✅ Product lookup
- ✅ Admin section with trash cans

---

## 🔍 Testing QR Code

1. Go to **Admin** tab
2. See **TC001** listed ("Outside Trash Can")
3. Click **"Download QR"** to get the QR code
4. Scan it back with the app
5. Should show:
   - "Outside Trash Can"
   - "Smayans house"
   - Your photo

---

## ❓ Troubleshooting

### "npm: command not found"
→ Install Node.js from https://nodejs.org/

### "MONGO_URI is not set"
→ Create `.env` file in `/backend/` with your MongoDB connection string

### "Port 4000 already in use"
**Windows:**
```powershell
# Find process
netstat -ano | findstr :4000
# Kill it (replace PID)
taskkill /PID <PID> /F
```

**Mac/Linux:**
```bash
lsof -i :4000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### "Camera not working"
- Check browser permissions (camera access)
- Try in a different browser
- Restart the app
- Run the camera test in console (F12):
```javascript
navigator.mediaDevices.getUserMedia({ video: true })
  .then(s => { console.log('✅ Camera works!'); s.getTracks().forEach(t => t.stop()); })
  .catch(e => console.error('❌', e));
```

### "Still having issues?"
Check the detailed guides:
- `CROSS_PLATFORM_GUIDE.md` - Full platform-specific guide
- `LOCAL_SETUP.md` - Advanced setup options
- `FIX_TRASH_CAN_DATA.md` - Trash can data issues

---

## 🚀 Next Steps

### Add More Trash Cans
Edit `backend/trash-cans/trash-cans.json`:
```json
{
  "id": "TC002",
  "label": "Main Recycling Bin",
  "location": "Building A, Floor 2",
  "image": "/uploads/TC002.png"
}
```

Then restart backend.

### Deploy to Production
See `DEPLOYMENT.md` for deploying to:
- Railway (easiest)
- Heroku
- AWS
- Google Cloud

### Enable Vision Verification
Get OpenRouter API key and add to `.env`:
```
OPENROUTER_API_KEY=your_key
OPENROUTER_MODEL=openai/gpt-4o-mini
```

---

## 📱 Mobile Testing

### On Same Wifi
```bash
# Get your computer's IP
ipconfig getifaddr en0  # Mac
ipconfig             # Windows
hostname -I         # Linux

# Open on phone
http://your_ip:3000
```

### On Different Network
Deploy to Railway/Heroku and open the URL on your phone.

---

## 🎓 Architecture Overview

```
HoyaHacks/
├── backend/              (Node.js + Express + MongoDB)
│   ├── server.js        (Main API)
│   ├── models/          (Database models)
│   ├── trash-cans/      (Trash can config)
│   └── .env             (Secrets)
│
└── public/              (Frontend - HTML + JS)
    ├── index.html       (React-like vanilla JS)
    └── server.js        (Local dev server)
```

---

## 📞 Support

- **Windows Issues?** → Check CROSS_PLATFORM_GUIDE.md section on Windows
- **Camera Issues?** → Use the camera test above
- **MongoDB Issues?** → Check MongoDB Atlas dashboard

---

## ✨ You're Done!

Your ClearCycle app is now running and ready to use on any system! 🎉
