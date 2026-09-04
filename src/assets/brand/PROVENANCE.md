# Refurb Genius — brand identity provenance

**Project:** Refurb Genius  
**Slice:** RG-NEW-BRAND-IDENTITY-1-IMPL  
**Recorded:** 2026-09-02  
**Authority:** Human-approved primary / compact / micro / app-icon identity. Secondary/tagline is Human-approved visually but is **not** published here.

This file records source masters, hashes, mapping, and derivative commands. It is not a licence to redesign the identity.

---

## Human-approved identity family (this IMPL)

| Role | Geometry | Responsive rule |
| ---- | -------- | --------------- |
| PRIMARY | Serif wordmark + one canonical four-point Teal sparkle | 120 px+ horizontal wordmark |
| COMPACT NORMAL | Leaf + canonical four-point sparkle | 32 px+ |
| COMPACT MICRO | Approved R3 optical derivative of compact | 16–24 px only |
| APP ICON | Flat leaf + sparkle on Navy `#0D2139` | iOS AppIcon / PWA |

Global colours (unchanged product tokens):

| Role | Value |
| ---- | ----- |
| Navy | `#0D2139` |
| Teal | `#1B8D68` |
| White | `#FFFFFF` |

Product chrome uses PRIMARY or COMPACT via `BrandLogo`. Do not ship a secondary/tagline variant from this slice.

---

## Desktop source masters

R1 root: `/Users/dev/Desktop/Refurb-Genius-Brand-Refinement/`  
R3 root: `/Users/dev/Desktop/Refurb-Genius-Brand-Refinement-R3/`

Production geometry is taken from these SVG/PNG masters, not from proof-board screenshots.

| Desktop source | SHA-256 |
| -------------- | ------- |
| `02-wordmark/rg-wordmark-master.svg` | `d82f9c8b2bd22954981728f78dcac91a5d7972f89d6c833ac2a10221fadba58c` |
| `02-wordmark/rg-wordmark-on-light.svg` | `d82f9c8b2bd22954981728f78dcac91a5d7972f89d6c833ac2a10221fadba58c` |
| `02-wordmark/rg-wordmark-on-dark.svg` | `311ecfb0fb2c7a278341708d492c07982870ffbe730f6a83aa5304c3db4d561c` |
| `04-compact-leaf-sparkle/rg-compact-master.svg` | `9416454ece2f542d102de12ee1ba721c8c0a759e16d1303b2a2b16f912edc925` |
| `04-compact-leaf-sparkle/rg-compact-on-light.svg` | `9416454ece2f542d102de12ee1ba721c8c0a759e16d1303b2a2b16f912edc925` |
| `04-compact-leaf-sparkle/rg-compact-on-dark.svg` | `cfd40c54cadf8a7dd3630433cf6e4d901c59e83a7ba3ba8e6cf24e809cafc9db` |
| `04-compact-leaf-sparkle/rg-sparkle-canonical.svg` | `dea4b018772b43386cb15c9773a4085938a1308e1c15ff2f34656fab3b6f5f1c` |
| `01-micro-master/rg-compact-micro-master.svg` (R3) | `4c6a788bd73876f8e0b1cf0ff8cb36e95047c7801c977f41fed0fbbbcc02c6b2` |
| `01-micro-master/rg-compact-micro-on-light.svg` (R3) | `4c6a788bd73876f8e0b1cf0ff8cb36e95047c7801c977f41fed0fbbbcc02c6b2` |
| `01-micro-master/rg-compact-micro-on-dark.svg` (R3) | `2c5a143712cf86a04271f7b972213bdaaff1a1ba1b4b7b3db75007f77cb300fa` |
| `06-app-icon-proof/rg-app-icon-master.svg` | `ab4b46b69b75617a730f2e813968c576fe2e207f91fbbfa7852245f3a259e470` |
| `06-app-icon-proof/rg-app-icon-master-1024.png` | `cfa939b38739047513606d9d956b4971450cd7fcb51446dcd1f54c49f686fff6` |

Committed copies under `src/assets/brand/` are byte-identical to those sources (same SHA-256).

---

## Repository asset mapping

| Repository path | Source |
| --------------- | ------ |
| `src/assets/brand/rg-wordmark-*.svg` | R1 wordmark masters |
| `src/assets/brand/rg-compact-*.svg` | R1 compact masters |
| `src/assets/brand/rg-compact-micro-*.svg` | R3 micro masters |
| `src/assets/brand/rg-sparkle-canonical.svg` | R1 canonical sparkle |
| `src/assets/brand/rg-app-icon-master.svg` | R1 app-icon SVG |
| `src/assets/brand/rg-app-icon-master-1024.png` | R1 app-icon 1024 PNG |
| `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` | Exact 1024 PNG bytes (`cfa939b38739047513606d9d956b4971450cd7fcb51446dcd1f54c49f686fff6`) |
| `public/icon-192.svg` | App-icon master SVG (Navy square, compact geometry; no house/arrow; not the micro derivative) |
| `public/icon-192.png` / `public/icon-512.png` | Lanczos downscale of the 1024 app-icon PNG |
| `public/apple-touch-icon.png` / `public/apple-touch-icon-precomposed.png` | 180×180 Lanczos downscale of the 1024 app-icon PNG (byte-identical pair) |
| `public/maskable-icon.png` | Same app-icon geometry, 80% centred on Navy `#0D2139` (platform-safe inset only) |
| `public/favicon.png` | Normal compact geometry at 32×32 |
| `public/favicon.ico` | 16 px R3 micro; 32 / 48 / 64 px normal compact |

`Contents.json`, `project.pbxproj`, splash, LaunchScreen, and OG images were not modified.

---

## Derivative generation (no new repository dependencies)

SVG rasterisation used the existing Desktop brand-refinement `resvg` helper (not added to `package.json`):

```text
RASTER=/Users/dev/Desktop/Refurb-Genius-Brand-Refinement/_build/rasterize.js
NODE_PATH=/Users/dev/Desktop/Refurb-Genius-Brand-Refinement/_build/node_modules
```

`rasterize.js` calls `@resvg/resvg-js` with a transparent background. Height-fit:

```text
node "$RASTER" <svg> <png> '' <height>
```

PNG resize / ICO packing used macOS Python 3 + Pillow already present on the machine (`PIL` 12.2.0). Commands:

```text
# PWA / touch icons from the approved 1024 PNG (LANCZOS, no baked corners)
python3: Image.open(app_icon_1024).convert("RGBA").resize((192,192), LANCZOS) → public/icon-192.png
python3: resize((512,512), LANCZOS) → public/icon-512.png
python3: resize((180,180), LANCZOS) → public/apple-touch-icon.png
         copy identical bytes → public/apple-touch-icon-precomposed.png

# Maskable 192: Navy #0D2139 canvas; paste 1024 master scaled to 80% (154 px) and centred
python3: canvas 192×192 fill (13,33,57); paste resized 154×154 at (19,19)

# Favicon frames
node rasterize.js rg-compact-micro-on-light.svg  → height 64, contain to 16×16 (R3 micro)
node rasterize.js rg-compact-on-light.svg        → height 128/192/256, contain to 32/48/64
python3: write public/favicon.png as the 32×32 compact frame
python3: write public/favicon.ico with frames 16, 32, 48, 64
```

No rounded-corner mask is applied to PWA or app-icon rasters.

---

## Superseded assets

| Path | Disposition |
| ---- | ----------- |
| `src/assets/brand/logo-light-horizontal.png` | Superseded raster horizontal lockup. Deleted after a zero-reference audit. |
| `src/assets/brand/logo-dark-horizontal.jpg` | Superseded raster horizontal lockup. Deleted after a zero-reference audit. |

Those files were historical byte-authority for the previous `BrandLogo` implementation. They are replaced by the SVG wordmark masters above.

---

## R2 secondary / tagline — not published

Human-approved visually, **not** authorised for repository publication in this IMPL.

Do not copy, commit, or derive runtime assets from:

- `rg-secondary-r2-light.svg`
- `rg-secondary-r2-dark.svg`
- `rg-tagline-r2-outline.svg`

Reason: Avenir Next outline redistribution provenance remains pending verification.

Do not redesign or substitute the approved tagline. Do not use Cormorant as a replacement wordmark or tagline font.

---

## Typeface / vector origin

- Wordmark typeface is **unknown and is not claimed**.
- No original production vectors existed for the wordmark; committed masters are reconstructions from Human-approved rasters (see the Desktop R1/R3 provenance notes).
- No new logo font dependency was introduced in this repository (`package.json` / `pnpm-lock.yaml` unchanged).
- Product UI type remains the existing application serif system; it is not wordmark authority.
