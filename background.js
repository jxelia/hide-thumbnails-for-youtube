// After an install or update, put the new version into open YouTube tabs.
chrome.runtime.onInstalled.addListener(() => {
  setTimeout(injectIntoOpenTabs, 3000);
});

// Chrome doesn't put a new version's content scripts into tabs that are already
// open, and the old copy is cut off (content.js notices and steps aside), so
// inject the new version: open YouTube tabs keep working without a refresh. The
// CSS goes in too, since Chrome drops the old copy's stylesheet with it.
async function injectIntoOpenTabs() {
  await registerDevAddon();
  const scripts = [
    ...(chrome.runtime.getManifest().content_scripts || []),
    ...await chrome.scripting.getRegisteredContentScripts()
  ];
  for (const cs of scripts) {
    for (const tab of await chrome.tabs.query({ url: cs.matches })) {
      if (tab.discarded) continue;
      const target = { tabId: tab.id };
      if (cs.css) chrome.scripting.insertCSS({ target, files: cs.css }).catch(() => {});
      if (cs.js) chrome.scripting.executeScript({ target, files: cs.js }).catch(() => {});
    }
  }
}

// Development: a gitignored dev/ folder (addon.js, addon.css) holds developer-only
// add-ons. When loaded unpacked and the folder exists, register it to run after
// content.js on YouTube; store installs and the release zip never have it.
async function registerDevAddon() {
  if ('update_url' in chrome.runtime.getManifest()) return;
  try {
    if (!(await fetch(chrome.runtime.getURL('dev/addon.js'))).ok) return;
  } catch (_) { return; /* no dev/ folder */ }
  const [registered] = await chrome.scripting.getRegisteredContentScripts({ ids: ['dev-addon'] });
  if (registered) return;
  const { matches } = chrome.runtime.getManifest().content_scripts[0];
  await chrome.scripting.registerContentScripts([{
    id: 'dev-addon', matches, js: ['dev/addon.js'], css: ['dev/addon.css'], runAt: 'document_start'
  }]).catch(() => {});
}
registerDevAddon();

// Development: when loaded unpacked (no update_url), reload when build.txt changes,
// so edits on disk take effect without a trip to chrome://extensions. Each page load
// pings the worker to trigger the check. The stamp seen at load is kept in session
// storage, which outlives the worker going idle but is cleared by a reload.
async function checkBuild() {
  if ('update_url' in chrome.runtime.getManifest()) return;
  try {
    const stamp = (await (await fetch(chrome.runtime.getURL('build.txt'), { cache: 'no-store' })).text()).trim();
    const { build } = await chrome.storage.session.get('build');
    if (build === undefined) await chrome.storage.session.set({ build: stamp });
    else if (stamp !== build) chrome.runtime.reload();
  } catch (_) { /* no build.txt */ }
}
chrome.runtime.onMessage.addListener((msg) => {
  if (msg === 'yfvb:checkBuild') checkBuild();
});
checkBuild();
