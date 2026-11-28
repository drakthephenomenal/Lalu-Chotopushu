// Vercel serverless function: passwordless email sign-in with a 6-digit code AND a sign-in button (like Claude).
//   POST /api/email-code   { action: "send",   email }
//   POST /api/email-code   { action: "peek",   email, token }   -> { code }   (link opened on ANOTHER device: show the code)
//   POST /api/email-code   { action: "verify", email, code }    -> { token }   (typed code)
//   POST /api/email-code   { action: "verify", email, token }   -> { token }   (link button opened on the SAME device)
// "token" returned by verify is a Firebase custom token -> client calls firebase.auth().signInWithCustomToken(token).
// No npm packages needed. Environment variables (Vercel -> Project -> Settings -> Environment Variables):
//   FIREBASE_SERVICE_ACCOUNT  full JSON of a Firebase service-account key
//   OTP_SECRET                any long random string
//   BREVO_API_KEY             Brevo (Sendinblue) API key  (v3, "Transactional email")
//   MAIL_FROM                 sender email that is verified in Brevo
//   MAIL_FROM_NAME            (optional) default "RadhaNaam SudhaRasam"
//   APP_URL                   (optional) default https://radharadharadha.vercel.app
const crypto = require("crypto");

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_GAP_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
const COLLECTION = "emailOtps";

const b64u = (b) => Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const hmac = (k, s) => crypto.createHmac("sha256", k).update(String(s)).digest("hex");
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function sa() {
  if (!sa._v) sa._v = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  return sa._v;
}

// ── Google OAuth access token for the service account (cached) ──
let _tok = null, _tokExp = 0;
async function accessToken() {
  if (_tok && Date.now() < _tokExp - 60000) return _tok;
  const s = sa(), now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({
    iss: s.client_email, sub: s.client_email, aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore",
    iat: now, exp: now + 3600,
  }));
  const sig = b64u(crypto.createSign("RSA-SHA256").update(head + "." + claim).sign(s.private_key));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + head + "." + claim + "." + sig,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("service account auth failed");
  _tok = j.access_token; _tokExp = Date.now() + (j.expires_in || 3600) * 1000;
  return _tok;
}

// ── Firestore REST (service account bypasses security rules) ──
const fsBase = () => "https://firestore.googleapis.com/v1/projects/" + sa().project_id + "/databases/(default)/documents/" + COLLECTION + "/";
function enc(o) {
  const f = {};
  for (const k of Object.keys(o)) {
    const v = o[k];
    f[k] = typeof v === "number" ? { integerValue: String(v) } : typeof v === "boolean" ? { booleanValue: v } : { stringValue: String(v) };
  }
  return { fields: f };
}
function dec(doc) {
  const o = {};
  for (const k of Object.keys(doc.fields || {})) {
    const v = doc.fields[k];
    o[k] = v.integerValue !== undefined ? Number(v.integerValue) : v.booleanValue !== undefined ? v.booleanValue : v.stringValue;
  }
  return o;
}
async function getDoc(id) {
  const r = await fetch(fsBase() + id, { headers: { Authorization: "Bearer " + (await accessToken()) } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("db read failed");
  return dec(await r.json());
}
async function setDoc(id, o) {
  const r = await fetch(fsBase() + id, {
    method: "PATCH", headers: { Authorization: "Bearer " + (await accessToken()), "Content-Type": "application/json" },
    body: JSON.stringify(enc(o)),
  });
  if (!r.ok) throw new Error("db write failed");
}

// ── Firebase user lookup / create, custom token ──
async function idt(path, body) {
  const r = await fetch("https://identitytoolkit.googleapis.com/v1/projects/" + sa().project_id + path, {
    method: "POST", headers: { Authorization: "Bearer " + (await accessToken()), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("identity toolkit error");
  return j;
}
async function uidForEmail(email) {
  const found = await idt("/accounts:lookup", { email: [email] });
  if (found.users && found.users.length) {
    const u = found.users[0];
    if (!u.emailVerified) { try { await idt("/accounts:update", { localId: u.localId, emailVerified: true }); } catch (_) {} }
    return u.localId;           // same uid => same cloud data as the existing email / Google account
  }
  const made = await idt("/accounts", { email: email, emailVerified: true });
  return made.localId;
}
function customToken(uid) {
  const s = sa(), now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({
    iss: s.client_email, sub: s.client_email,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now, exp: now + 3600, uid: uid,
  }));
  return head + "." + claim + "." + b64u(crypto.createSign("RSA-SHA256").update(head + "." + claim).sign(s.private_key));
}

// ── code derivation: the 6-digit code is derived from the link token, so a link opened on another device can show it ──
const codeFromToken = (t) => String(parseInt(hmac(process.env.OTP_SECRET, "c|" + t).slice(0, 8), 16) % 1000000).padStart(6, "0");
const codeHash = (c) => hmac(process.env.OTP_SECRET, "h|" + c);

async function sendMail(to, code, link) {
  const from = process.env.MAIL_FROM, name = process.env.MAIL_FROM_NAME || "RadhaNaam SudhaRasam";
  const html = '<div style="font-family:Arial,sans-serif;max-width:440px;margin:auto;padding:24px;color:#222">'
    + '<h2 style="margin:0 0 6px">Sign in to RadhaNaam SudhaRasam \uD83D\uDE4F</h2>'
    + '<p style="color:#555;margin:0 0 18px">Tap the button on the same device, or type this code in the app:</p>'
    + '<div style="font-size:34px;letter-spacing:8px;font-weight:700;text-align:center;padding:14px;background:#f4f1e8;border-radius:10px">' + code + "</div>"
    + '<p style="text-align:center;margin:22px 0"><a href="' + link + '" style="background:#d9a62b;color:#2b1b00;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">Sign in</a></p>'
    + '<p style="color:#888;font-size:12px">This code and button work for 10 minutes. If you did not ask for this, ignore this email.</p></div>';
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST", headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: name, email: from }, to: [{ email: to }],
      subject: "Your sign-in code: " + code, htmlContent: html,
      textContent: "Your sign-in code is " + code + "\nOr open this link on the same device: " + link + "\nValid for 10 minutes.",
    }),
  });
  if (!r.ok) throw new Error("mail send failed");
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const fail = (st, msg, code) => res.status(st).json({ error: msg, code: code || "error" });
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT || !process.env.OTP_SECRET) return fail(500, "Server is not configured (missing environment variables).", "server/not-configured");
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const email = String(b.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return fail(400, "Enter a valid email address.", "bad-email");
    const id = sha256(email), now = Date.now();

    if (b.action === "send") {
      if (!process.env.BREVO_API_KEY || !process.env.MAIL_FROM) return fail(500, "Email sending is not configured.", "server/no-mail");
      const old = await getDoc(id);
      if (old && now - old.createdAt < RESEND_GAP_MS) return fail(429, "Please wait a few seconds before requesting another code.", "too-soon");
      const token = crypto.randomBytes(24).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      const code = codeFromToken(token);
      await setDoc(id, { tokenHash: sha256(token), codeHash: codeHash(code), exp: now + CODE_TTL_MS, attempts: 0, used: false, createdAt: now });
      const base = (process.env.APP_URL || "https://radharadharadha.vercel.app").replace(/\/$/, "");
      await sendMail(email, code, base + "/?rjlink=" + token + "&rje=" + encodeURIComponent(email));
      return res.status(200).json({ ok: true });
    }

    const d = await getDoc(id);
    if (!d || d.used || now > d.exp) return fail(400, "This code has expired or was already used. Request a new one.", "expired");

    if (b.action === "peek") {
      if (!b.token || !safeEq(sha256(b.token), d.tokenHash)) return fail(400, "Invalid link.", "bad-link");
      return res.status(200).json({ code: codeFromToken(String(b.token)) });
    }

    if (b.action === "verify") {
      if (d.attempts >= MAX_ATTEMPTS) return fail(429, "Too many wrong attempts. Request a new code.", "locked");
      let ok = false;
      if (b.token) ok = safeEq(sha256(b.token), d.tokenHash);
      else {
        d.attempts += 1; await setDoc(id, d);                       // count the attempt before checking
        ok = /^\d{6}$/.test(String(b.code || "")) && safeEq(codeHash(String(b.code)), d.codeHash);
      }
      if (!ok) return fail(400, "That code is not correct.", "bad-code");
      d.used = true; await setDoc(id, d);
      const uid = await uidForEmail(email);
      return res.status(200).json({ token: customToken(uid) });
    }
    return fail(400, "Unknown action.", "bad-action");
  } catch (e) {
    return fail(500, "Something went wrong. Please try again.", "server/error");
  }
};
