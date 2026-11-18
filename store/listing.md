# Chrome Web Store listing: Hide Thumbnails for YouTube

Upload: `dist/hide-thumbnails-for-youtube-1.0.0.zip` (build with `./package.sh`).

## Store listing tab

**Category:** Workflow & Planning (where the biggest YouTube distraction blockers sit: Unhook 1M users, Clean YouTube 30K. Well-being has 2.7K extensions with 1.4M users in total, median 7, per profitable.app, checked 2026-11-18)
**Language:** English

**Description:** paste `store/descriptions/<language>.txt` into the matching language in the dashboard (`en` for English, and one file for each `_locales` folder).

**Graphics:**
- Icon: `icons/icon128.png` (red #D32F2F tile, picture box with a small X over two title lines; no play triangle)
- Screenshots: at least 1, 1280×800 or 640×400 (home feed with thumbnails hidden, an reveal-button-revealed thumbnail, a Shorts shelf with hidden thumbnails)
- Small promo tile (440×280): optional

## Privacy practices tab

**Single purpose:** Hides video and Shorts thumbnails, hover previews, Sponsored tile images and post images on YouTube behind a click-to-reveal button, so users browse by title and text.

**Permission justifications** (the release zip asks for `scripting` only; package.sh drops `storage`, which only the dev reload uses):
- `scripting`: After the extension is installed or updated, it adds its stylesheet and script to YouTube tabs that are already open, so thumbnails are hidden there without the user reloading the page. It is used for nothing else.
- Host permissions (`www.youtube.com`, `youtube.com`, `m.youtube.com`): The extension only works on YouTube. Its content script and stylesheet run on these pages to hide thumbnails and add the show button to each video. It reads no data and makes no network requests.

**Remote code:** No, I am not using remote code.

**Data usage:** collects none of the listed data types. Tick all three certifications (not sold, not used for unrelated purposes, not used for credit).

**Privacy policy URL:** https://github.com/jxelia/hide-thumbnails-for-youtube#notes (README line: collects no data, no network requests)
