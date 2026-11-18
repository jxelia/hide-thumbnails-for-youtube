## Hide Thumbnails for YouTube

Hide thumbnails and post images in YouTube. Unhide button included. [xtension](https://github.com/adxy/xtension) port.

### Install (Chromium browsers)
- Open `chrome://extensions` (or your Chromium-based browser's extensions page)
- Enable "Developer mode"
- Download the zip from the latest release on GitHub and unzip it (or clone this repo)
- Click "Load unpacked" and select this folder

### Use
- Visit `youtube.com`
- Thumbnails are hidden on all pages
- Click - button to unhide/hide a thumbnail (placed with the video's grid, typically next to ⋮ menu)
  
### Notes
- No data leaves your browser; there are no network requests
- Targets `youtube.com`, `m.youtube.com` and their subdomains
- Files: `manifest.json` (MV3), `content.js` (logic), `content.css` (hiding/styles), `background.js` (puts the new version into open YouTube tabs after an install or update; dev self-reload), `icons/`
- A YouTube port of [xtension](https://github.com/adxy/xtension) X/Twitter Feed Video Blocker.
