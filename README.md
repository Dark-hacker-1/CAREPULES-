
# CAREPULES - RAISE UP TOGETHER - FREE DEPLOY GUIDE FOR MOBILE

Team: RAISE UP TOGETHER, KIT - SDG 10
Features: Role selection Normal/Volunteer, Super Admin, Private personalReports, Public publicReports with photo+geotag, PublicStatsBanner visible after registration to all users (totalReported, totalCompleted, activeVolunteers), Volunteer claim & complete, Fast-track govt.

## HOW TO DEPLOY FREE FROM MOBILE - NO REPLIT FEE

### STEP 1: Create GitHub Repo on Mobile (2 mins)
1. Open Chrome -> github.com -> Login -> + New Repository -> Name carepules -> Create
2. Click Add File > Upload Files > Upload ALL files from this folder (zip extracted) -> Commit

### STEP 2: Create Firebase Backend (Free Spark - 3 mins)
1. Go to console.firebase.google.com -> Add Project -> carepules-kit
2. Authentication > Get Started > Email/Password > Enable
3. Firestore Database > Create > Test Mode (for now, later replace with secure rules from PPT)
4. Storage > Get Started > Test Mode
5. Project Settings > General > Web SDK > Copy firebaseConfig -> Paste into src/firebase.js replacing REPLACE_ME

### STEP 3: Deploy Frontend FREE to Vercel (2 mins - No fee)
1. Go to vercel.com -> Login with GitHub
2. Add New Project > Import carepules repo
3. Framework: Vite, Build Command: npm run build, Output: dist
4. Click Deploy -> In 1 min you get link: https://carepules.vercel.app -> Your app is LIVE!

### Alternative Free Frontend: Netlify
netlify.com -> Login GitHub -> Add New Site -> Import from GitHub -> Deploy

### How to Test 100% Working
1. Open your Vercel link on mobile
2. Sign up as Normal User -> See PublicStatsBanner with counters 0,0
3. Report 1 issue -> Counter goes 1 for ALL users (new feature)
4. Sign up second account as Volunteer -> See Volunteer Map Feed -> Claim Task -> Complete -> Completed counter increases

### Super Admin Setup (Free)
1. Sign up with your email
2. Go to console.firebase.google.com -> Firestore -> users collection -> Find your uid -> Change role to super_admin
3. Optional: Firebase Console > Functions > Or manually in Firestore rules set custom claim (for now role field is enough for demo)
4. Login -> You see Super Admin Dashboard

### Firestore Rules for Final Submission (Paste in Firestore > Rules)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} { allow read, write: if request.auth!=null && request.auth.uid==uid; }
    match /stats/{doc} { allow read: if request.auth!=null; allow write: if request.auth!=null; }
    match /publicReports/{id} { allow read: if true; allow create: if request.auth!=null; allow update: if request.auth!=null; }
    match /personalReports/{id} { allow create: if request.auth!=null; allow read: if request.auth!=null && (resource.data.ownerUid==request.auth.uid || resource.data.assignedVolunteerId==request.auth.uid); }
  }
}
```

Cost: Rs 0. No Replit fee. All free tier.

Time to deploy on mobile: 15 minutes.
