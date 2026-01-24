# Password Requirements & Security

## 🔐 Password Requirements

When registering a new account, passwords must meet these requirements:

### Requirements
- ✅ **At least 8 characters** (e.g., "MyPass123!")
- ✅ **1 uppercase letter** (A-Z) (e.g., "**M**yPass123!")
- ✅ **1 lowercase letter** (a-z) (e.g., "My**pass**123!")
- ✅ **1 special character** (!@#$%^&* etc) (e.g., "MyPass123**!**")

---

## ✅ Valid Password Examples

```
MyPassword1!      ✅ Valid (8+ chars, upper, lower, special)
SecurePass2@      ✅ Valid
Test123#ing       ✅ Valid
Pass@word123      ✅ Valid
Student2024!      ✅ Valid
```

---

## ❌ Invalid Password Examples

```
password123       ❌ No uppercase, no special char
Password          ❌ Too short, no number or special
Pass123           ❌ No special character
UPPERCASE123!     ❌ No lowercase letter
12345678!         ❌ No letters
```

---

## 🔍 Special Characters Allowed

Any of these special characters work:
```
! @ # $ % ^ & * ( ) _ + - = [ ] { } ; ' : " \ | , . < > / ?
```

**Examples:**
- `MyPass1!` (exclamation)
- `MyPass1@` (at symbol)
- `MyPass1#` (hash)
- `MyPass1$` (dollar)
- `MyPass1%` (percent)
- `MyPass1^` (caret)

---

## 📝 How Registration Validation Works

### Step 1: User Enters Password
```
Password: MyPassword1!
```

### Step 2: Real-Time Validation
Frontend checks immediately:
- ✅ At least 8 characters? **MyPassword1!** has 12 ✓
- ✅ Has uppercase? **M**yPassword1! ✓
- ✅ Has lowercase? My**password**1! ✓
- ✅ Has special char? MyPassword1**!** ✓

### Step 3: Submit Registration
- If all checks pass → Submit
- If any checks fail → Show error message

### Step 4: Backend Verification
- Backend also validates password strength
- Hashes password with bcryptjs
- Stores securely

---

## 🛡️ Security Features

### Password Hashing
- Passwords are hashed with **bcryptjs** (10 salt rounds)
- Never stored in plain text
- Salted hashes prevent rainbow table attacks

### Password Storage
```
Plain text: MyPassword1!
Hashed:    $2a$10$L9.XvL.9G8vJq9e9kK8e0uO7m9K3L2X9q9e9kK8e0uO7m9K3L2X9
```

### Login Verification
- User enters: `MyPassword1!`
- Backend hashes it
- Compares with stored hash
- If match → Login success

---

## 🔐 Password Tips

### For Users
✅ Use a mix of different character types
✅ Make it something you can remember
✅ Avoid personal information (birthdate, name)
✅ Use unique passwords for different apps
✅ Consider a password manager (LastPass, 1Password, Bitwarden)

### Examples of Strong Passwords
```
Coffee2024!morning
Summer2025@Beach!
Study#Hard2024pass
Dance@Night#2024
```

---

## 🐛 Troubleshooting

### Error: "Password must be at least 8 characters"
**Solution:** Add more characters to your password
```
Before: MyPass1!  (7 characters) ❌
After:  MyPass1!a (8 characters) ✅
```

### Error: "Password must contain at least 1 uppercase letter"
**Solution:** Add a capital letter
```
Before: mypassword1! ❌
After:  MyPassword1! ✅
```

### Error: "Password must contain at least 1 lowercase letter"
**Solution:** Add a lowercase letter
```
Before: MYPASSWORD1! ❌
After:  MyPassword1! ✅
```

### Error: "Password must contain at least 1 special character"
**Solution:** Add a special character (!@#$%^&* etc)
```
Before: MyPassword1 ❌
After:  MyPassword1! ✅
```

---

## 📋 Checklist Before Submitting

Before clicking "Create Account", verify:

- [ ] Password is 8+ characters long
- [ ] Password has at least 1 UPPERCASE letter
- [ ] Password has at least 1 lowercase letter
- [ ] Password has at least 1 special character (!@#$%^&*)
- [ ] Confirm password matches original password
- [ ] Email is valid format (example@domain.com)
- [ ] Name is filled in

---

## 🔄 Why These Requirements?

### Security Reasons
- **8+ characters:** Prevents short, easy-to-guess passwords
- **Uppercase letters:** Increases character combinations
- **Lowercase letters:** Increases character combinations
- **Special characters:** Adds complexity, prevents dictionary attacks

### Protection Against
- ❌ Brute force attacks (trying every combination)
- ❌ Dictionary attacks (trying common words)
- ❌ Rainbow table attacks (pre-computed hashes)

---

## ✨ Summary

**Password must have:**
- 8+ characters
- 1 Uppercase (A-Z)
- 1 Lowercase (a-z)
- 1 Special character (!@#$%^&*)

**Example:** `MyPass123!` ✅

**Why?** Makes your account more secure! 🔐
