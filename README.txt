VERSE NUMBERING / AUDIO FIX — manual upload

root/  -> copy these 2 files into your repo root (overwrite existing)
www/   -> copy the same 2 files into your repo's www/ folder (overwrite existing)

WHAT CHANGED

Gajendra Moksha Stotram (gms) — 33 shlokas, 33 audio clips (gms_1.mp3 … gms_33.mp3):
  - Shlok 14 and 15 now split onto separate pages (were merged — no blank
    line between them in the source text).
  - Shlok 22, 23, 24 now split onto three separate pages instead of one
    combined "শ্লোক ২২-২৪" page. Shlok 24's page keeps the original shared
    translation exactly as written; 22 and 23 show just their verse lines.
  - Result: page index, on-screen counter, printed shlok number, and
    audio track all match 1:1, all the way to shlok 33.

Hanuman Chalisa (hnc) — 42 audio clips total:
  - Opening doha is now its own page labeled "0" (not "1").
  - The standalone "চৌপাঈ" header page is gone — merged into chaupai 1's
    page, which is now labeled "1".
  - Chaupai 1–40 are labeled "1".."40", each matching its own audio clip.
  - The closing doha (after chaupai 40) is labeled "40.c", matching the
    42nd and final audio clip.
  - Aarti and the final "সিয়াবর রামচন্দ্রজী কী জয়" line remain as plain
    text pages with no audio player (no clips exist for them) — reachable
    only by swiping past 40.c, not by typing a number.
  - The verse-number input box is now a text field for Hanuman Chalisa
    specifically (needed to display "40.c").

npx cap sync android → gradlew assembleRelease as usual after copying.
