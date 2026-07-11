const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();

// Set these with:
//   firebase functions:config:set zoho.client_id="YOUR_CLIENT_ID" \
//     zoho.client_secret="YOUR_CLIENT_SECRET" \
//     zoho.redirect_uri="https://guru-kripahi-kevalam-108.firebaseapp.com/__/auth/handler"
const ZOHO_CLIENT_ID = functions.config().zoho.client_id;
const ZOHO_CLIENT_SECRET = functions.config().zoho.client_secret;
const ZOHO_REDIRECT_URI = functions.config().zoho.redirect_uri;

// Called by app.js (_zohoNativeSignIn) with the authorization `code` Zoho
// redirected back with. Exchanges it server-side (client secret never
// leaves this function), looks up/creates a matching Firebase Auth user,
// and returns a Firebase custom token the app signs in with.
exports.zohoTokenExchange = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "GET, POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send("");
  }

  const code = req.method === "GET" ? req.query.code : (req.body || {}).code;
  if (!code) {
    return res.status(400).json({ error: "Missing 'code' parameter" });
  }

  try {
    // 1. Exchange the authorization code for a Zoho access token
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      redirect_uri: ZOHO_REDIRECT_URI,
      code,
    });

    const tokenResp = await fetch("https://accounts.zoho.com/oauth/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const tokenData = await tokenResp.json();

    if (!tokenResp.ok || tokenData.error || !tokenData.access_token) {
      console.error("Zoho token exchange failed:", tokenData);
      return res.status(400).json({ error: "Zoho token exchange failed", details: tokenData });
    }

    // 2. Fetch the Zoho user's profile (stable ID + email)
    const userInfoResp = await fetch("https://accounts.zoho.com/oauth/user/info", {
      headers: { Authorization: "Zoho-oauthtoken " + tokenData.access_token },
    });
    const userInfo = await userInfoResp.json();

    if (!userInfo || !userInfo.Email) {
      console.error("Zoho user info fetch failed:", userInfo);
      return res.status(400).json({ error: "Could not fetch Zoho user profile", details: userInfo });
    }

    const uid = "zoho:" + (userInfo.ZUID || userInfo.Email);

    // 3. Ensure a matching Firebase Auth user exists
    try {
      await admin.auth().getUser(uid);
    } catch (_notFound) {
      await admin.auth().createUser({
        uid,
        email: userInfo.Email,
        displayName:
          [userInfo.First_Name, userInfo.Last_Name].filter(Boolean).join(" ") || undefined,
      });
    }

    // 4. Mint the custom token the app will sign in with
    const customToken = await admin.auth().createCustomToken(uid, { provider: "zoho" });
    return res.status(200).json({ customToken });
  } catch (e) {
    console.error("zohoTokenExchange error:", e);
    return res.status(500).json({ error: "Internal error", details: String(e) });
  }
});
