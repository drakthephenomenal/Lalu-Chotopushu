// Cloud Function: passwordless email sign-in (6-digit code + "Sign in" button), sent from your Gmail.
//   POST { action: "send",   email, device }
//   (the old "approve" / "check" actions were retired: they let a link opened on one device sign in ANOTHER device, which a phisher could abuse)
//   POST { action: "peek",   email, token }  -> { code }   (older: just show the code)
//   POST { action: "verify", email, code }   -> { token }  (typed code)
//   POST { action: "verify", email, token }  -> { token }  (button opened on the SAME device)
// "token" returned by verify is a Firebase custom token -> app calls signInWithCustomToken(token).
// Needs 2 environment values (written at deploy time by the GitHub workflow from GitHub secrets):
//   MAIL_USER          the Gmail address that sends the emails
//   MAIL_APP_PASSWORD  a Gmail "App password" (16 letters) for that address
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_GAP_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
const COLLECTION = "emailOtps";
const APP_URL = "https://radharadharadha.vercel.app";
const FROM_NAME = "RadhaNaam SudhaRasam";

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const mailPass = () => String(process.env.MAIL_APP_PASSWORD || "").replace(/\s+/g, "");
const hmac = (s) => crypto.createHmac("sha256", sha256("rj-otp|" + mailPass())).update(String(s)).digest("hex");
const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
// the 6-digit code is derived from the link token, so a button opened on another device can show it
const codeFromToken = (t) => String(parseInt(hmac("c|" + t).slice(0, 8), 16) % 1000000).padStart(6, "0");
const codeHash = (c) => hmac("h|" + c);

// Public Firebase Web API key (same one the app already ships with) - used only to CHECK a password server-side.
const FB_WEB_API_KEY = "AIzaSyCvvXEdsJjXpTbITE2HuyYFnPZfZIkxVWA";
async function verifyPasswordRest(email, password) {
  try {
    const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + FB_WEB_API_KEY, {
      method: "POST",
      // The web key is restricted to the app's own websites, and a server call has no website attached, so Google refuses it.
      // Sending the app's address as the Referer is how a server call passes that check.
      headers: { "Content-Type": "application/json", "Referer": APP_URL + "/" },
      body: JSON.stringify({ email: email, password: password, returnSecureToken: false }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      console.warn("verifyPasswordRest failed:", r.status, j && j.error && j.error.message);
    }
    return r.ok;
  } catch (e) { console.warn("verifyPasswordRest error:", e && e.message); return false; }
}


const clientIp = (req) => String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim() || "unknown";
// Counts one hit for `key`; returns false when more than `max` hits happened inside `windowMs`.
// Documents carry `expireAt` so a Firestore TTL policy on authRate/emailOtps/pwAttempts (field: expireAt) can clean them up.
async function rateLimit(key, max, windowMs) {
  const ref = admin.firestore().collection("authRate").doc(sha256(key));
  const now = Date.now();
  return admin.firestore().runTransaction(async (tx) => {
    const sn = await tx.get(ref);
    const d = sn.exists ? sn.data() : { n: 0, t: now };
    const fresh = now - (d.t || 0) < windowMs;
    const n = fresh ? (d.n || 0) : 0, t = fresh ? d.t : now;
    if (n >= max) return false;
    tx.set(ref, { n: n + 1, t: t, expireAt: new Date(t + windowMs + 3600000) });
    return true;
  });
}
// Marks a code as used exactly once (two requests at the same moment cannot both succeed).
async function consumeOtp(ref, now) {
  return admin.firestore().runTransaction(async (tx) => {
    const sn = await tx.get(ref);
    const d = sn.exists ? sn.data() : null;
    if (!d || d.used || now > d.exp) return false;
    tx.update(ref, { used: true });
    return true;
  });
}

async function uidForEmail(email) {
  try {
    const u = await admin.auth().getUserByEmail(email);
    if (!u.emailVerified) { try { await admin.auth().updateUser(u.uid, { emailVerified: true }); } catch (_) {} }
    return u.uid; // same uid => same cloud data as the existing email / Google account
  } catch (e) {
    if (e && e.code !== "auth/user-not-found") throw e;
    const made = await admin.auth().createUser({ email: email, emailVerified: true });
    return made.uid;
  }
}

async function sendMail(to, link, code) {
  const user = process.env.MAIL_USER;
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: user, pass: mailPass() } });
  const html = '<div style="font-family:Arial,sans-serif;max-width:440px;margin:auto;padding:24px;color:#222">'
    + '<h2 style="margin:0 0 6px">Sign in to RadhaNaam SudhaRasam \uD83D\uDE4F</h2>'
    + '<p style="color:#555;margin:0 0 14px">Enter this code in the app:</p>'
    + '<p style="text-align:center;margin:0 0 18px;font-size:36px;letter-spacing:8px;font-weight:700;color:#2b1b00;background:#fbf1d4;border-radius:12px;padding:14px 8px 14px 16px">' + code + '</p>'
    + '<p style="color:#555;margin:0 0 6px">Or tap the button to sign in on this device:</p>'
    + '<p style="text-align:center;margin:14px 0 22px"><a href="' + link + '" style="background:#d9a62b;color:#2b1b00;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">Sign in</a></p>'
    + '<p style="color:#888;font-size:12px">The code and button work for 10 minutes. If you did not ask for this, ignore this email - never share this code with anyone.</p></div>';
  await transporter.sendMail({
    from: '"' + FROM_NAME + '" <' + user + ">",
    to: to,
    subject: code + " is your RadhaNaam SudhaRasam sign-in code",
    text: "Your RadhaNaam SudhaRasam sign-in code: " + code + "\nOr open this link on this device: " + link + "\nThe code works for 10 minutes. If you did not ask for this, ignore this email. Never share this code.",
    html: html,
  });
}

exports.emailCode = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only", code: "bad-method" });
  const fail = (st, msg, code) => res.status(st).json({ error: msg, code: code || "error" });
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const ip = clientIp(req);

    // "status": does this email / phone number already have an app password? (answers only true/false,
    // so a missing account and an account without a password look the same - nothing else is revealed)
    if (b.action === "status") {
      if (!(await rateLimit("status|" + ip, 60, 10 * 60 * 1000))) return fail(429, "Too many requests. Please wait a few minutes.", "locked");
      let u = null;
      try {
        if (b.phone) {
          const ph = String(b.phone).trim();
          if (!/^\+[1-9]\d{6,14}$/.test(ph)) return fail(400, "Enter a valid phone number.", "bad-phone");
          u = await admin.auth().getUserByPhoneNumber(ph);
        } else {
          const em = String(b.email || "").trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) || em.length > 200) return fail(400, "Enter a valid email address.", "bad-email");
          u = await admin.auth().getUserByEmail(em);
        }
      } catch (e) {
        if (!(e && e.code === "auth/user-not-found")) throw e;
      }
      const hasPassword = !!(u && (u.providerData || []).some((p) => p && p.providerId === "password"));
      return res.status(200).json({ hasPassword: hasPassword });
    }

    // "pwsignin": ONE app password for the whole account. Works with the email OR the phone number,
    // whichever one the password was originally saved under (both belong to the same account).
    if (b.action === "pwsignin") {
      const pw = String(b.password || "");
      if (!pw || pw.length > 200) return fail(400, "Enter your password.", "bad-input");
      let u = null;
      try {
        if (b.phone) {
          const ph = String(b.phone).trim();
          if (!/^\+[1-9]\d{6,14}$/.test(ph)) return fail(400, "Enter a valid phone number.", "bad-phone");
          u = await admin.auth().getUserByPhoneNumber(ph);
        } else {
          const em = String(b.email || "").trim().toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em) || em.length > 200) return fail(400, "Enter a valid email address.", "bad-email");
          u = await admin.auth().getUserByEmail(em);
        }
      } catch (e) {
        if (!(e && e.code === "auth/user-not-found")) throw e;
      }
      const wrong = () => fail(400, "Wrong password, or no password has been set yet. You can use OTP / the email code instead.", "bad-password");
      if (!u) return wrong();
      const t0 = Date.now();
      if (!(await rateLimit("pwacct|" + u.uid, 200, 60 * 60 * 1000))) return fail(429, "Too many attempts on this account. Try again later, or use OTP / the email code.", "locked");
      const rl = admin.firestore().collection("pwAttempts").doc(sha256(u.uid + "|" + ip)); // per device: a stranger cannot lock the real owner out
      const rs = await rl.get(); const rd = rs.exists ? rs.data() : { n: 0, t: 0 };
      const fresh = t0 - (rd.t || 0) < 15 * 60 * 1000;
      if (fresh && (rd.n || 0) >= 8) return fail(429, "Too many wrong attempts. Try again in a few minutes, or use OTP / the email code.", "locked");
      const ids = new Set();
      const pwProv = (u.providerData || []).filter((p) => p && p.providerId === "password");
      if (!pwProv.length) { await rl.set({ n: (fresh ? rd.n || 0 : 0) + 1, t: fresh ? rd.t : t0, expireAt: new Date(t0 + 15 * 60 * 1000 + 3600000) }); return wrong(); }
      if (u.email) ids.add(u.email.toLowerCase());
      pwProv.forEach((p) => { if (p.email) ids.add(String(p.email).toLowerCase()); });
      let ok = false;
      for (const id of ids) { ok = await verifyPasswordRest(id, pw); if (ok) break; }
      if (!ok) { await rl.set({ n: (fresh ? rd.n || 0 : 0) + 1, t: fresh ? rd.t : t0, expireAt: new Date(t0 + 15 * 60 * 1000 + 3600000) }); return wrong(); }
      try { await rl.delete(); } catch (_) {}
      const token = await admin.auth().createCustomToken(u.uid);
      return res.status(200).json({ token: token });
    }

    if (!process.env.MAIL_USER || !mailPass()) return fail(500, "Email sending is not configured.", "server/no-mail");
    const email = String(b.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return fail(400, "Enter a valid email address.", "bad-email");
    const ref = admin.firestore().collection(COLLECTION).doc(sha256(email));
    const now = Date.now();

    if (b.action === "send") {
      const snap = await ref.get();
      const old = snap.exists ? snap.data() : null;
      if (old && now - (old.createdAt || 0) < RESEND_GAP_MS) return fail(429, "Please wait a few seconds before requesting another code.", "too-soon");
      if (!(await rateLimit("sendip|" + ip, 100000, 60 * 60 * 1000)) || !(await rateLimit("sendem|" + email, 100000, 60 * 60 * 1000))) return fail(429, "Too many requests. Please try again in a while.", "too-soon");
      const token = crypto.randomBytes(24).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      const code = codeFromToken(token);
      const dev = String(b.device || "");
      await ref.set({ tokenHash: sha256(token), codeHash: codeHash(code), exp: now + CODE_TTL_MS, attempts: 0, used: false, approved: false, deviceHash: /^[A-Za-z0-9_-]{16,80}$/.test(dev) ? sha256(dev) : "", createdAt: now, expireAt: new Date(now + 24 * 3600 * 1000) });
      try {
        await sendMail(email, APP_URL + "/email-signin.html?rjlink=" + token + "&rje=" + encodeURIComponent(email), code);
      } catch (e) {
        console.error("Gmail send failed:", e && e.message);
        return fail(500, "Could not send the email. Check the Gmail address and App password.", "server/mail-failed");
      }
      return res.status(200).json({ ok: true });
    }

    const snap = await ref.get();
    const d = snap.exists ? snap.data() : null;
    if (!d || d.used || now > d.exp) return fail(400, "This code has expired or was already used. Request a new one.", "expired");

    if (b.action === "approve" || b.action === "check") return fail(410, "This sign-in method was retired. Please type the code from your email.", "retired");

    if (b.action === "peek") {
      if (!b.token || !safeEq(sha256(b.token), d.tokenHash)) return fail(400, "Invalid link.", "bad-link");
      return res.status(200).json({ code: codeFromToken(String(b.token)) });
    }

    if (b.action === "verify") {
      if (d.attempts >= MAX_ATTEMPTS) return fail(429, "Too many wrong attempts. Request a new code.", "locked");
      let ok = false;
      if (b.token) ok = safeEq(sha256(b.token), d.tokenHash);
      else {
        await ref.update({ attempts: (d.attempts || 0) + 1 }); // count the attempt before checking
        ok = /^\d{6}$/.test(String(b.code || "")) && safeEq(codeHash(String(b.code)), d.codeHash);
      }
      if (!ok) return fail(400, "That code is not correct.", "bad-code");
      if (!(await consumeOtp(ref, now))) return fail(400, "This code has expired or was already used. Request a new one.", "expired");
      const uid = await uidForEmail(email);
      const token = await admin.auth().createCustomToken(uid);
      return res.status(200).json({ token: token });
    }
    return fail(400, "Unknown action.", "bad-action");
  } catch (e) {
    console.error("emailCode error:", e && e.message);
    return fail(500, "Something went wrong. Please try again.", "server/error");
  }
});
