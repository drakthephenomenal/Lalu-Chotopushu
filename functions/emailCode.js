// Cloud Function: passwordless email sign-in (6-digit code + "Sign in" button), sent from your Gmail.
//   POST { action: "send",   email, device }
//   POST { action: "approve",email, token }  -> { code }   (button opened on ANOTHER device/browser: approves the waiting app, returns the code as a fallback)
//   POST { action: "check",  email, device } -> { token } or { pending:true }   (the waiting app polls this)
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

async function sendMail(to, link) {
  const user = process.env.MAIL_USER;
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: user, pass: mailPass() } });
  const html = '<div style="font-family:Arial,sans-serif;max-width:440px;margin:auto;padding:24px;color:#222">'
    + '<h2 style="margin:0 0 6px">Sign in to RadhaNaam SudhaRasam \uD83D\uDE4F</h2>'
    + '<p style="color:#555;margin:0 0 18px">Tap the button below to sign in.</p>'
    + '<p style="text-align:center;margin:22px 0"><a href="' + link + '" style="background:#d9a62b;color:#2b1b00;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block">Sign in</a></p>'
    + '<p style="color:#888;font-size:12px">This button works for 10 minutes. If you did not ask for this, ignore this email.</p></div>';
  await transporter.sendMail({
    from: '"' + FROM_NAME + '" <' + user + ">",
    to: to,
    subject: "Sign in to RadhaNaam SudhaRasam",
    text: "Sign in to RadhaNaam SudhaRasam: " + link + "\nThis link works for 10 minutes. If you did not ask for this, ignore this email.",
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

    // "status": does this email / phone number already have an app password? (answers only true/false,
    // so a missing account and an account without a password look the same - nothing else is revealed)
    if (b.action === "status") {
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

    if (!process.env.MAIL_USER || !mailPass()) return fail(500, "Email sending is not configured.", "server/no-mail");
    const email = String(b.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return fail(400, "Enter a valid email address.", "bad-email");
    const ref = admin.firestore().collection(COLLECTION).doc(sha256(email));
    const now = Date.now();

    if (b.action === "send") {
      const snap = await ref.get();
      const old = snap.exists ? snap.data() : null;
      if (old && now - (old.createdAt || 0) < RESEND_GAP_MS) return fail(429, "Please wait a few seconds before requesting another code.", "too-soon");
      const token = crypto.randomBytes(24).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
      const code = codeFromToken(token);
      const dev = String(b.device || "");
      await ref.set({ tokenHash: sha256(token), codeHash: codeHash(code), exp: now + CODE_TTL_MS, attempts: 0, used: false, approved: false, deviceHash: /^[A-Za-z0-9_-]{16,80}$/.test(dev) ? sha256(dev) : "", createdAt: now });
      try {
        await sendMail(email, APP_URL + "/email-signin.html?rjlink=" + token + "&rje=" + encodeURIComponent(email));
      } catch (e) {
        console.error("Gmail send failed:", e && e.message);
        return fail(500, "Could not send the email. Check the Gmail address and App password.", "server/mail-failed");
      }
      return res.status(200).json({ ok: true });
    }

    const snap = await ref.get();
    const d = snap.exists ? snap.data() : null;
    if (!d || d.used || now > d.exp) return fail(400, "This code has expired or was already used. Request a new one.", "expired");

    if (b.action === "approve") {
      if (!b.token || !safeEq(sha256(b.token), d.tokenHash)) return fail(400, "Invalid link.", "bad-link");
      await ref.update({ approved: true });
      return res.status(200).json({ ok: true, code: codeFromToken(String(b.token)) });
    }

    if (b.action === "check") {
      const dev = String(b.device || "");
      if (!d.deviceHash || !dev || !safeEq(sha256(dev), d.deviceHash)) return fail(400, "Invalid request.", "bad-device");
      if (!d.approved) return res.status(200).json({ pending: true });
      await ref.update({ used: true });
      const uid = await uidForEmail(email);
      const token = await admin.auth().createCustomToken(uid);
      return res.status(200).json({ token: token });
    }

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
      await ref.update({ used: true });
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
