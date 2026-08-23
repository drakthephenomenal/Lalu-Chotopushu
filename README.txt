GHOST LEADERBOARD PATCH — manual upload

root/  -> copy these 4 files into your repo root (overwrite existing)
www/   -> copy these 3 files into your repo's www/ folder (overwrite existing)
          (firestore.rules is not part of www/, it's not a web asset)

After uploading:
1. Deploy firestore.rules via Firebase console, or:
     firebase deploy --only firestore:rules
2. npx cap sync android
3. ./gradlew assembleRelease

Note: the app.js?v=142 / style.css?v= cache-busting query strings in
index.html were NOT bumped. Bump them yourself if your deploy process
expects that.
