#!/bin/bash
# Run from the repo root in Codespace, AFTER the 4 files are uploaded
# (or put updated-files.zip in the repo root and this script unzips it).
set -e

# 0) Optional: unpack the zip if it is sitting in the repo root
if [ -f updated-files.zip ]; then
  unzip -o updated-files.zip
  rm -f updated-files.zip
fi

# 1) Commit + push the app files (Vercel/hosting picks these up)
git add index.html sw.js app.js functions/index.js
git commit -m "Admin tools collapsible; Family Board admin menu (view as user, profile, notify, delete)" || echo "(nothing new to commit)"
git push origin main
echo "✅ App files pushed"

# 2) Deploy the new Cloud Function through GitHub Actions
#    (reuses the existing FIREBASE_SERVICE_ACCOUNT secret, no firebase login needed)
WF=.github/workflows/deploy-user-notification-function.yml
if [ ! -f "$WF" ]; then
  sed -e 's/^name: .*/name: Deploy single-user notification function/' \
      -e 's/Deploy sendBroadcastNotification/Deploy sendUserNotification/' \
      -e 's/functions:sendBroadcastNotification/functions:sendUserNotification/' \
      .github/workflows/deploy-broadcast-function.yml > "$WF"
  git add "$WF"
  git commit -m "Add deploy workflow for sendUserNotification"
fi

if git push origin main && sleep 8 && gh workflow run "deploy-user-notification-function.yml" --ref main; then
  echo "✅ Function deploy started. Watch it: gh run watch   (or GitHub → Actions)"
else
  echo "⚠️ Could not push/trigger the workflow from Codespace (token lacks 'workflow' scope)."
  echo "   Deploy the function directly instead:"
  echo "     npm i -g firebase-tools && firebase login --no-localhost"
  echo "     (cd functions && npm install)"
  echo "     firebase deploy --only functions:sendUserNotification --project guru-kripahi-kevalam-108"
fi
