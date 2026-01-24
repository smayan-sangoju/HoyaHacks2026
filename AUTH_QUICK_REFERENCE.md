# Authentication - Quick Reference

## ⚡ Quick Start (5 minutes)

### 1. Install Dependencies
```bash
cd backend
npm install
npm start
```

### 2. Test in Browser
- Go to http://localhost:3000
- Click **Login** button (top right)
- Click **Register** tab
- Create account: email + password
- Should see your profile appear

### 3. Create Admin (for testing)
In MongoDB Atlas Dashboard:
1. Go to your database
2. Find `users` collection
3. Copy the first user's password hash
4. Insert new document:
```json
{
  "name": "Admin",
  "email": "admin@test.com",
  "password": "<copy_hash_from_student>",
  "role": "admin",
  "points": 0,
  "createdAt": {"$date": "2026-01-24T00:00:00Z"}
}
```

### 4. Login as Admin
- Logout first
- Click Login
- Email: `admin@test.com`
- Password: `same_as_student_used_to_register`
- Click **Admin** tab
- Create trash can with image upload

---

## 🎯 Key Features

### Student Can:
- ✅ Register account
- ✅ Login
- ✅ View profile
- ✅ Logout
- ✅ Scan QR codes
- ✅ Earn points
- ❌ Create trash cans
- ❌ Upload images

### Admin Can:
- ✅ All student features
- ✅ Create trash cans
- ✅ Upload images
- ✅ Download QR codes
- ✅ Manage trash cans

---

## 📝 API Endpoints

### Public (No Auth Required)
```
GET  /api/trash-cans              # List all trash cans
GET  /api/trash-cans/:canId       # Get specific trash can
GET  /api/qr?canId=TC001          # Generate QR code
```

### Authentication
```
POST /api/auth/register           # { name, email, password }
POST /api/auth/login              # { email, password }
GET  /api/auth/me                 # (requires Authorization header)
```

### Admin Only (Requires Auth + Admin Role)
```
POST /api/trash-cans              # Create trash can (with image)
                                  # Headers: { Authorization: Bearer <token> }
                                  # Body: FormData { id, label, location, image }
```

---

## 🔑 Authentication Header

```javascript
// Send JWT token with every admin request
fetch(`${API}/api/trash-cans`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authState.token}`
  },
  body: formData
})
```

---

## 💾 Local Storage

### Saved Keys
- `cc_token` - JWT authentication token (expires 7 days)
- `cc_user` - User object { id, name, email, role, points }
- `cc_points` - Local points cache

### Clear All
```javascript
// In browser console (F12)
localStorage.clear()
location.reload()
```

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Login button always visible | Clear `localStorage` and refresh |
| Admin panel doesn't load | User must have `role: "admin"` in DB |
| Image upload fails | Check `multer` middleware & `/uploads` folder |
| JWT expired after 7 days | User must login again (tokens expire) |
| Password wrong but login attempt | Bcryptjs hash mismatch - use same password from registration |

---

## 🔒 Password Testing

### Safe Test Password
Use the same password throughout testing:
- Register with: `password123`
- Admin user password: `password123`
- Login with: `password123`

### For Production
- Use strong passwords (12+ chars, mixed case, numbers, symbols)
- Never share JWT secrets
- Rotate JWT_SECRET periodically

---

## 📸 Image Upload Process

1. **User selects image** in admin form
2. **JavaScript shows preview** immediately
3. **On submit**, image sent with FormData
4. **Backend multer** saves to `/uploads`
5. **Path stored in database** (e.g., `/uploads/img-123.png`)
6. **When QR scanned**, image path returned
7. **Modal shows image** when scanning

---

## 🚀 Deployment Checklist

- [ ] Install npm dependencies: `npm install`
- [ ] Set `JWT_SECRET` in `.env` (random 32+ char string)
- [ ] Update `API` URL in `public/index.html` to production
- [ ] Create admin user in production MongoDB
- [ ] Test login/register on production
- [ ] Test image upload on production
- [ ] Configure CORS for production domain
- [ ] Enable HTTPS (required for tokens)
- [ ] Set MongoDB connection string
- [ ] Test trash can creation with image

---

## 🧪 Test Scenarios

### Scenario 1: Student Registration & Recycling
1. Register new account
2. Logout
3. Login again (verify session persistence)
4. Scan QR code
5. Verify you're the logged-in student
6. Logout

### Scenario 2: Admin Trash Can Creation
1. Create admin user in MongoDB
2. Login as admin
3. Go to Admin tab
4. Select image file
5. See preview
6. Create trash can
7. See it in list
8. Download QR code
9. Test scanning QR code

### Scenario 3: Multi-User Test
1. Register student 1
2. Register student 2
3. Both login (different browsers or incognito)
4. Both scan same QR code
5. Both earn points
6. Verify separate point totals

---

## 🔐 Security Checklist

- ✅ Passwords hashed with bcryptjs
- ✅ JWT tokens expire (7 days)
- ✅ Admin endpoints require authentication
- ✅ Roles checked on backend
- ✅ Tokens verified on every request
- ⚠️ Use HTTPS in production
- ⚠️ Change JWT_SECRET in production
- ⚠️ Validate all file uploads
- ⚠️ Rate limit auth endpoints

---

## 📚 Full Documentation

For complete details, see:
- `AUTHENTICATION_GUIDE.md` - Full feature guide
- `AUTH_CHANGES_SUMMARY.md` - All code changes
- `QUICK_START.md` - General setup
- `CROSS_PLATFORM_GUIDE.md` - Platform-specific help

---

## ✨ You're All Set!

Your app now has:
✅ Student login & registration
✅ Admin panel with image uploads
✅ Secure authentication
✅ Role-based access
✅ Session persistence
✅ Production-ready code

Ready to authenticate! 🔐
