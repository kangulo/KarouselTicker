# KarouselTicker v1.0.0
A simple, dependency-free image/logo ticker (infinite auto-scrolling carousel), implemented in plain JavaScript. No jQuery, no build step, no framework required.

## Features

- Lightweight and fast, zero dependencies
- Infinite, seamless looping in either direction
- Draggable / swipeable, with momentum on release
- After a drag, the ticker resumes auto-scrolling in whichever direction you just dragged
- Multiple independent tickers on one page by default
- Optional "entanglement": link any number of tickers (anywhere on the page) so dragging one drags all of them together
- Pause on hover, either per-ticker or synced across every ticker on the page
- Automatically lays itself out full-viewport-width, "container-fluid" style, even nested inside a constrained container — with or without Bootstrap present
- Responsive: re-measures and rebuilds itself on window resize

## Demo
[kangulo.github.io/KarouselTicker](https://kangulo.github.io/KarouselTicker) — the same examples as [index.html](index.html) in this repo.

## Installation

Only `js/KarouselTicker.js` is required — it applies every style the slider mechanism itself needs (container clipping/positioning/touch handling, track flex layout, and base item layout like `flex-shrink`/`box-sizing`/spacing) directly to the elements at runtime, so the component works with no external stylesheet at all:

```html
<script src="js/KarouselTicker.js"></script>
```

`css/style.css` is entirely optional: it only covers presentation the script doesn't touch — `.karousel-item img`, the `.double` size variant, and this repo's own demo page layout. Copy it as a starting point, or skip it and write your own — see [Styling](#styling).

## Basic usage

Markup needs exactly three levels: a `.karousel-container` (this is the element you configure with `data-*` attributes), a `.karousel-track` directly inside it, and any number of `.karousel-item` children inside the track:

```html
<div class="karousel-container" data-direction="right-to-left" data-speed="1">
    <div class="karousel-track">
        <div class="karousel-item">Logo 1</div>
        <div class="karousel-item">Logo 2</div>
        <div class="karousel-item">Logo 3</div>
        <div class="karousel-item">Logo 4</div>
    </div>
</div>
```

A `.karousel-item` can hold anything — text, an `<img>`, an icon plus a heading, a link. The ticker clones your original items internally to build the seamless loop, so keep the markup inside `.karousel-track` limited to the one real set of items.

Then initialize after the DOM (and any images) are ready:

```html
<script>
    window.addEventListener('load', () => {
        document.querySelectorAll('.karousel-container').forEach(container => new KarouselTicker(container));
    });
</script>
```

Every element matching `.karousel-container` at that point gets its own independent `KarouselTicker` instance, configured entirely from its own `data-*` attributes — no JS configuration object needed.

## Options (`data-*` attributes)

All options are read from attributes on the `.karousel-container` element itself.

| Attribute | Values | Default | Description |
|---|---|---|---|
| `data-direction` | `right-to-left` \| `left-to-right` | `right-to-left` | Which way the ticker auto-scrolls. After a drag, this flips automatically to match whichever direction the user last dragged. |
| `data-speed` | number (px moved per animation frame) | `1` | Auto-scroll speed. Higher is faster. |
| `data-pause-on-hover` | `true` \| `false` | `false` | Pause the auto-scroll while the mouse is over the container. |
| `data-sync-pause` | `true` \| `false` | `true` | Only matters when `data-pause-on-hover="true"`. `true`: hovering *any* ticker on the page pauses *every* ticker. `false`: hovering only pauses that one ticker. |
| `data-draggable` | `true` \| `false` | `true` | Whether the user can drag/swipe the track. Includes momentum on release. |
| `data-karousel-group` | any string | *(none)* | Carousels sharing the same group value are "entangled": dragging any one of them drags all the others in the group too, in lockstep, by the same pixel amount — regardless of where they are on the page. Omit this attribute for a fully independent ticker. |
| `data-full-bleed` | `true` \| `false` | `true` | Whether the container breaks out to full viewport width (see below). Set to `false` to keep the ticker confined to its actual parent instead — e.g. when it lives inside a card or column rather than spanning the page. |

### Entangled ("linked") carousels

Give two or more `.karousel-container` elements the same `data-karousel-group` value, anywhere in the document — they don't need to be adjacent or share a parent:

```html
<div class="karousel-container" data-karousel-group="footer-logos">...</div>
...
<div class="karousel-container" data-karousel-group="footer-logos">...</div>
```

Dragging either one moves both together, and releasing on one carries the resulting momentum and new scroll direction over to the other. Carousels with no `data-karousel-group` (or a different group value) are never affected by this — they stay fully independent. Use a different group name to create a separate, unrelated linked set elsewhere on the page.

### Full-viewport-width layout

`.karousel-container` automatically stretches to the full browser viewport width and centers itself, "breaking out" of any constrained parent it's nested inside (a Bootstrap `.container` with a `max-width`, for example). This is applied by the script itself at runtime and does not require Bootstrap's CSS to be loaded — you can drop this component into a non-Bootstrap page with no changes.

Set `data-full-bleed="false"` to opt out and keep the ticker confined to its actual parent width instead — useful when you want it to stay inside a card, column, or any other box rather than spanning the page.

## Styling

`.karousel-container`, `.karousel-track`, and `.karousel-item`'s base layout (`flex-shrink`, `box-sizing`, `list-style`, item-to-item spacing) are all applied by the script itself (inline, at runtime) since they're required for the slider to work correctly — you shouldn't need to touch any of them, and a plain stylesheet can't override them (inline styles always win).

Everything else about `.karousel-item` — size, height, border, background, whatever your items look like — is plain CSS you write yourself. `css/style.css` ships one example (`img`/`.double` helpers for image items); copy it, replace it, or write your own from scratch to match your design.

Note: earlier versions applied `pointer-events: none` to every element inside `.karousel-item`, which silently blocked clicks on any link or button placed inside an item. That's gone — links/buttons inside items work normally now. A real drag is still distinguished from a tap/click via pointer-distance tracking, not `pointer-events`.

If a `.karousel-item` is (or contains) a full-card `<a>`, the browser's native drag-and-drop on that link would otherwise hijack the gesture the instant you press down on it — mousemove events never reach the ticker, so it never registers as a drag, and the click fires anyway even though you clearly dragged. `KarouselTicker.js` cancels `dragstart` on the container to prevent this, so a full-card link works correctly with no extra markup or CSS needed on your part.

## Browser support

Any modern browser supporting `requestAnimationFrame`, CSS `transform`/`flex`, and pointer/touch events. No polyfills included.

## ToDo
- Vertical mode

## Inspired by
[carouselTicker by yuriyberezovskiy](https://github.com/yuriyberezovskiy)

## License

This project is licensed under the MIT License - see the [LICENSE](http://opensource.org/licenses/MIT) file for details.
