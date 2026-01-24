# 🔧 Debugging Guide - 404 Error Fix

## The Problem
You're getting "Error: 404 Not Found" when trying to register, which means the frontend CAN'T reach the backend.

## ✅ Fixed Issues

I've updated both frontend and backend to:
1. ✅ Better CORS configuration (allow all origins)
2. ✅ Health check endpoint at `/api/health`
3. ✅ Detailed error messages in frontend
4. ✅ Console logging for debugging
5. ✅ Better API URL detection

---

## 🔍 How to Verify Everything Works

### Step 1: Start Backend ONLY
```bash
cd /Users/akshathchity/HoyaHacks/backend
npm start
```

Wait for:
```
Server listening on port 4000
```

### Step 2: Test Backend (in another terminal)
```bash
curl http://localhost:4000/api/health
```

**Should return:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-24T...",
  "backend": "running"
}
```

### Step 3: Start Frontend
```bash
cd /Users/akshathchity/HoyaHacks/public
npm start
```

Wait for:
```
Frontend running on http://127.0.0.1:3000
```

### Step 4: Check Browser Console
1. Open http://localhost:3000
2. Press F12 (Developer Tools)
3. Go to Console tab
4. Should see:
```
API URL: http://localhost:4000
```

### Step 5: Try Registering
1. Click 👤 button
2. Click Register
3. Fill in form with:
   - Name: `Test User`
   - Email: `test@test.com`
   - Password: `Test@123`
4. Watch console (F12) for logs

---

## 🐛 Debugging Checklist

### If you see "Error: 404 Not Found":

**Check 1: Is Backend Running?**
```bash
curl http://localhost:4000/
```
Should return: `{"message":"ClearCycle Backend is running!","version":"1.0.0"}`

If NOT working:
- ❌ Backend is NOT running
- ✅ Start it: `cd backend && npm start`

**Check 2: Check Console Logs**
1. Open http://localhost:3000
2. Press F12
3. Look for:
   - `API URL: http://localhost:4000` ✅
   - `Registering with: {name, email, API}` ✅
   - `Registration response status: 200` ✅

**Check 3: Is Port 4000 Free?**
```bash
# Mac/Linux
lsof -i :4000

# Windows
netstat -ano | findstr :4000
```

If something is using it:
```bash
# Mac/Linux
kill -9 <PID>

# Windows
taskkill /PID <PID> /F
```

**Check 4: Frontend Pointing to Right Backend**
- Open DevTools Console
- Type: `console.log(API)`
- Should print: `http://localhost:4000`

---

## 📝 Example Successful Flow

### Console Output:
```
API URL: http://localhost:4000
Registering with: {name: "Test User", email: "test@test.com", API: "http://localhost:4000"}
Registration response status: 200
Registration success: {success: true, user: {...}, token: "eyJ..."}
```

### What happens next:
1. User object saved to localStorage
2. Profile menu appears with user name
3. Admin tab visible (if admin)
4. Modal closes

---

## 🚨 Common Errors & Solutions

### "Error: 404 Not Found"
```
Problem: Frontend can't reach backend
Solution: 
1. Check backend is running: curl http://localhost:4000/
2. Check port 4000 is free: lsof -i :4000
3. Check console shows: API URL: http://localhost:4000
```

### "Network Error: fetch failed"
```
Problem: Network issue or port blocked
Solution:
1. Kill all node processes: pkill -f "npm start"
2. Restart both servers
3. Clear browser cache: Cmd+Shift+Delete
```

### "Unexpected token '<'" 
```
Problem: Backend returned HTML instead of JSON
Solution:
1. Backend crashed and serving error page
2. Check backend console for errors
3. Restart backend: cd backend && npm start
```

### "Email already registered"
```
Problem: You already created that account
Solution:
Use a different email address
Example: test2@test.com, test3@test.com
```

---

## 🎯 Quick Debug Commands

### Show API URL in console:
```javascript
// In browser console (F12)
console.log('API:', API)
```

### Test API endpoint:
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"Test@123"}'
```

### Check what's running on ports:
```bash
# Check port 4000 (backend)
lsof -i :4000

# Check port 3000 (frontend)
lsof -i :3000
```

### Kill all node processes:
```bash
pkill -f "npm start"
```

---

## ✨ If Still Not Working

**Last resort - Full reset:**
```bash
# 1. Kill all node processes
pkill -f "npm start"
pkill -f "node"

# 2. Clear npm cache
npm cache clean --force

# 3. Reinstall dependencies
cd /Users/akshathchity/HoyaHacks/backend
npm install

cd /Users/akshathchity/HoyaHacks/public
npm install

# 4. Start fresh
cd ../backend
npm start
# In new terminal:
cd ../public
npm start

# 5. Visit http://localhost:3000
```

---

## 📊 Expected API Response

When registration works, backend sends back:
```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Test User",
    "email": "test@test.com",
    "role": "student",
    "points": 0
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 🎓 Summary

**Both servers MUST be running on YOUR machine:**
- Backend: http://localhost:4000
- Frontend: http://localhost:3000

**To verify:**
1. `curl http://localhost:4000/api/health` (should work)
2. Browser console should show `API URL: http://localhost:4000`
3. Try registering again

If still getting 404, the backend is NOT responding. Check:
- Is it running? 
- Is port 4000 free?
- Are there errors in the backend terminal?

You've got this! 🚀
