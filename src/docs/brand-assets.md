# Refurb Genius brand assets

**Slice:** IOS-BRAND-ASSETS-1 — R1 master repair + R2 derivatives/integration
**Implementation base:** `9bcef2e8fda8e6a0835c8a3c56e467fda92cd721`
**Production asset state:** R1 Human-optically-approved masters with R2 derivatives and integration.

Human optical decision on R1 cubic Bézier masters: **PASS**. Light-surface compact remains a colour translation only (emerald G + navy rays) of the approved compact geometry.

This file records usage, inventory and provenance. It does not authorise report/export branding, OG/social images, custom AppIcon appearance variants, physical-device verification, or a shared `BrandMark` component file.

## Accessibility (masters vs integration)

The SVG masters are **context-neutral production files**. They do **not** set `role="img"`, `aria-hidden`, or `<title>`.

Integration in this slice:

| Surface | Host accessible name | Graphic |
| --- | --- | --- |
| Mobile top-bar home control | `Refurb Genius home` on the link | Compact SVGs `alt=""` (decorative) |
| Marketing navbar home control | `Refurb Genius home` on the link | Wordmark SVGs `alt=""` (decorative) |
| Desktop sidebar identity | `role="img"` + `aria-label="Refurb Genius"` | Wordmark SVGs `alt=""` (decorative) |
| Auth header tile | Tile `aria-hidden="true"`; product name remains in adjacent text | Dark compact `alt=""` (decorative) |

Do not add a second spoken “Refurb Genius” / “RG” name on the graphic when the host already names the control.

## Locked visual sources

| Source | Role | Production use |
| --- | --- | --- |
| `RG-BRAND-01_Master-Dark-Wordmark.jpeg` | Canonical geometry | Dark and light full wordmarks share this silhouette. Warm-ivory “Refurb”, emerald “Genius”, **exactly three** rays above the G. |
| `RG-BRAND-02_Compact-G-Reference.jpeg` | Compact-G direction | Standalone emerald G. The JPEG shows **four** rays; production compact marks use the **three-ray** language from RG-BRAND-01. |
| `RG-BRAND-03_Light-Colour-Reference.jpeg` | Colour placement only | Navy “Refurb”, emerald “Genius”, navy rays on ivory/white. **Do not** reproduce its internal G loop or extra rays. |

JPEGs are visual authority, not distributable production files.

## Locked colours

| Token | Hex | Artwork role |
| --- | --- | --- |
| Deep navy | `#0B1F35` | AppIcon / PWA / favicon field; “Refurb” and rays on light wordmark; rays on **light-surface compact** |
| Emerald | `#169C70` | “Genius”; compact G (both compact colourways) |
| Warm ivory | `#F5EFE5` | “Refurb” and rays on dark wordmark; rays on **dark-surface compact** |

Existing product UI semantic tokens in `src/styles.css` remain implementation authority. These hex values belong to **artwork**, not a project-wide retoken.

Emerald on ivory is for large identity use only — not small body text.

## Masters and authorised derivative

| File | Contents |
| --- | --- |
| `src/assets/brand/refurb-genius-wordmark-dark.svg` | Transparent. Ivory Refurb + emerald Genius + three ivory rays. No baked navy rectangle. **R1 cubic geometry — Human optical PASS. Frozen.** |
| `src/assets/brand/refurb-genius-wordmark-light.svg` | **Same path geometry** as the dark wordmark. Navy Refurb + emerald Genius + three navy rays. No RG-BRAND-03 loop. **R1 cubic geometry — Human optical PASS. Frozen.** |
| `src/assets/brand/refurb-genius-mark.svg` | Dark-surface compact. Emerald G + **three ivory** rays. Transparent. **R1 cubic geometry — Human optical PASS. Frozen.** Use on navy / dark fields. |
| `src/assets/brand/refurb-genius-mark-light.svg` | Light-surface compact **colour translation only**. Same G path, same three rays, same angles/positions/stroke widths. Emerald G + **three navy** rays. Use on ivory / white / light product surfaces. Do not use this file in place of the full light wordmark on wide chrome. |

Compact ray geometry is identical between `refurb-genius-mark.svg` and `refurb-genius-mark-light.svg`. Only `stroke` colour differs (`#F5EFE5` vs `#0B1F35`). There is no generated light-compact geometry difference.

Do not replace the full light wordmark with the compact light derivative where a full wordmark is appropriate (wide sidebar / header).

### Frozen R1 masters (must not change in R2)

| File | SHA-256 |
| --- | --- |
| `refurb-genius-wordmark-dark.svg` | `4e942cfbc26499198382e6b9ab8cd80a1912ed9c23c1541cf4f063e93f713d71` |
| `refurb-genius-wordmark-light.svg` | `0a1d7db90438fb6b704744b3a60adf097d4cfe1adb0c6543abfe24dcd5f21115` |
| `refurb-genius-mark.svg` | `9a12fc93dbb43022f395f4ff1acdcf325c04adcbb9c02666ed6b0ef76ac3e4e7` |
| `refurb-genius-mark-light.svg` | `5cf121dfd715aef221deec0c6cdc61568304afa813f5ae01d883575415487d44` |

## Compact colourways

**Dark / navy surface**

- G: `#169C70`
- rays: `#F5EFE5`
- exactly 3 rays

**Light / ivory surface**

- G: `#169C70`
- rays: `#0B1F35`
- exactly 3 rays

Identical G geometry, G path, viewBox, ray count, endpoints, angles, transforms, stroke widths, proportions and spacing. Only the ray colour differs.

## iOS AppIcon source

`ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`

- 1024 × 1024 square
- RGB, no alpha
- square navy field `#0B1F35`
- approved dark-surface compact (emerald G, three ivory rays)
- combined G-and-rays artwork in the central ~70% of the canvas (≈15%+ proofing inset)
- **no baked rounded corners**, no circle mask, no house, no legacy Capacitor mark
- `Contents.json` and `project.pbxproj` are unchanged
- custom dark/clear/tinted catalog slots are not in this slice

## iOS launch

Splash images (solid field, **no logo / wordmark / copy / animation**):

- `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png`
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png`
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png`

Storyboard: `ios/App/App/Base.lproj/LaunchScreen.storyboard`

Launch colour is a deterministic CSS Color 4 conversion of the current first-screen token:

| Item | Value |
| --- | --- |
| Source token | `.dark --background: oklch(0.16 0.028 262)` in `src/styles.css` (not modified) |
| Conversion | CSS Color Module Level 4 OKLCH → OKLab → linear sRGB → sRGB 8-bit |
| Final RGB / hex | `rgb(7, 13, 25)` / `#070D19` |
| Storyboard | custom sRGB `7/255, 13/255, 25/255` — not `systemBackgroundColor` (white) |

The application surface is **not** forced to brand navy `#0B1F35`. Launch matches the product `.dark --background` as closely as 8-bit sRGB allows.

## Web / PWA / favicon

Existing filenames remain authoritative. `public/manifest.json` and `src/routes/__root.tsx` are not modified.

| File | Role | Treatment |
| --- | --- | --- |
| `public/icon-192.svg` | Public shell SVG | Navy field + **R1** dark compact (cubic, not the rejected 89-L polygon). No house. No baked round-rect. |
| `public/icon-192.png` | 192 PWA | Same composition, 192 × 192 RGBA |
| `public/icon-512.png` | 512 PWA | Same composition, 512 × 512 RGBA |
| `public/favicon.png` | Favicon PNG | 512 × 512 RGBA (byte-identical to `icon-512.png`) |
| `public/favicon.ico` | Favicon ICO | 16 / 32 / 48 / 64, 32-bpp PNG entries |
| `public/apple-touch-icon.png` | Apple touch | 180 × 180 RGBA, square field, no baked OS corner |
| `public/apple-touch-icon-precomposed.png` | Apple touch precomposed | Same 180 × 180 treatment |
| `public/maskable-icon.png` | Maskable | 192 × 192. Navy may fill the canvas. Compact mark kept inside the mask-safe circle (diameter 80%). No baked circular/squircle mask in the artwork. |

Self-contained field icons: navy `#0B1F35`, G `#169C70`, three ivory rays `#F5EFE5`. Combined G+rays occupy the central ~70% of the canvas (≥15% proofing inset).

### R2 derivative SHA-256

| File | SHA-256 |
| --- | --- |
| `public/icon-192.svg` | `ef2deac5aeee18156bcbae1aeaf3c5b5fb2d4bcd4c098b83de370c285e09af34` |
| `public/icon-192.png` | `21e98e89149f4687764d557b9a3d37953c7e56e0f9569fff1a199922f2207ad2` |
| `public/icon-512.png` | `89a4142288f7e3bfe0d207462689fc6f3e2835d7d35bb1bdbed6c4fecd32ef47` |
| `public/favicon.png` | `89a4142288f7e3bfe0d207462689fc6f3e2835d7d35bb1bdbed6c4fecd32ef47` |
| `public/favicon.ico` | `59ea4ce8e87548ecdbd1c52ed81defc233a2c13e0974caaae23b2f1b342d93ca` |
| `public/maskable-icon.png` | `21e98e89149f4687764d557b9a3d37953c7e56e0f9569fff1a199922f2207ad2` |
| `public/apple-touch-icon.png` | `0a6620cb2f9f66199cf2a2bc12663a434f60a0451387a7525257fa7e332d1118` |
| `public/apple-touch-icon-precomposed.png` | `0a6620cb2f9f66199cf2a2bc12663a434f60a0451387a7525257fa7e332d1118` |
| `ios/.../AppIcon-512@2x.png` | `fbad0dd71d419cc6a0dec176b10d374cd8ee0ece77b623ee6497846dbd8ce919` |

## Authorised presentation surfaces

| Owner | Identity treatment |
| --- | --- |
| `src/components/MobileTopBar.tsx` | Compact family on `bg-background`. Variant follows `useTheme().resolvedTheme` (not `prefers-color-scheme`). Home control remains `/dashboard` named `Refurb Genius home`. Destinations unchanged. Copilot chrome copy unchanged. |
| `src/components/Sidebar.tsx` | Full wordmark on `bg-card`. Variant follows `resolvedTheme`. Pre-provider/SSR uses `html.dark` so the light wordmark cannot flash on the dark-first shell. IA destinations unchanged: Dashboard, Projects, New Analysis, Deal Copilot, Trades, Settings. |
| `src/components/Navbar.tsx` | Full wordmark (preferred where width allows). Variant follows `resolvedTheme`. Home control `/` named `Refurb Genius home`. Marketing destinations unchanged. |
| `src/features/auth/presentation/AuthExperience.tsx` | Dark compact on existing `#111827` tile (sufficiently dark surface). Auth logic/session/OAuth unchanged. No `src/styles.css` retoken. Literal `RG` tile text removed. |

Functional `Building2` icons (project placeholders, Estimate “New build”, report chrome) are **not** brand identity and were not changed.

## Construction rules

- One identity. Do not independently typeset, re-kern or recolour “Refurb” / “Genius” in application code.
- Preserve the optical gap between the two words.
- Three rays keep the same angle, optical weight and relationship to the G across variants.
- Serif lettering lives only in these outlined SVGs. Do not load a display serif into the product to recreate the logo.
- Product UI remains Inter / existing sans-serif tokens.
- Full wordmark: wide sidebar/header only.
- Compact G: constrained chrome, favicon/PWA/app-icon sources, collapsed nav.
- Dark compact → dark/navy surfaces. Light compact → light/ivory surfaces.
- Home controls use accessible name `Refurb Genius home` when they navigate home; mark the graphic decorative when that name is already on the control.
- Product name is **Deal Copilot**. Do not invent a second identity.
- Do not bake rounded corners into iOS icon source artwork.

## Font / provenance

**TYPEFACE IDENTIFIED:** NO
**TYPEFACE:** NOT EVIDENCED
**LICENCE EVIDENCE:** NONE in-repo
**AUTHORITATIVE VECTOR SOURCE before R1:** NO

**Production method:** JPEG-first cubic Bézier reconstruction of RG-BRAND-01 / RG-BRAND-02 silhouettes (R1). Light compact is a Human-authorised colour translation of the approved R1 compact geometry. Platform rasters are derived from that compact master on a navy field (or a solid launch field with no mark).

**HUMAN OPTICAL CHECKPOINT (masters):** PASS (R1 bytes).

## Canvas (R1)

Dark and light wordmarks share **identical** viewBoxes:

| | Value |
| --- | --- |
| viewBox | `137.53 550.00 1176.03 255.76` |

Compact viewBox (both colourways): `448.41 301.06 495.45 689.75`. Compact ray `stroke-width` 12.45 / 17.28 / 12.45.

## Deferred (not this slice)

- Monochrome wordmarks
- Report / export / PDF branding
- OG / social (`public/og-image.jpg`, `public/og-image.png`)
- Custom AppIcon appearance variants (dark / clear / tinted catalog slots)
- Physical-device / TestFlight appearance verification
- `pnpm prepare:ios` generated copy into `ios/App/App/public/**`
- Product chrome beyond the four authorised owners
- Mobile A / Web A layout

## Proof

See `src/docs/brand-proof.pdf`.
