LEADERBOARD TIME FIX — manual upload

root/app.js -> your repo root (overwrite existing)
www/app.js  -> your www/ folder (overwrite existing)

WHAT CHANGED
pushLeaderboard()'s todayTimerSeconds now calls App.getTotalJapSecondsToday()
— the same function that drives the on-screen "Today's Jap Time" — instead
of summing only the already-flushed timerHistory*/timer28History values.

Those history buckets only update when a session pauses, a mala completes,
or the 6-second idle auto-pause fires — not continuously while you're
actively chanting. Summing them alone meant the leaderboard's time always
lagged behind whatever you'd chanted since the last flush. Your jap COUNT
never had this problem (it saves instantly on every tap), which is why the
count matched everywhere but the time didn't.

No change needed to "Session" resetting on app open — that's intentional
(app.js line ~14414, spec A), representing time chanted in the current
app-open episode specifically, separate from the full-day total.
