# Admin Setup Guide

## Overview
By default, all newly registered users are created as **students**. To promote a user to **admin** status and access the admin panel, follow the steps below.

## How to Become an Admin

### Step 1: Register as a Student
First, create a regular student account:
1. Click the 👤 emoji in the header
2. Go to the "Register" tab
3. Fill in the form with:
   - **Full name**: Any name you want
   - **Email**: Any email address (no @admin.com requirement)
   - **Password**: Must meet the requirements:
     - At least 8 characters
     - 1 uppercase letter (A-Z)
     - 1 lowercase letter (a-z)
     - 1 special character (!@#$%^&* etc)
4. Click "Create Account"

### Step 2: Promote to Admin
Once registered, use the admin promotion endpoint to upgrade your account:

```bash
curl -X POST http://localhost:4000/api/auth/make-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
```

Replace `your-email@example.com` with the email you registered with.

### Step 3: Login and Access Admin Panel
1. Click the 👤 emoji
2. Go to the "Login" tab
3. Log in with your email and password
4. Click the "Admin" tab at the top
5. You should now see the admin panel with the ability to:
   - Create new trash cans
   - Upload images for trash cans
   - View all existing trash cans
   - Download QR codes for each trash can

## Sign Out
After logging in, click the 👤 emoji to see your profile menu with your name and email. The red **Sign Out** button will log you out and return you to the login screen.

## Notes
- There is NO @admin.com email requirement
- Any email address works for registration
- Students cannot access the admin panel - they can only scan and view trash cans
- The admin panel allows you to create trash cans with images and generate QR codes for them

## Troubleshooting

**Q: I registered but the admin tab is still locked**
A: You need to run the admin promotion command from Step 2. Make sure both the backend and frontend are running.

**Q: The promotion endpoint isn't working**
A: Make sure the backend server is running on `http://localhost:4000`

**Q: I forgot my password**
A: Currently, there's no password reset feature. You'll need to register a new account with a different email.

---

Happy administrating! 🎉
