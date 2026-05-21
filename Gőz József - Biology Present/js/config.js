/* ============================================================
   Firebase configuration — REPLACE WITH YOUR OWN VALUES
   ------------------------------------------------------------
   Setup steps (5 minutes):

   1. Go to https://console.firebase.google.com/ and click
      "Add project". Name it (e.g. "biology-leaderboard").
      Disable Analytics if you want — not required.

   2. In the new project, click the </> (Web) icon to
      "Add an app to your project". Give it a nickname,
      DO NOT enable Firebase Hosting — your site lives on GitHub.
      Firebase will show you a config object like the one below.
      Copy the six values into this file.

   3. In the left sidebar of the Firebase console:
        Build → Authentication → Get started
        → Sign-in method → Google → Enable
        (Pick a support email and save.)

   4. Build → Firestore Database → Create database
        → Start in PRODUCTION mode
        → Pick a location (europe-west, etc.)

   5. In Firestore → Rules tab, replace with:

        rules_version = '2';
        service cloud.firestore {
          match /databases/{db}/documents {
            match /scores/{doc} {
              // Anyone signed in can read the leaderboard
              allow read: if request.auth != null;
              // Only the owner can write their own score, and only with sane shape
              allow create: if request.auth != null
                && request.resource.data.uid == request.auth.uid
                && request.resource.data.score is number
                && request.resource.data.score >= 0
                && request.resource.data.score <= 100
                && request.resource.data.chapter is string;
            }
          }
        }

   6. Authentication → Settings → Authorized domains:
      add your GitHub Pages URL, e.g. yourname.github.io
      (localhost is enabled by default for testing).

   That's it — the leaderboard will work as soon as this file
   contains real values.
   ============================================================ */

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAaSbfmVWpIOeb8u5YrFhyVPpVHz6ELn2w",
  authDomain: "goz-jozsef-classroom.firebaseapp.com",
  projectId: "goz-jozsef-classroom",
  storageBucket: "goz-jozsef-classroom.firebasestorage.app",
  messagingSenderId: "866184343173",
  appId: "1:866184343173:web:fb749f942592cf10c103ec",
  measurementId: "G-Q2W2JX6J5P"
};

// If you want to temporarily run the site without leaderboard
// (for offline demos), set this to false.
window.LEADERBOARD_ENABLED = true;
