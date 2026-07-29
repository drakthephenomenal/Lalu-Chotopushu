import sys

path = "background/runner.js"
with open(path, "r", encoding="utf-8") as f:
    src = f.read()

# ── Edit 1: add a kvSet helper right after kvGet ──
anchor1 = '''async function kvGet(key) {
  try {
    const r = await CapacitorKV.get({ key });
    return r && r.value != null ? r.value : null;
  } catch (_) {
    return null;
  }
}'''

replacement1 = anchor1 + '''

async function kvSet(key, value) {
  try {
    await CapacitorKV.set({ key, value });
  } catch (_) {}
}'''

if anchor1 not in src:
    print("ERROR: kvGet anchor not found — edit 1 skipped. File may differ from expected.")
    sys.exit(1)
src = src.replace(anchor1, replacement1, 1)

# ── Edit 2: add time-of-day + once-per-day gating around the Drive upload ──
anchor2 = '''    try {
      const driveBackupJson = await kvGet("bgsync_drive_payload");
      if (driveBackupJson) {
        // No filename passed here on purpose — the Cloud Function
        // generates one from its own server clock (UTC). Device-local
        // time doesn't matter for an unattended daily backup the way it
        // does for the manual "Backup Now" button in app.js, which stamps
        // the person's own local time instead.
        const result = await callCloudFunction("driveBackupUpload", idToken, {
          backupJson: driveBackupJson,
        });
        console.log("Background Drive backup:", result && result.success ? result.filename : result);
      }
    } catch (driveErr) {'''

replacement2 = '''    try {
      const driveBackupJson = await kvGet("bgsync_drive_payload");
      if (driveBackupJson) {
        // ── Custom time-of-day gating ──
        // Chosen in Settings (saveDriveBackupTime() in app.js), staged as
        // device-local hour/minute. WorkManager wakes this task roughly
        // hourly, so a +/-35min window around the target reliably catches
        // exactly one wake per day without needing exact-minute precision.
        // bgsync_last_drive_backup_date stops a second upload if two wakes
        // land inside that window on the same day.
        const targetHour = parseInt((await kvGet("bgsync_drive_backup_hour")) ?? "3", 10);
        const targetMinute = parseInt((await kvGet("bgsync_drive_backup_minute")) ?? "0", 10);
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const targetMinutes = targetHour * 60 + targetMinute;
        const withinWindow = Math.abs(nowMinutes - targetMinutes) <= 35;

        const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
        const lastRunDate = await kvGet("bgsync_last_drive_backup_date");

        if (withinWindow && lastRunDate !== today) {
          // No filename passed here on purpose — the Cloud Function
          // generates one from its own server clock (UTC). Device-local
          // time doesn't matter for an unattended daily backup the way it
          // does for the manual "Backup Now" button in app.js, which stamps
          // the person's own local time instead.
          const result = await callCloudFunction("driveBackupUpload", idToken, {
            backupJson: driveBackupJson,
          });
          console.log("Background Drive backup:", result && result.success ? result.filename : result);
          await kvSet("bgsync_last_drive_backup_date", today);
        }
      }
    } catch (driveErr) {'''

if anchor2 not in src:
    print("ERROR: driveBackupJson anchor not found — edit 2 skipped. File may differ from expected.")
    sys.exit(1)
src = src.replace(anchor2, replacement2, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(src)

print("Both edits applied successfully.")
