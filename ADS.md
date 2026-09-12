# Advertising setup

Publisher ID: `ca-pub-7338860226113687` (Google AdSense)

## How it works

Every page loads the AdSense tag in `<head>` and `/ads.js` before `</body>`.
Pages contain inert placeholders:

```html
<div class="ad-slot" data-ad="tool-top"></div>
```

`ads.js` walks those placeholders and turns each into a real `<ins class="adsbygoogle">`
unit — **but only if that placement has a slot ID configured**. A placement with a blank
slot ID is removed from the DOM entirely, so an unconfigured or not-yet-approved account
shows normal page layout instead of collapsed grey frames.

## Going live (the only step left)

1. AdSense → **Ads → By ad unit → Display ads**. Create one unit per placement below.
2. Copy each unit's `data-ad-slot` value (10 digits).
3. Paste them into the `SLOTS` map at the top of `ads.js`. Nothing else to change.

| Key | Where it appears | Pages | Suggested unit type |
|---|---|---|---|
| `tool-top` | Under the tool hero, above the drop zone | 24 tool pages | Display — responsive |
| `tool-bottom` | Above the footer | 25 tool pages + blog | Display — responsive |
| `home-mid` | Homepage, between the tool grid and "Why Choose" | `index.html` | Display — responsive |
| `article` | Mid-post, before the 3rd `<h2>` | 4 blog posts | In-article |

To switch a placement back off, blank its slot ID again. To drop it from one page only,
delete that page's placeholder `<div>`.

## ads.txt

`/ads.txt` declares the publisher ID. Without it AdSense reports "Earnings at risk" and
some demand partners will not bid. It must stay reachable at the domain root as
`text/plain` — `netlify.toml` pins the content type.

## Notes

- `privacy.html`, `terms.html`, `about.html` and `contact.html` carry **no** ad slots.
  They are short pages, and ads on thin policy pages are a common AdSense policy flag.
- Reserved height lives in `style.css` (`.ad-slot.is-live`) so live ads do not cause
  layout shift. Adjust `min-height` there if you change unit sizes.
- Each live unit is labelled "Advertisement", which keeps ads visually distinct from
  page content as AdSense policy requires.
- `sw.js` cache version must be bumped whenever `ads.js` changes, or returning visitors
  keep the old cached copy. It is currently `epdf-v2`.
