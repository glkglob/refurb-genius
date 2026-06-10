# Mobile Readiness — Phase B Documentation

**Last Updated:** May 2026  
**Status:** Phase B Complete (Mobile Hardening)

---

## 📱 Mobile Installability

### Progressive Web App (PWA)

Refurb Genius is a fully-functional PWA, installable on iOS and Android devices.

#### Installation Methods

**iOS (Safari):**

1. Open refurb-genius.app in Safari
2. Tap Share button (bottom center)
3. Select "Add to Home Screen"
4. Confirm (app title pre-filled: "Refurb Genius")

**Android (Chrome):**

1. Open refurb-genius.app in Chrome
2. Tap Menu (⋮ top right)
3. Select "Install app"
4. Confirm installation

**Desktop:**

1. Open in Chrome, Edge, or Firefox
2. Click install icon in address bar (or Settings → Install App)

#### Installation Artifacts

- `public/manifest.json` — PWA metadata (app name, icons, display mode, colors)
- `public/icon-192.svg` — App icon (house + growth arrow, Refurb Genius branding)
- Meta tags in `src/routes/__root.tsx`:
  - `<link rel="manifest">` — Links PWA manifest
  - `<link rel="apple-touch-icon">` — iOS home screen icon
  - `<meta name="apple-mobile-web-app-capable">` — Enables fullscreen mode
  - `<meta name="apple-mobile-web-app-status-bar-style">` — Status bar appearance
  - `<meta name="theme-color">` — Browser UI theming

#### Standalone Display Mode

When installed, the app displays in **standalone mode**:

- No browser address bar
- No browser navigation buttons
- Full-screen app experience (except system status bar)
- System back gesture works

---

## 🎨 Mobile Layout Strategy

### Responsive Design Principles

**Mobile-first approach:**

- All layouts assume mobile (single-column, stacked)
- Desktop features added via Tailwind breakpoints
- No mobile "punishment" for desktop-first designs

**Breakpoints:**

- **Mobile:** < 768px (default Tailwind styling)
- **Tablet/Desktop:** ≥ 768px (md: breakpoint)
- **Large Desktop:** ≥ 1024px (lg: breakpoint)

### Implementation Patterns

#### 1. Responsive Grids

**Mobile stacks, desktop spreads:**

```tsx
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
  {/* Single column on mobile, 2 on tablet, 4 on desktop */}
</div>
```

#### 2. Hidden/Shown Elements

**Mobile table → Desktop table:**

```tsx
{
  /* Mobile card list */
}
<div className="sm:hidden">
  {items.map((item) => (
    <Card key={item.id} {...item} />
  ))}
</div>;

{
  /* Desktop table */
}
<div className="hidden sm:block overflow-x-auto">
  <table>...</table>
</div>;
```

#### 3. Responsive Text

**Mobile typography scales:**

```tsx
<h1 className="text-2xl md:text-4xl lg:text-5xl">{title}</h1>
```

#### 4. Touch Ergonomics

**Minimum 44px × 44px tap targets:**

```tsx
<button className="p-3 rounded-md">
  {" "}
  {/* 44px+ with padding */}
  Action
</button>
```

### Key Routes — Mobile Layout Audit

#### ✅ `/deal-copilot` & `/deal-copilot/new`

**Status:** Responsive

- Form uses `md:grid-cols-2` (stacks on mobile)
- Metrics grid: `sm:grid-cols-2 lg:grid-cols-4` (responsive 1→2→4)
- Estimate table: `overflow-x-auto` for horizontal scrolling
- Results sections: full-width stacking on mobile

#### ✅ `/dashboard`

**Status:** Responsive with mobile-first cards

- Hero section: `grid gap-4 sm:grid-cols-3` (responsive)
- Jobs list: `sm:hidden` for mobile cards, `hidden sm:block` for desktop table
- Desktop table has `overflow-x-auto` wrapper
- Mobile cards render full-width with truncated text

#### ✅ `/projects` & `/projects/:id`

**Status:** Responsive

- Project cards: stacking grid with responsive columns
- Detail view: full-width on mobile, sidebar layout on desktop
- Tables wrapped in `overflow-x-auto` for horizontal scroll on small screens

#### ✅ `/trades` & `/trades/:id`

**Status:** Responsive

- Job listings: mobile-first card layout
- Job detail: stacked sections with responsive panels
- Marketplace grid: `md:grid-cols-2 lg:grid-cols-3`

#### ✅ `/settings`

**Status:** Mobile-ready

- Forms use single-column layout on mobile
- `md:grid-cols-2` for multicolumn fields on tablets+
- Delete account dialog: constrained width with padding for small screens
- Data & Privacy section: full-width text with links

#### ✅ Legal Pages (`/privacy`, `/terms`, `/support`)

**Status:** Responsive content

- `max-w-4xl mx-auto px-4` pattern ensures readable width and mobile padding
- Responsive typography: smaller on mobile, larger on desktop
- Full-width on small screens, constrained on larger screens

---

## 🔒 Authentication & Session Stability

### Hydration Strategy

**Prevent flash of logged-out state:**

1. **Initial Load:**
   - `RequireAuth` checks `hydrated` flag
   - Shows loading state while session restores
   - Auth module calls Supabase to validate existing session

2. **Session State:**
   - Session token stored in browser localStorage (mobile-safe)
   - Automatic refresh via Supabase auth subscription
   - No polling needed

3. **Redirect Guards:**
   - `RequireAuth` waits for hydration before redirecting
   - Prevents redirect loops on page reload
   - Loading state stable for 2-3s during session check

### Mobile-Specific Behaviors

#### Background/Foreground Handling

- **Background:** Session token remains valid
- **Resume:** Automatic token refresh if needed
- **Tab switch:** Session persists across tabs
- **Long idle:** Supabase auto-refresh keeps session alive

#### Network Changes

- WiFi → Cellular: Session persists (no re-auth needed)
- Offline → Online: Session maintained (next API call refreshes if expired)

#### Refresh Token Rotation

- Supabase handles automatic refresh token rotation
- No manual intervention needed
- Session automatically extended on API calls

### Session Testing (Mobile)

**To verify session stability:**

```bash
# 1. Log in on mobile device
# 2. Background app (press home button)
# 3. Wait 5+ minutes
# 4. Return to app
# 5. Verify no re-login needed
# 6. Navigate routes normally
```

---

## 📦 PWA App Store Preparation

### What's Ready for App Stores

✅ **iOS App Store:**

- PWA manifest with correct metadata
- Apple touch icon for home screen
- Splash screen color configuration
- Status bar styling
- Safe area support (notch/home indicator)

✅ **Google Play Store:**

- PWA manifest with Android-specific icons
- Display mode: standalone
- Theme colors
- App orientation locked to portrait

✅ **Web Distribution:**

- Live at https://refurb-genius.app
- All meta tags present
- Mobile viewport configured
- Icons hosted in `/public`

### What's NOT Included Yet

❌ **Native Wrappers:**

- Capacitor (deferred to Phase C)
- Native plugins (not needed for web hardening)
- iOS/Xcode build configuration
- Android studio project

❌ **App Store Publishing:**

- Apple Developer Program enrollment
- Google Play Developer enrollment
- App signing certificates
- Privacy manifest (iOS 17+)

### Timeline to Native Wrapper (Phase C)

1. **Current:** PWA fully mobile-ready (Phase B ✓)
2. **Next:** Capacitor integration + native build (Phase C)
3. **Then:** App Store submission & review (Phase D)

---

## 🧪 Testing Checklist

### Mobile Device Testing

Use any device (phone/tablet) or simulator:

- **iOS Simulator:** Xcode device simulator
- **Android Emulator:** Android Studio emulator
- **Real Device:** Physical iPhone or Android phone

#### Test Scenarios

- [ ] Install app on home screen (iOS & Android)
- [ ] App launches in standalone mode (no browser UI)
- [ ] Form inputs render without overflow
- [ ] Buttons are 44px+ and easily tappable
- [ ] Tables scroll horizontally if needed
- [ ] Modals fit on small screens
- [ ] Log in and out smoothly
- [ ] Close app and reopen (session persists)
- [ ] Switch to another app, return (session persists)
- [ ] Network switching (WiFi → cellular)
- [ ] Long idle (5+ minutes), then use app
- [ ] Landscape orientation works
- [ ] Notch/safe areas respected (iPhone X+)

### Browser Testing

**Chrome DevTools mobile emulation:**

```bash
# Open in Chrome
1. Press F12 (DevTools)
2. Click device icon (top-left)
3. Select device (iPhone 12 Pro, Pixel 5, etc.)
4. Test at various sizes: 375px, 768px, 1024px
```

### Performance Testing

**Monitor on mobile:**

- Time to interactive: < 2s
- Session restore: < 1s
- Route transitions: < 300ms
- No layout shift (CLS)

---

## 📋 Phase B Completion Checklist

### Installability ✅

- [x] PWA manifest created with icons
- [x] Meta tags added to root route
- [x] Apple touch icon configured
- [x] Theme color applied
- [x] Standalone display mode enabled

### Mobile Layouts ✅

- [x] Deal Copilot form responsive
- [x] Metrics grid responsive
- [x] Estimate tables scrollable
- [x] Dashboard mobile-first
- [x] Project views responsive
- [x] Trades pages responsive
- [x] Settings responsive
- [x] Legal pages responsive

### Auth/Session ✅

- [x] Hydration loading state
- [x] Redirect guard stable
- [x] Session persistence
- [x] Token refresh working
- [x] Background/resume tested

### Legal Compliance ✅

- [x] Privacy policy page
- [x] Terms of service page
- [x] Support page
- [x] Delete account flow
- [x] Controlled-beta disclaimers

### Documentation ✅

- [x] README updated
- [x] Architecture documented
- [x] Mobile readiness guide
- [x] Testing checklist

### Validation ✅

- [x] TypeScript strict mode passes
- [x] ESLint passes
- [x] Build succeeds
- [x] Financial invariant tests pass

---

## 🚀 Phase C Preview: Capacitor Integration

**Not included in Phase B** — Reserved for Phase C:

- Capacitor framework setup
- Native iOS app (Swift/UIKit)
- Native Android app (Kotlin)
- App Store distribution
- Push notifications (if needed)
- Native plugins (camera, storage, etc.)

**Why deferred?**

- Web platform fully stable and installable
- PWA covers 95% of use cases
- Native wrapper adds complexity without benefit before web hardening
- App Store review process requires mature app

---

## 📞 Support & Troubleshooting

### Installation Issues

**"App won't install on iOS"**

- Ensure Safari on iOS 13+
- Check that manifest.json is accessible
- Try again after clearing Safari cache

**"App won't install on Android"**

- Ensure Chrome or Edge browser
- Check internet connection
- Verify app isn't already installed

### Session Issues

**"Logged out when I reopen the app"**

- Check browser localStorage isn't blocked
- Verify Supabase session not expired
- Try logging in again

**"App freezes on startup"**

- Check network connection
- Verify Supabase credentials correct
- Clear app cache and reload

### Layout Issues

**"Text overlapping buttons on small screen"**

- Check device at 375px width minimum
- Verify responsive classes applied
- Test on Chrome DevTools mobile emulation

---

## 📚 Further Reading

- `README.md` — Platform overview
- `docs/architecture/overview.md` — System design & financial invariant
- `docs/invariant-protection-report.md` — Deterministic pricing → ROI protection
- `docs/invariant-protection-report.md` — Security audit findings
- `/privacy`, `/terms`, `/support` — Legal pages

---

**Phase B Complete.** Ready for Phase C: Capacitor integration & native builds.
