// Lets the worker notice a new build.txt during development (see background.js).
// First, so an error further down can't stop the next build from loading.
try { chrome.runtime.sendMessage('yfvb:checkBuild').catch(() => {}); } catch (_) { /* extension reloaded */ }

// Wrapped so a second copy (injected into open tabs after an update, see
// background.js) doesn't clash with one already on the page.
(() => {
  // An orphaned copy from before an update steps aside when asked (see
  // stepAside); a live one stays, and this copy bows out. DOM events reach
  // every copy, whichever isolated world it runs in.
  document.dispatchEvent(new Event('yfvb:takeover'));
  if (window.__yfvbLoaded) return;
  window.__yfvbLoaded = true;

  // End-of-video cards inside the player: the creator's end-screen cards and
  // the suggestion grid (modern and older). The player has no custom elements
  // to key on, so these are its long-standing ytp- classes. Their thumbnails
  // are CSS backgrounds.
  const PLAYER_CARD_SELECTOR = '.ytp-ce-video, .ytp-ce-playlist, .ytp-modern-videowall-still, .ytp-videowall-still, .ytp-autonav-endscreen-link-container';
  const PLAYER_TITLE_SELECTOR = '.ytp-modern-videowall-still-info-title, .ytp-videowall-still-info-title, .ytp-ce-video-title, .ytp-ce-playlist-title';

  // Feed items on www.youtube.com and m.youtube.com. Keep in sync with content.css.
  const ITEM_SELECTOR = [
    'yt-lockup-view-model',
    'ytm-shorts-lockup-view-model',
    'ytd-video-renderer',
    'ytd-rich-grid-media',
    'ytd-compact-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-playlist-renderer',
    'ytd-compact-playlist-renderer',
    'ytd-radio-renderer',
    'ytd-compact-radio-renderer',
    'ytd-playlist-video-renderer',
    'ytd-playlist-panel-video-renderer',
    'ytd-reel-item-renderer',
    'ytd-backstage-post-renderer',
    'ytd-post-renderer',
    'ytm-video-with-context-renderer',
    'ytm-compact-video-renderer',
    'ytm-compact-playlist-renderer',
    'ytm-playlist-video-renderer',
    'ytm-backstage-post-renderer',
    'ytm-post-renderer',
    'top-landscape-image-layout-view-model',
    'compact-landscape-no-button-layout-view-model',
    'mini-game-card-view-model',
    PLAYER_CARD_SELECTOR
  ].join(',');

  // Thumbnails, which content.css already hides. Here they're used to find the
  // wrapper around each one, and to decide whether an item needs a button.
  const THUMB_SELECTOR = [
    'ytd-thumbnail',
    'ytd-playlist-thumbnail',
    'yt-thumbnail-view-model',
    'yt-collection-thumbnail-view-model',
    'ytm-thumbnail-cover',
    'ytm-playlist-thumbnail'
  ].join(',');

  // Post attachments content.css hides. An attached video is a nested item.
  const POST_MEDIA_SELECTOR = [
    'ytd-backstage-image-renderer',
    'ytd-post-multi-image-renderer',
    'ytm-backstage-image-renderer',
    'ytm-post-multi-image-renderer',
    'ytd-backstage-poll-renderer img',
    'ytm-backstage-poll-renderer img',
    'top-landscape-image-layout-view-model > :has(ad-image-view-model)',
    'compact-landscape-no-button-layout-view-model > :has(ad-image-view-model)',
    // Playables: the picture block (blurred backdrop, picture, Play button).
    'mini-game-card-view-model > div > :has(> a img)',
    '.ytp-ce-covering-image',
    '.ytp-modern-videowall-still-image',
    '.ytp-videowall-still-image',
    '.ytp-autonav-endscreen-upnext-thumbnail'
  ].join(',');

  // The item's title and details; a thumbnail's wrapper never contains these.
  const TEXT_SELECTOR = 'h3, h4, #video-title, #meta, #details, yt-lockup-metadata-view-model, feed-ad-metadata-view-model, [role="heading"]';

  // Where the ⋮ menu lives, most specific first: posts, the older ytd-* items,
  // m.youtube.com items, then lockups and Sponsored tiles (the wrapper around
  // their menu button) and Shorts lockups, whose menu has no element of its own.
  const MENU_SELECTORS = [
    '#action-menu',
    '#menu',
    'ytm-bottom-sheet-renderer',
    'ytm-menu-renderer',
    'yt-lockup-metadata-view-model > :has(> button-view-model)',
    'feed-ad-metadata-view-model > :has(> button-view-model)',
    // Playables: the ⋮ beside the title link.
    'mini-game-card-view-model > div > div:has(> a h3) > :has(> button-view-model)',
    // A lockup with no menu (the Liked videos playlist) still has the empty slot.
    'yt-lockup-metadata-view-model > :not(:first-child):empty',
    // Shorts: the block after the thumbnail link holds the text, then the ⋮'s
    // wrapper (the reveal button is a bare button, so it never matches).
    'ytm-shorts-lockup-view-model > a + div > div:has(> button)'
  ];


  /* ---------- Items ---------- */

  // The thumbnail element can sit inside a link or frame that keeps its size
  // once the thumbnail is gone. Walk up while the ancestor adds no text of its
  // own (the duration badge is the thumbnail's own text) and holds no title, and
  // mark the largest such wrapper. Class names change often, so this is
  // structural. Skipped until the title has rendered, so a half-built item
  // can't be mistaken for one big thumbnail.
  function markThumbnails(item) {
    if (!item.querySelector('h3, #video-title, feed-ad-metadata-view-model')) return;
    item.querySelectorAll(THUMB_SELECTOR).forEach((thumb) => {
      if (thumb.closest('.yfvb-media') || thumb.closest(ITEM_SELECTOR) !== item) return;
      const text = thumb.textContent.trim();
      let block = thumb;
      let node = thumb.parentElement;
      while (node && node !== item && !node.querySelector(TEXT_SELECTOR) && node.textContent.trim() === text) {
        block = node;
        node = node.parentElement;
      }
      if (block !== thumb) block.classList.add('yfvb-media');
    });
  }

  function hasMedia(item) {
    return !!item.querySelector(THUMB_SELECTOR + ', ' + POST_MEDIA_SELECTOR + ', .yfvb-media');
  }

  // YouTube reuses item elements for other videos (sidebar on a new watch page,
  // feed refreshes), so a reveal is tied to the video's link and dropped when
  // that changes.
  function itemKey(item) {
    // Ads link off-site, so they fall back to their first link, then their text.
    const link = item.querySelector('a[href*="/post/"], a[href*="/watch"], a[href*="/shorts/"], a[href*="list="]') ||
      item.querySelector('a[href]') || (item.matches('a[href]') ? item : null);
    return link ? link.getAttribute('href') : item.textContent.trim().slice(0, 100);
  }

  // Localised UI text. An orphaned copy (extension reloaded) can't reach chrome.i18n, so fall back to English.
  function msg(key, fallback) {
    try { return chrome.i18n.getMessage(key) || fallback; } catch (_) { return fallback; }
  }

  function setIcon(button, revealed) {
    button.classList.toggle('content-visible', revealed);
    button.setAttribute('aria-pressed', String(revealed));
    button.setAttribute('aria-label', revealed ? msg('hideMedia', 'Hide media') : msg('showHiddenMedia', 'Show hidden media'));
    button.title = revealed ? msg('hideMedia', 'Hide media') : msg('showMedia', 'Show media');
  }

  // Hidden players can keep playing; best-effort pause on re-hide.
  function pauseMedia(root) {
    root.querySelectorAll('video, audio').forEach((el) => {
      try { el.pause(); } catch (_) { /* ignore */ }
    });
  }

  // A post's attached video is an item of its own; it follows the post.
  function setRevealed(item, revealed) {
    [item, ...item.querySelectorAll(ITEM_SELECTOR)].forEach((el) => {
      if (revealed) el.setAttribute('data-yfvb-revealed', itemKey(el));
      else el.removeAttribute('data-yfvb-revealed');
    });
  }

  function toggleItem(item, button) {
    const revealed = !item.hasAttribute('data-yfvb-revealed');
    setRevealed(item, revealed);
    setIcon(button, revealed);
    if (!revealed) pauseMedia(item);
    // The row's height changes, so the reveal button may need lining up with the ⋮ again.
    placeButton(item, button);
    const panel = item.closest('ytd-playlist-panel-renderer');
    if (panel) processPlaylistHeader(panel);
  }

  // Buttons this script made. A copy of the markup (e.g. restored on Back)
  // brings buttons back without their click handlers; those get replaced.
  const ownButtons = new WeakSet();

  function findButton(item) {
    const button = [...item.querySelectorAll('.yfvb-btn')].find((b) => b.closest(ITEM_SELECTOR) === item);
    if (!button || ownButtons.has(button)) return button || null;
    button.remove();
    return null;
  }

  // YouTube enforces Trusted Types, so icons are built node by node, never from
  // markup strings.
  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    return el;
  }

  // Reveal button icon: a flat rounded bar, the same in both states.
  function revealIcon() {
    const svg = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    svg.appendChild(svgEl('line', {
      x1: 5, y1: 12, x2: 19, y2: 12,
      stroke: 'currentColor', 'stroke-width': 2.5, 'stroke-linecap': 'round'
    }));
    return svg;
  }

  function createButton(onToggle, icon = revealIcon()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yfvb-btn';
    button.appendChild(icon);

    // Items are links (or tap targets on m.youtube.com); keep the click from
    // opening the video.
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onToggle();
    });
    // The player acts on press and release too (autoplay's Up next card opens
    // its video on them), so those stop at player buttons.
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'touchstart', 'touchend']) {
      button.addEventListener(type, (e) => {
        if (button.classList.contains('yfvb-player-btn')) e.stopPropagation();
      });
    }
    ownButtons.add(button);
    return button;
  }

  function findMenu(item) {
    for (const selector of MENU_SELECTORS) {
      const menu = [...item.querySelectorAll(selector)].find((el) =>
        el.closest(ITEM_SELECTOR) === item && !el.closest('.yfvb-media') && !el.contains(item.querySelector('.yfvb-btn')));
      if (menu) return menu;
    }
    return null;
  }

  // The button goes just before the ⋮ menu, so it sits with the item's actions.
  // Falls back to just after the title.
  function placeButton(item, button) {
    // End-of-video cards have no ⋮. content.css places the button at the
    // right end of the channel and views lines (modern grid), else of the
    // title's first line; it goes right after the line it's keyed on.
    if (item.matches(PLAYER_CARD_SELECTOR)) {
      button.classList.add('yfvb-player-btn');
      // End-screen cards: inside the duration label, so CSS can sit it just
      // left of the label whatever the label's width.
      const duration = item.querySelector('.ytp-ce-video-duration');
      if (duration) {
        if (button.parentElement !== duration) duration.appendChild(button);
        return;
      }
      // Autoplay's Up next card: just after its channel line (filled in only
      // when the card shows, so not chosen by text); CSS centres it there.
      const upNextAuthor = item.querySelector('.ytp-autonav-endscreen-upnext-author');
      if (upNextAuthor) {
        if (button.previousElementSibling !== upNextAuthor) upNextAuthor.insertAdjacentElement('afterend', button);
        return;
      }
      const anchor = item.querySelector('.ytp-modern-videowall-still-view-count-and-date-info') ||
        item.querySelector(PLAYER_TITLE_SELECTOR);
      if (!anchor) return;
      if (button.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', button);
      return;
    }
    const menu = findMenu(item);
    if (menu) {
      // Cards lay out again when their page is shown or the grid reflows;
      // re-place then (see sizeWatch).
      watchSize(item);
      // On a hidden page (one navigated away from) nothing can be measured;
      // keep the placement until it shows again.
      if (button.isConnected && !item.getClientRects().length) return;
      if (button.nextElementSibling !== menu) {
        if (button.parentElement) leaveAbsMode(button.parentElement);
        menu.insertAdjacentElement('beforebegin', button);
      }
      besideFloatingMenu(button, menu);
    } else if (!button.isConnected) {
      item.querySelector('h3, #video-title')?.insertAdjacentElement('afterend', button);
    }
  }

  // Lockup menus are absolutely positioned in the item's top or bottom right
  // corner (the sidebar's only appears on hover), so they take no room in the
  // row and would cover the reveal button. Keep the menu's width clear to the reveal button's right
  // (less a few px, so the two hover circles sit close without touching) and line
  // it up with the menu's corner. The menu can be placed past the row's edge (10px
  // on the home grid), so the gap is measured from where it really is, not just
  // its width. Any menu, floating or not, then gets the reveal button nudged so its centre
  // is level with the ⋮ button's: on search results the ⋮ stays in the row but
  // pokes 11px above its 24px box, so top-aligning them leaves the reveal button 9px low.
  const FLOATING_MENU_OVERLAP = 6;
  // Room between a Shorts ⋮ and the reveal button under it. The reveal button's arrows are 20px
  // tall in its 36px circle, so this brings dots-to-button to 25px, the same as
  // button-to-dots across on search results.
  const SHORTS_BUTTON_GAP = 5;
  // Pages whose grid cards get the reveal button under the ⋮ rather than beside
  // it. There it's centred on the card's last metadata line (channel, views,
  // time), but its bar sits at least UNDER_MENU_GAP below the ⋮ dots (the
  // dots end 8px below the ⋮'s centre; the bar is UNDER_MENU_GLYPH tall,
  // content.css).
  // Keyed on the item's own page (ytd-browse page-subtype), not location: on SPA
  // navigation the URL changes while the old page is still on screen, and
  // YouTube keeps hidden copies of earlier pages.
  const UNDER_MENU_PAGES = ['home', 'subscriptions', 'you', 'channels'];
  const UNDER_MENU_PATHS = ['/', '/feed/subscriptions', '/feed/you'];
  // m.youtube.com has no ytd-browse; there the URL decides, as before.
  function onUnderMenuPage(el) {
    const page = el.closest('ytd-browse');
    return page ? UNDER_MENU_PAGES.includes(page.getAttribute('page-subtype'))
      : UNDER_MENU_PATHS.includes(location.pathname);
  }
  const UNDER_MENU_GAP = 4;
  const UNDER_MENU_GLYPH = 2;
  // How far a Shorts reveal button may poke below its block: inside content.css's 12px
  // clip margin and the home shelf's 14px clip, with the hover circle intact.
  // Two-line Shorts poke out 10.5px and need no extra room.
  const SHORTS_BUTTON_SPILL = 11;

  // Undoes the Shorts mode below on a block the reveal button is leaving or no longer
  // floats in: the flag (and with it the CSS clip) and the room made for the reveal button.
  function leaveAbsMode(block) {
    block.removeAttribute('data-yfvb-reveal-abs');
    if (block.style.minHeight) block.style.minHeight = '';
  }

  function besideFloatingMenu(button, menu) {
    const style = getComputedStyle(menu);
    const target = (menu.querySelector('button') || menu).getBoundingClientRect();
    // Older grid cards (History on /feed/you) keep a 0px-wide #menu whose ⋮
    // is absolutely placed and spills out of it; that floats too.
    // Gaming grid cards keep a full-width, 0px-tall #menu row with the ⋮
    // absolutely placed above it; that floats too.
    const floating = style.position === 'absolute' || menu.offsetWidth < target.width ||
      (menu.offsetHeight < target.height && target.bottom <= menu.getBoundingClientRect().top);

    // Shorts lockups put the floating ⋮ in a plain block, not a flex row, so the
    // reveal button would drop onto its own line. Float it just under the ⋮ instead, in
    // the column YouTube already keeps clear for the ⋮, so the title keeps its
    // full width (CSS makes it absolute, via data-yfvb-reveal-abs).
    const parent = button.parentElement;
    const parentStyle = getComputedStyle(parent);
    if (floating && style.position === 'absolute' && menu.offsetParent === parent &&
        !parentStyle.display.includes('flex')) {
      parent.setAttribute('data-yfvb-reveal-abs', '');
      // Centred on the text's last line (the view count), but never higher than
      // SHORTS_BUTTON_GAP under the ⋮: a one-line title puts the views beside the ⋮, and the
      // reveal button then sits on a row of its own below them, as far under the ⋮ as on
      // two-line Shorts. The reveal button is centred under the ⋮ dots, so the two stack
      // as one column.
      const text = parent.firstElementChild;
      const line = text !== button && text?.lastElementChild;
      const lineBox = line && line.getBoundingClientRect();
      const belowMenu = menu.offsetTop + menu.offsetHeight + SHORTS_BUTTON_GAP;
      const top = Math.round(2 * (lineBox && lineBox.height
        ? Math.max(belowMenu,
          lineBox.top + lineBox.height / 2 - parent.getBoundingClientRect().top - button.offsetHeight / 2)
        : belowMenu)) / 2;
      const right = Math.round(parent.clientWidth - (menu.offsetLeft + menu.offsetWidth / 2) - button.offsetWidth / 2) + 'px';
      if (button.style.top !== top + 'px') button.style.top = top + 'px';
      if (button.style.right !== right) button.style.right = right;
      // The block clips its overflow, so grow it until the reveal button pokes out no
      // more than SHORTS_BUTTON_SPILL (one-line titles; two-line ones already fit).
      // The text sits at the block's top, so this never moves what's measured.
      // top is from the padding edge; min-height sizes the content box.
      const padding = parseFloat(parentStyle.paddingTop) + parseFloat(parentStyle.paddingBottom);
      const minHeight = Math.max(0, top + button.offsetHeight - SHORTS_BUTTON_SPILL - padding) + 'px';
      if (parent.style.minHeight !== minHeight) parent.style.minHeight = minHeight;
      button.style.marginRight = button.style.translate = button.style.alignSelf = button.style.left = '';
      button.removeAttribute('data-yfvb-under-menu');
      return;
    }
    leaveAbsMode(parent);

    // Home, Subscriptions, You and channel pages: the reveal button floats centred under the
    // top-right ⋮, so the title keeps its full width.
    if (floating && target.height && onUnderMenuPage(menu) &&
        !(parseFloat(style.bottom) < parseFloat(style.top))) {
      button.setAttribute('data-yfvb-under-menu', '');
      button.style.marginRight = button.style.translate = button.style.alignSelf = button.style.right = '';
      const box = button.offsetParent;
      if (box) {
        const origin = box.getBoundingClientRect();
        const minCentre = target.top + target.height / 2 + 8 + UNDER_MENU_GAP + UNDER_MENU_GLYPH / 2;
        const line = parent.querySelector('yt-content-metadata-view-model')?.lastElementChild ||
          parent.querySelector('#metadata-line');
        const lineBox = line?.getBoundingClientRect();
        const centre = lineBox?.height ? Math.max(minCentre, lineBox.top + lineBox.height / 2) : minCentre;
        const top = Math.round(centre - origin.top - box.clientTop - button.offsetHeight / 2) + 'px';
        const left = Math.round(target.left + target.width / 2 - origin.left - box.clientLeft - button.offsetWidth / 2) + 'px';
        if (button.style.top !== top) button.style.top = top;
        if (button.style.left !== left) button.style.left = left;
      }
      return;
    }
    button.removeAttribute('data-yfvb-under-menu');
    button.style.top = button.style.right = button.style.left = '';
    const align = floating && parseFloat(style.bottom) < parseFloat(style.top) ? 'flex-end' : '';
    if (button.style.alignSelf !== align) button.style.alignSelf = align;

    let gap = floating ? Math.max(0, menu.offsetWidth - FLOATING_MENU_OVERLAP) : 0;
    if (floating && target.width) {
      const own = button.getBoundingClientRect();
      const current = parseFloat(button.style.marginRight) || 0;
      gap = Math.max(0, Math.round(current + own.right - target.left - FLOATING_MENU_OVERLAP));
    }
    gap = floating ? gap + 'px' : '';
    if (button.style.marginRight !== gap) button.style.marginRight = gap;

    let shift = '';
    if (target.height) {
      const own = button.getBoundingClientRect();
      const current = parseFloat(button.style.translate.split(' ')[1]) || 0;
      const offset = Math.round(target.top + target.height / 2 - (own.top - current + own.height / 2));
      if (offset) shift = `0px ${offset}px`;
    }
    if (button.style.translate !== shift) button.style.translate = shift;
  }

  function processItem(item) {
    // A nested item (a post's attached video) is handled by its post.
    if (item.parentElement?.closest(ITEM_SELECTOR)) return;

    const revealedFor = item.getAttribute('data-yfvb-revealed');
    if (revealedFor !== null && revealedFor !== itemKey(item)) setRevealed(item, false);

    markThumbnails(item);
    if (!hasMedia(item)) return;

    let button = findButton(item);
    if (!button) button = createButton(() => toggleItem(item, button));
    setIcon(button, item.hasAttribute('data-yfvb-revealed'));
    // YouTube renders the menu after the rest of the item, so re-place on later passes.
    placeButton(item, button);
  }

  // Reveal button offsets are measured px, so a card that changes size (its page
  // shown again, the grid reflowing to another column count) is placed again.
  const watched = new WeakSet();
  const sizeWatch = new ResizeObserver((entries) => {
    for (const e of entries) pending.add(e.target);
    schedule();
  });
  function watchSize(item) {
    if (watched.has(item)) return;
    watched.add(item);
    sizeWatch.observe(item);
  }

  /* ---------- Watch-page playlist panel ---------- */

  // A reveal button left of the panel header's ⋮ reveals or hides every row.
  // It shows revealed only while every row with media is revealed, so a row's
  // own button changes it too (toggleItem).
  function playlistRows(panel) {
    return [...panel.querySelectorAll('ytd-playlist-panel-video-renderer')].filter(hasMedia);
  }

  function processPlaylistHeader(panel) {
    // A Mix has an empty ⋮ slot; the button then goes just left of the X, once
    // the X has its icon (its box shows up empty first, during page load).
    let menu = panel.querySelector('#playlist-actions #end-actions > #overflow-menu');
    if (!menu?.firstElementChild) {
      menu = panel.querySelector('#header-top-row > #trailing-button');
      if (!menu?.querySelector('svg')) menu = null;
    }
    let button = [...panel.querySelectorAll('.yfvb-playlist-all-btn')].find((b) => ownButtons.has(b));
    panel.querySelectorAll('.yfvb-playlist-all-btn').forEach((b) => { if (b !== button) b.remove(); });
    if (!menu) { button?.remove(); return; }
    if (!button) {
      button = createButton(() => {
        const rows = playlistRows(panel);
        const revealed = !rows.every((row) => row.hasAttribute('data-yfvb-revealed'));
        rows.forEach((row) => {
          setRevealed(row, revealed);
          if (!revealed) pauseMedia(row);
          const rowButton = findButton(row);
          if (rowButton) { setIcon(rowButton, revealed); placeButton(row, rowButton); }
        });
        setIcon(button, revealed);
      });
      button.classList.add('yfvb-playlist-all-btn');
    }
    button.classList.toggle('yfvb-beside-close', menu.id === 'trailing-button');
    const rows = playlistRows(panel);
    setIcon(button, rows.length > 0 && rows.every((row) => row.hasAttribute('data-yfvb-revealed')));
    if (button.nextElementSibling !== menu) menu.insertAdjacentElement('beforebegin', button);
  }

  /* ---------- Local add-ons ---------- */

  // A gitignored dev/ folder can add its own pass (background.js registers it in
  // unpacked builds only; it's never in the repo or the release zip). Each pass
  // runs after the items, with the helpers it needs.
  function runAddons() {
    for (const pass of Object.values(window.__yfvbAddons || {})) {
      try { pass({ createButton, svgEl, ownButtons, msg }); } catch (_) { /* add-on error */ }
    }
  }

  /* ---------- Driver ---------- */

  function processAll() {
    document.querySelectorAll(ITEM_SELECTOR).forEach(processItem);
    runAddons();
    document.querySelectorAll('ytd-playlist-panel-renderer').forEach(processPlaylistHeader);
  }

  // The outermost item around a node (a post, not its attached video).
  function outerItem(node) {
    let item = node.closest(ITEM_SELECTOR);
    for (let up = item?.parentElement?.closest(ITEM_SELECTOR); up; up = up.parentElement?.closest(ITEM_SELECTOR)) item = up;
    return item;
  }

  // Mutations only touch the items they land in (or bring in), so a pass skips
  // the rest of a long feed. Navigation, resizing and Back still redo them all.
  const pending = new Set();
  let fullPass = false;

  function processPending() {
    if (fullPass) {
      processAll();
    } else {
      const items = new Set();
      for (const node of pending) {
        if (!node.isConnected) continue;
        const item = outerItem(node);
        if (item) items.add(item);
        else node.querySelectorAll(ITEM_SELECTOR).forEach((el) => items.add(el));
      }
      items.forEach(processItem);
      runAddons();
      document.querySelectorAll('ytd-playlist-panel-renderer').forEach(processPlaylistHeader);
    }
    pending.clear();
    fullPass = false;
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      processPending();
    });
  }

  function scheduleProcess() {
    fullPass = true;
    schedule();
  }

  // The video player rewrites its own controls and captions constantly; that's
  // never a new item.
  const PLAYER_SELECTOR = '.html5-video-player';

  let observer = null;

  function init() {
    processAll();
    // Infinite scroll, SPA navigation and late-rendering menus all arrive as DOM
    // additions; batch them into one pass per frame.
    observer = new MutationObserver((mutations) => {
      let added = false;
      for (const m of mutations) {
        if (!m.addedNodes.length || !m.target.closest) continue;
        if (m.target.closest(PLAYER_SELECTOR)) {
          // Except the end-of-video cards it adds.
          for (const node of m.addedNodes) {
            if (node.nodeType === 1 && !node.classList.contains('yfvb-btn') &&
                (node.matches(PLAYER_CARD_SELECTOR) || node.querySelector(PLAYER_CARD_SELECTOR))) {
              pending.add(node);
              added = true;
            }
          }
          continue;
        }
        pending.add(m.target);
        added = true;
      }
      if (added) schedule();
    });
    observer.observe(document, { childList: true, subtree: true });
    window.addEventListener('pageshow', scheduleProcess);
    window.addEventListener('popstate', scheduleProcess);
    // Reveal button offsets are measured px, so a resize (or zoom) re-measures them.
    window.addEventListener('resize', scheduleProcess);
    // YouTube's own SPA navigation event.
    document.addEventListener('yt-navigate-finish', scheduleProcess);
    // An add-on that loads after this copy asks for a pass.
    document.addEventListener('yfvb:addon', scheduleProcess);
  }

  // m.youtube.com autoplays the feed video in view, moving a preview player into
  // that item; hover previews work the same way on some desktop layouts. While
  // its item is hidden, stop it. 'play' doesn't bubble, so listen in the capture
  // phase.
  function pauseHidden(e) {
    const item = e.target.closest?.(ITEM_SELECTOR);
    if (item && !item.closest('[data-yfvb-revealed]')) e.target.pause();
  }
  document.addEventListener('play', pauseHidden, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // After the extension is updated or reloaded, this copy is cut off from it but
  // keeps running, and would fight the new copy background.js injects over the
  // buttons. Stop, remove its buttons and step aside; the new copy starts clean.
  // Reveal attributes stay, so the new copy keeps them.
  function isAlive() {
    try { return !!chrome.runtime?.id; } catch (_) { return false; /* context invalidated */ }
  }

  function stepAside() {
    if (isAlive()) return;
    clearInterval(orphanWatch);
    document.removeEventListener('yfvb:takeover', stepAside);
    observer?.disconnect();
    sizeWatch.disconnect();
    document.removeEventListener('DOMContentLoaded', init);
    window.removeEventListener('pageshow', scheduleProcess);
    window.removeEventListener('popstate', scheduleProcess);
    window.removeEventListener('resize', scheduleProcess);
    document.removeEventListener('yt-navigate-finish', scheduleProcess);
    document.removeEventListener('yfvb:addon', scheduleProcess);
    document.removeEventListener('play', pauseHidden, true);
    document.querySelectorAll('.yfvb-btn').forEach((b) => { if (ownButtons.has(b)) b.remove(); });
    window.__yfvbLoaded = false;
  }
  const orphanWatch = setInterval(stepAside, 1500);
  // A copy injected after an update asks right away (timers in background tabs
  // can run only once a minute), so it never finds the old copy still in place.
  document.addEventListener('yfvb:takeover', stepAside);

})();
