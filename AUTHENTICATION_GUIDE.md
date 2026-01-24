# Authentication & Admin Features Guide

## Overview

Your ClearCycle app now includes a complete authentication system with student login, registration, and admin panel for managing trash cans.

---

## 🔐 Features

### 1. Student Login & Registration
- **Register** a new student account
- **Login** with email and password
- **Session persistence** (tokens saved in localStorage)
- **Logout** functionality

### 2. Admin Features
- Create and manage trash cans
- Upload images for trash cans
- Download QR codes
- View all trash cans

### 3. Security
- Password hashing with bcryptjs
- JWT token-based authentication
- Role-based access control (student vs admin)
- Protected admin endpoints

---

## 👥 User Roles

### Student Role (Default)
- Can scan QR codes
- Can recycle items and earn points
- Cannot access admin panel
- Can view own profile

### Admin Role
- All student features
- Can create trash cans
- Can upload images
- Can manage all trash cans
- Access to admin panel

---

## 🚀 Getting Started

### Install New Dependencies

```bash
cd backend
npm install
```

The following packages were added:
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT tokens

### Start the App

```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd public
npm start
```

Visit http://localhost:3000

---

## 📝 Using the App

### Student Workflow

**Step 1: Register or Login**
1. Click **"Login"** button (top right)
2. Click **"Register"** tab
3. Enter name, email, password
4. Click **"Create Account"**
   - OR use existing credentials to login

**Step 2: View Profile**
1. Click profile icon (👤) in header
2. See your name and email
3. Click **"Logout"** to sign out

**Step 3: Scan & Recycle**
1. Go to **"Scan"** tab
2. Scan product barcodes
3. Scan trash can QR codes
4. Record video
5. Earn points!

### Admin Workflow

**Step 1: Login as Admin**
To create an admin account, you need to manually update the database.

For development, create an admin via backend console:
```javascript
// SSH into your server or run locally
db.users.insert({
  name: "Admin User",
  email: "admin@example.com",
  password: "<hash>", // Use bcryptjs to hash
  role: "admin",
  points: 0,
  createdAt: new Date()
})
```

Or modify the User model in backend to create an admin on first run.

**Step 2: Access Admin Panel**
1. Login with admin account
2. Click **"Admin"** tab
3. See all trash cans
4. Create new trash cans

**Step 3: Create a Trash Can**
1. Enter **Can ID** (e.g., TC002)
2. Enter **Label** (e.g., "Main Recycling Bin")
3. Enter **Location** (e.g., "Building A")
4. Upload **Image** (click file input and select image)
5. See image preview
6. Click **"Create Can"**
7. View created can in list below
8. Click **"Download QR"** to get QR code

---

## 🖼️ Image Upload Feature

### How It Works

1. **Admin uploads image** when creating trash can
2. **Image saved to `/uploads` folder** on backend
3. **Image path stored** in trash can database
4. **When scanned**, QR code shows the image

### Supported Image Types
- JPG/JPEG
- PNG
- GIF
- WEBP

### Image Storage
- **Local development**: `backend/uploads/`
- **Production**: Configure S3 (see backend .env)

---

## 🔑 API Endpoints

### Authentication

**POST /api/auth/register**
```javascript
Body: { name, email, password }
Response: { success, user, token }
```

**POST /api/auth/login**
```javascript
Body: { email, password }
Response: { success, user, token }
```

**GET /api/auth/me**
```javascript
Headers: { Authorization: "Bearer <token>" }
Response: { user }
```

### Trash Cans (Requires Admin)

**POST /api/trash-cans** (with image upload)
```javascript
Headers: { Authorization: "Bearer <token>" }
Body: FormData { id, label, location, image }
Response: { saved, can }
```

**GET /api/trash-cans** (public)
```javascript
Response: { cans }
```

**GET /api/trash-cans/:canId** (public)
```javascript
Response: { can }
```

---

## 🧪 Testing

### Test Registration
1. Click **Login**
2. Click **Register**
3. Enter:
   - Name: "John Doe"
   - Email: "john@example.com"
   - Password: "password123"
4. Click **"Create Account"**
5. Should see profile name appear

### Test Login
1. Logout (click profile → Logout)
2. Click **Login**
3. Click **Login** tab
4. Enter email and password
5. Should login successfully

### Test Admin Features
Currently, admin features require manually setting `role: "admin"` in database.

Future improvement: Add UI to promote users to admin.

---

## 🔒 Security Features

### Password Security
- Passwords hashed with bcryptjs (10 salt rounds)
- Never stored in plain text
- Hashed passwords salted before storage

### Token Security
- JWT tokens expire after 7 days
- Tokens stored in browser localStorage
- Token verified on every admin request
- Invalid tokens rejected

### Database Security
- Unique email constraint prevents duplicates
- Role-based access control
- Admin endpoints require valid token + admin role
- Passwords validated on login

### HTTPS Recommendation
In production, always use HTTPS to encrypt tokens in transit.

---

## 📚 Database Schema

### User Model
```javascript
{
  name: String,           // User's full name
  email: String,          // Unique email
  password: String,       // Hashed password
  role: String,          // 'student' or 'admin'
  points: Number,        // Earned points
  createdAt: Date        // Account creation time
}
```

### TrashCan Model
```javascript
{
  id: String,            // Unique ID (e.g., TC001)
  label: String,         // Display name
  location: String,      // Physical location
  image: String,         // Image URL/path
  createdAt: Date        // Creation time
}
```

---

## ⚙️ Environment Variables

### Backend .env

```
# Required
MONGO_URI=your_mongodb_connection_string
PORT=4000

# Authentication
JWT_SECRET=your_super_secret_jwt_key_change_in_production

# Optional - S3 for image storage
S3_ENDPOINT=...
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

### Frontend (Hardcoded)
- `API = 'http://localhost:4000'`
- Change to your production URL when deploying

---

## 🚀 Deployment

### For Production

1. **Update API URL in Frontend**
   ```javascript
   // public/index.html
   const API = 'https://your-backend-domain.com';
   ```

2. **Set Strong JWT Secret**
   ```bash
   # Generate random secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Add to .env
   JWT_SECRET=your_generated_secret
   ```

3. **Deploy Backend**
   - Railway, Heroku, AWS, Google Cloud
   - Ensure MONGO_URI is set
   - Ensure JWT_SECRET is set

4. **Deploy Frontend**
   - Vercel, Netlify, GitHub Pages
   - Update API URL before deploying

5. **Update CORS**
   ```javascript
   // backend/server.js
   app.use(cors({
     origin: ['https://your-frontend-domain.com']
   }))
   ```

---

## 🐛 Troubleshooting

### "Login button doesn't appear"
- Clear browser cache (Cmd+Shift+Delete)
- Clear localStorage:
  ```javascript
  // In browser console (F12)
  localStorage.clear()
  location.reload()
  ```

### "Admin panel won't load"
- User must have `role: 'admin'` in database
- Check MongoDB to verify user role
- Token might be invalid - logout and login again

### "Image upload fails"
- Check that `/uploads` folder exists
- Ensure `multer` is properly configured
- Check file size limits (default 12MB for videos, check for images)
- Verify authorization header is being sent

### "JWT token expired"
- Tokens expire after 7 days
- User must login again
- For infinite tokens (not recommended):
  ```javascript
  // backend/server.js - Change token expiration
  { expiresIn: 'never' } // NOT RECOMMENDED
  ```

### "CORS errors"
- Backend must allow frontend origin
- Check:
  ```javascript
  app.use(cors())  // Allows all origins
  ```

---

## 🔄 Future Enhancements

### Suggested Features
1. **Email verification** for new registrations
2. **Password reset** functionality
3. **Admin promotion UI** (make students admins)
4. **Trash can editing** (update existing cans)
5. **Image gallery** for each trash can
6. **User management** (view all users, disable accounts)
7. **Audit logs** (track who changed what)
8. **Two-factor authentication** for admins
9. **API keys** for programmatic access
10. **Social login** (Google, Facebook)

---

## 📞 Support

Check these files for more info:
- `QUICK_START.md` - General setup
- `CROSS_PLATFORM_GUIDE.md` - Platform-specific issues
- `COMPLETE_SETUP_SUMMARY.md` - Full overview

For authentication-specific issues, check:
- Backend logs: `npm start` output
- Browser console: Press F12
- Network tab: Check API requests

---

## ✨ Summary

Your app now has:
✅ Student registration & login
✅ Admin panel for trash can management
✅ Image upload functionality
✅ JWT token-based authentication
✅ Role-based access control
✅ Secure password hashing
✅ Session persistence

Ready to authenticate! 🔐
