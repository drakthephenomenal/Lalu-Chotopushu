#!/usr/bin/env python3
"""
add_radha_chalisa.py
Run from the repo root:  python3 add_radha_chalisa.py

Adds "Shri Radha Chalisa" (id: rdc) as a new single-view stotram —
same pattern as Achyutashtakam/Rudrashtakam/Ardhanarishwar/Hanuman
Chalisa: whole lyrics on one page, single full-recitation audio file.

Touches 4 files (root + www/ copies, same as every other stotram patch):
  stotrams.js       — STLIST entry + LYRICS.rdc text
  www/stotrams.js   — same
  app.js            — SINGLE_VIEW_IDS + _AUDIO_STOTRAMS.rdc
  www/app.js        — same

Expected audio file once you have it: audio/rdc_1.mp3 (and www/audio/rdc_1.mp3)
Safe to re-run: it asserts each anchor is found exactly once and will
stop with a clear error instead of silently corrupting anything if the
files have since diverged from what this script expects.
"""
import re
import subprocess
import sys

RDC_TEXT = """
।। দোহা ।।
শ্রী রাধে বৃষভানুজা, ভক্তনি প্রাণাধার ।
বৃন্দাবিপিন বিহারিণী, প্রাণাবৌ বারম্বার ।।

জৈস তৈস রাবরৌ, কৃষ্ণ প্রিয় সুখধাম ।
চরণ শরণ নিজ দীজিয়ে সুন্দর সুখদ ললাম ।।

।। চৌপাই ।।

জয় বৃষভানু কুঁবরি শ্রী শ্যামা, কীরতি নন্দিনী শোভা ধামা ।
নিত্য বিহারিণী রস বিস্তারিণী, অমিত মোদ মঙ্গল দাতারা ।। ১।।

রাম বিলাসিনী রস বিস্তারিণী সহচরি সুভগ যূথ মন ভাবনী ।।
করুণা সাগর হিয় উমঙ্গিনী, ললিতাদিক সখিয়ান কী সঙ্গিনী ।।২।।

দিনকর কন্যা কুল বিহারিণী, কৃষ্ণ প্রাণ প্রিয় হিয় হুলসাবনী ।
নিত্য শ্যাম তুমহারৌ গুণ গাবৈ, রাধা রাধা কহি হরশাবৈ ।।৩।।

মুরলি মেঁ নিত নাম উচারেঁ, তুম কারণ লীলা বপু ধারেঁ ।
প্রেম স্বরূপিণী অতি সুকুমারী, শ্যাম প্রিয়া বৃষভানু দুলারী ।।৪।।

নবল কিশোরী অতি ছবি ধামা, হুতি লঘু লগৈ কোটি রতি কামা ।
গৌরাঙ্গী শশী নিন্দক বন্দনা, সুভগ চপল অনিয়ারে নয়না ।।৫।।

জাবক যুত যুগ পঙ্কজ চরণা, নুপুর ধুনী প্রীতম মন হরনা ।
সন্তত সহচরী সেবা করহিঁ, মহা মোদ মঙ্গল মন ভরহিঁ ।।৬।।

রসিকল জীবন প্রাণ অধারা, রাধা নাম সকল সুখ সারা ।
অগম অগোচর নিত্য স্বরূপা, ধ্যান ধরত নিশিদিন ব্রজ ভূপা ।।৭।।

উপজেউ জাসু অংশ গুণ খানী, কোটিন উমা রাম ব্রহ্মিনী ।
নিত্য ধাম গোলক বিহারীন, জন রক্ষক দুঃখ দোষ নসাবনি ।।৮।।

শিব অজ মুনি সনকাদিক নারদ, পারন পাঁই শেষ শারদ ।
রাধা শুভ গুণ রূপ উজারী, নিরখি প্রসন হোত বনবারি ।।৯।।

ব্রজ জীবন ধন রাধা রানী, মহিমা অমিত ন জায় বখানি ।
প্রীতম সঙ্গ দেই গলবাহিঁ, বিহরত নিত বৃন্দাবন মাঁহি ।।১০।।

রাধা কৃষ্ণ কৃষ্ণ কহৈঁ রাধা, এক রূপ দোউ প্রীতি অগাধা ।
শ্রী রাধা মোহন মন হরনী, জন সুখ দায়ক প্রফুলিত বদনী ।।১১।।

কোটিক রূপ ধরে নন্দ নন্দা, দর্শ করন হিত গোকুল চন্দা ।
রাস কেলি করী তুহে রিঝাবেঁ, মন করো জব অতি দুঃখ পাবেঁ ।।১২।।

প্রফুলিত হোত দর্শ জব পাবেঁ, বিবিধ ভান্তি নিত বিনয় সুনাবে ।
বৃন্দারণ্য বিহারিণী শ্যামা, নাম লেত পূরণ সব কামা ।।১৩।।

কোটিন যজ্ঞ তপস্যা করহু, বিবিধ নেম ব্রতহিয় মেঁ ধরহু ।
তঊ ন শ্যাম ভক্তহিঁ অহনাবেঁ, জব লগি রাধা নাম ন গাবেঁ ।।১৪।।

বৃন্দা বিপিন স্বামিনী রাধা, লীলা বপু তব অমিত অগাধা ।
স্বয়ং কৃষ্ণ পাবৈ নহিঁ পারা, অউর তুম্হেঁ কো জানন হারা ।।১৫।।

শ্রী রাধা রস প্রীতি অভেদা, সাদর গান করত নিত বেদা ।
রাধা ত্যাগী কৃষ্ণ ক ভাজিহৈঁ, তে সপনেহুঁ জগ জলধি ন তরিহৈঁ ।।১৬।।

কীরতি হুঁবারী লড়িকী রাধা, সুমিরত সকল মিটহিঁ ভব বাধা ।
নাম অমঙ্গল মূল নসাবন, ত্রিবিধ তাপ হর হরি মনভাবনা ।।১৭।।

রাধা নাম পরম সুখদাই, ভজতহিঁ কৃপা করহিঁ য়দুরাই ।
য়শুমতী নন্দন পীছে ফিরহৈ, জী কোঊ রাধা নাম সুমিরিহৈ ।।১৮।।

রাস বিহারিণী শ্যামা প্যায়ারি, করহু কৃপা বরসানে বারী ।
বৃন্দাবন হৈ শরণ তিহারী, জয় জয় জয় বৃষভানু দুলারী ।।১৯।।

।। দোহা ।।

শ্রী রাধা সর্বেশ্বরী, রসিকেশ্বর ঘনশ্যাম।
করহুঁ নিরন্তর বাস মৈ, শ্রী বৃন্দাবন ধাম ।।
""".strip("\n")

STOTRAM_FILES = ["stotrams.js", "www/stotrams.js"]
APP_FILES = ["app.js", "www/app.js"]


def build_lyrics_js():
    blocks = [b.strip("\n") for b in re.split(r"\n\s*\n", RDC_TEXT) if b.strip()]
    escaped = [b.replace("\n", "\\n") for b in blocks]
    return "rdc:`" + "\\n\\n".join(escaped) + "`,\n"


def patch_stotrams_file(path):
    with open(path, encoding="utf-8") as fh:
        content = fh.read()

    # 1) STLIST entry
    old_stlist = "  {id:'ach',name:'অচ্যুতাষ্টকম্',sub:'শ্রীমদ্‌ শঙ্করাচার্য বিরচিত'}\n];"
    new_stlist = (
        "  {id:'ach',name:'অচ্যুতাষ্টকম্',sub:'শ্রীমদ্‌ শঙ্করাচার্য বিরচিত'},\n"
        "  {id:'rdc',name:'শ্রী রাধা চালীসা',sub:'রাধা রানীর চালীসা'}\n"
        "];"
    )
    n = content.count(old_stlist)
    if n != 1:
        raise SystemExit(f"[{path}] STLIST anchor found {n} times (expected 1) — file may have diverged, aborting.")
    content = content.replace(old_stlist, new_stlist, 1)

    # 2) LYRICS.rdc entry
    lyrics_anchor = "const LYRICS = {\n"
    n = content.count(lyrics_anchor)
    if n != 1:
        raise SystemExit(f"[{path}] LYRICS anchor found {n} times (expected 1) — aborting.")
    content = content.replace(lyrics_anchor, lyrics_anchor + "  " + build_lyrics_js(), 1)

    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)
    print(f"  updated {path}")


def patch_app_file(path):
    with open(path, encoding="utf-8") as fh:
        content = fh.read()

    # 1) Single-view id
    old_single = 'const SINGLE_VIEW_IDS = ["ach", "rds", "ans", "hnc"];'
    new_single = 'const SINGLE_VIEW_IDS = ["ach", "rds", "ans", "hnc", "rdc"];'
    n = content.count(old_single)
    if n != 1:
        raise SystemExit(f"[{path}] SINGLE_VIEW_IDS anchor found {n} times (expected 1) — aborting.")
    content = content.replace(old_single, new_single, 1)

    # 2) Audio config — single full-recitation track, same as ach/rds/ans
    old_audio = '  ach: { prefix: "ach" },\n'
    new_audio = old_audio + '  rdc: { prefix: "rdc" },\n'
    n = content.count(old_audio)
    if n != 1:
        raise SystemExit(f"[{path}] _AUDIO_STOTRAMS anchor found {n} times (expected 1) — aborting.")
    content = content.replace(old_audio, new_audio, 1)

    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)
    print(f"  updated {path}")


def main():
    print("── Adding Radha Chalisa (rdc) ─────────────────────────────")
    for path in STOTRAM_FILES:
        patch_stotrams_file(path)
    for path in APP_FILES:
        patch_app_file(path)

    print("── Syntax-checking touched files ──────────────────────────")
    for path in STOTRAM_FILES + APP_FILES:
        result = subprocess.run(["node", "--check", path])
        if result.returncode != 0:
            raise SystemExit(f"node --check failed on {path} — see error above.")
        print(f"  {path}: OK")

    print("")
    print("✅ Done. Radha Chalisa added as a single-view stotram (id: rdc).")
    print("   Drop the recitation in as audio/rdc_1.mp3 (and www/audio/rdc_1.mp3)")
    print("   for the player to pick it up.")
    print("   Rebuild the APK (bash build-android.sh) to ship it to the app.")


if __name__ == "__main__":
    main()
