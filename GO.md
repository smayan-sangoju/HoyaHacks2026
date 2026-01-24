# 🚀 JUST RUN THIS

## Terminal 1: Backend
```bash
cd /Users/akshathchity/HoyaHacks/backend
npm start
```

## Terminal 2: Frontend
```bash
cd /Users/akshathchity/HoyaHacks/public
npm start
```

## Browser
```
http://localhost:3000
```

That's it. Register/login should work.

---

## Test Creds

```
Email:    student@test.com
Password: Student123!
```

## If 404 Error
1. Make sure BOTH terminals show server running
2. Check browser console (F12) - look for `API URL: http://localhost:4000`
3. Run: `curl http://localhost:4000/` (should return JSON, not error)

Done.
