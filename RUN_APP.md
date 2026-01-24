# 🚀 Quick Start - Run ClearCycle

## ⚡ Fastest Way to Start (Recommended)

### **macOS / Linux**
```bash
cd /Users/akshathchity/HoyaHacks
./start.sh
```

### **Windows**
```bash
cd C:\path\to\HoyaHacks
start.bat
```

Both terminal windows will open automatically with:
- ✅ Backend running on http://localhost:4000
- ✅ Frontend running on http://localhost:3000

---

## 🎯 Manual Way (if script doesn't work)

### **Terminal 1: Backend**
```bash
cd /Users/akshathchity/HoyaHacks/backend
npm start
```

Wait for message:
```
Server listening on port 4000
```

### **Terminal 2: Frontend**
```bash
cd /Users/akshathchity/HoyaHacks/public
npm start
```

Wait for message:
```
Frontend running on http://127.0.0.1:3000
```

### **Terminal 3: Test (Optional)**
```bash
curl http://localhost:4000/api/health
```

Should return: `{"ok":true}`

---

## 🌐 Open in Browser

Go to: **http://localhost:3000**

---

## 🧪 Test Credentials

### **Student Account**
```
Email:    student@test.com
Password: Student123!
```

### **Admin Account** (create in MongoDB first)
```
Email:    admin@test.com
Password: Admin@2024!
```

---

## ⚠️ Troubleshooting

### "404 Not Found" Error
**Problem:** Frontend can't reach backend
**Solution:** Make sure both servers are running on YOUR machine, not in Cursor sandbox

### "Port already in use"
```bash
# Kill processes
pkill -f "npm start"

# Or on Windows:
taskkill /F /IM node.exe
```

### "MongoDB connection error"
This is OK! The app works with or without MongoDB connected.

---

## 🛑 Stop Servers

**macOS/Linux:**
```bash
pkill -f "npm start"
```

**Windows:**
- Close the terminal windows, or
- Press `Ctrl+C` in each terminal

---

## ✨ Next Steps

1. Run the startup script (./start.sh or start.bat)
2. Open http://localhost:3000
3. Click 👤 button → Register
4. Use test credentials above
5. Start testing! 🎉

---

## 📚 Full Documentation

- `AUTHENTICATION_GUIDE.md` - Authentication features
- `QUICK_START.md` - Setup guide
- `START_HERE.txt` - Project overview

Enjoy! 🚀
