# Reveal button arrows icon (kept for later)

Feather maximize-2 / minimize-2 arrows with the useAnimations nudge, used on the reveal button until 2a282f8 (2026-11-17), when it became a flat bar. To bring it back: put `ICON_ARROWS` and this `revealIcon` back in content.js, the nudge into `createButton`, and the CSS into content.css. The under-the-⋮ placement then needs `UNDER_MENU_GLYPH = 19` and the `rotate: -45deg` on `.yfvb-btn[data-yfvb-under-menu] svg`.

## content.js

```js
  // Reveal button icon: Feather's maximize-2 (arrows out) while the media is
  // hidden, minimize-2 (arrows in) while it shows, with useAnimations' nudge on
  // click. Arrowheads are 4px (Feather's are 6), and minimize-2's sit 1.3px
  // further from the centre than Feather's, so the inward nudge never makes
  // them touch.
  const ICON_ARROWS = {
    'yfvb-icon-max': ['M17 3H21V7M21 3L14 10', 'M7 21H3V17M3 21L10 14'],
    'yfvb-icon-min': ['M19.3 8.7H15.3V4.7M15.3 8.7L21 3', 'M4.7 15.3H8.7V19.3M8.7 15.3L3 21']
  };

  // Both arrow pairs are built; CSS shows one by .content-visible. Each arrow is
  // its own group (out/in) so the nudge moves them apart or together.
  function revealIcon() {
    const svg = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    for (const [cls, [up, down]] of Object.entries(ICON_ARROWS)) {
      const pair = svg.appendChild(svgEl('g', {
        class: cls, fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
      pair.appendChild(svgEl('g', { class: 'yfvb-arrow-up' })).appendChild(svgEl('path', { d: up }));
      pair.appendChild(svgEl('g', { class: 'yfvb-arrow-down' })).appendChild(svgEl('path', { d: down }));
    }
    return svg;
  }

  // In createButton, after appending the icon:
    // Replays the reveal button's arrow nudge (content.css) on the arrows that
    // were clicked: they stay on screen (data-yfvb-hold) until the nudge ends,
    // then the button shows the other pair.
    const nudge = () => {
      button.classList.remove('yfvb-nudge');
      button.dataset.yfvbHold = button.classList.contains('content-visible') ? 'min' : 'max';
      void button.offsetWidth;
      button.classList.add('yfvb-nudge');
    };
    button.addEventListener('animationend', () => {
      button.classList.remove('yfvb-nudge');
      delete button.dataset.yfvbHold;
    });
  // ...and call nudge() in the click handler before onToggle().
```

## content.css

```css
/* Reveal button: arrows out (maximize) while the media is hidden, in
   (minimize) while it shows. */
.yfvb-btn.content-visible .yfvb-icon-max,
.yfvb-btn:not(.content-visible) .yfvb-icon-min {
  display: none;
}

/* During the nudge the clicked pair stays (content.js sets data-yfvb-hold);
   with reduced motion there is no nudge, so the swap is immediate. */
@media (prefers-reduced-motion: no-preference) {
  .yfvb-btn.yfvb-nudge[data-yfvb-hold="max"] .yfvb-icon-max,
  .yfvb-btn.yfvb-nudge[data-yfvb-hold="min"] .yfvb-icon-min { display: inline; }
  .yfvb-btn.yfvb-nudge[data-yfvb-hold="max"] .yfvb-icon-min,
  .yfvb-btn.yfvb-nudge[data-yfvb-hold="min"] .yfvb-icon-max { display: none; }
}

/* useAnimations' maximize-2/minimize-2 nudge, on click: the arrows
   dip back, push out (or in) 1.8px, and settle. */
.yfvb-nudge .yfvb-icon-max .yfvb-arrow-up,
.yfvb-nudge .yfvb-icon-max .yfvb-arrow-down,
.yfvb-nudge .yfvb-icon-min .yfvb-arrow-up,
.yfvb-nudge .yfvb-icon-min .yfvb-arrow-down {
  animation: yfvb-nudge-out 0.93s;
}

.yfvb-nudge .yfvb-icon-max .yfvb-arrow-down,
.yfvb-nudge .yfvb-icon-min .yfvb-arrow-up {
  animation-name: yfvb-nudge-in;
}

@keyframes yfvb-nudge-out {
  0% { transform: none; animation-timing-function: cubic-bezier(0, 0, 0.58, 1); }
  18% { transform: translate(-0.63px, 0.63px); animation-timing-function: cubic-bezier(0.2, 0, 0, 1); }
  46% { transform: translate(1.8px, -1.8px); animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1); }
  75% { transform: translate(-0.27px, 0.27px); animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1); }
  100% { transform: none; }
}

@keyframes yfvb-nudge-in {
  0% { transform: none; animation-timing-function: cubic-bezier(0, 0, 0.58, 1); }
  18% { transform: translate(0.63px, -0.63px); animation-timing-function: cubic-bezier(0.2, 0, 0, 1); }
  46% { transform: translate(-1.8px, 1.8px); animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1); }
  75% { transform: translate(0.27px, -0.27px); animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1); }
  100% { transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .yfvb-nudge [class^="yfvb-arrow"] { animation: none !important; }
}
```
