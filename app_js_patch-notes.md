# app.js changes (already applied in the app.js included in this zip)

## Change 1 — fill in the real Zoho client ID + Cloud Function URL

Find:
```js
const ZOHO_NATIVE_CONFIG = {
  clientId: "YOUR_ZOHO_CLIENT_ID_HERE",
  redirectUri: "https://guru-kripahi-kevalam-108.firebaseapp.com/__/auth/handler",
  scope: "openid email profile",
};
```

Replace with:
```js
const ZOHO_NATIVE_CONFIG = {
  clientId: "1000.SI61HY6OEFKXFN1Z9H2KIUL69ZO2KO",
  redirectUri: "https://guru-kripahi-kevalam-108.firebaseapp.com/__/auth/handler",
  scope: "openid email profile",
  exchangeUrl: "https://us-central1-guru-kripahi-kevalam-108.cloudfunctions.net/zohoTokenExchange",
};
```

## Change 2 — call the Cloud Function when Zoho returns an auth `code`

Find (inside `_zohoNativeSignIn`'s `finish` function):
```js
        if (code) {
          // Authorization-code flow needs a server-side token exchange
          // (Zoho requires a client secret, which must never live in the
          // app). Point this at your own backend/Cloud Function that
          // exchanges the code and returns a Firebase custom token, then:
          //   const customToken = await fetch('https://YOUR_BACKEND/zoho-exchange?code=' + code)...
          //   await fbAuth.signInWithCustomToken(customToken);
          return reject(new Error("Received Zoho auth code but no server-side exchange is configured yet"));
        }
```

Replace with:
```js
        if (code) {
          if (!ZOHO_NATIVE_CONFIG.exchangeUrl) {
            return reject(new Error("Zoho code exchange URL not configured (see ZOHO_NATIVE_CONFIG.exchangeUrl)"));
          }
          try {
            const resp = await fetch(
              ZOHO_NATIVE_CONFIG.exchangeUrl + "?code=" + encodeURIComponent(code)
            );
            const data = await resp.json();
            if (!resp.ok || !data.customToken) {
              throw new Error((data && data.error) || "Zoho token exchange failed");
            }
            await fbAuth.signInWithCustomToken(data.customToken);
            return resolve();
          } catch (exchangeErr) {
            return reject(exchangeErr);
          }
        }
```
