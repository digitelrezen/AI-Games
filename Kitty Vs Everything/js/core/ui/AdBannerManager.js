// Filename: AdBannerManager.js
// Kitty Vs Everything — v4.29.1
// Eridath's Mom Enterprises — the lower-left "sponsored by" ad banner.
//
// A decoupled, extensible UI module: it builds its OWN DOM (a retro 90s
// ad window — neon cyan/magenta borders, gradient title bar, fake
// close/minimize/maximize buttons) as a standalone overlay at the
// LOWER-LEFT of the main game screen (inside #game-root, NOT part of the
// fire-control panel) and pops up a NEW ad from the AD_CATALOG every
// 30–60 s (v4.29.1 — the banner starts HIDDEN). index.html
// only provides the settings toggle (#set-ads, Settings → MONETIZATION /
// AD BANNERS); everything else is self-contained here.
//
//   • AD_CATALOG — extensible array of { id, title, subtitle, body,
//     sprite, cta } ad objects. `sprite` is an AssetSprites.js registry
//     key (AssetManager.js decodes it to a canvas). The house ad
//     references the 512×512 Eridath's Mom's House pixel art (embedded
//     256×256 in AssetSprites.js) and is scaled with nearest-neighbor
//     (image-rendering: pixelated in style.css + smoothing disabled here)
//     so the pixel art stays razor-sharp at any banner size.
//   • Pop-up model (v4.29.1): the banner STARTS HIDDEN and pops up with a
//     NEW ad after a random 30–60 s gap, stays on screen for 12 s, then
//     retracts — a joke, not a fixture. The minimize button (–) is REAL:
//     it retracts the banner and docks a small "AD · MOM" chip into the
//     fire-control mini-bar (#fc-mini-bar) so nothing floats on the game
//     screen; clicking the chip pops the ad back up. Close/maximize stay
//     fake (90s authenticity — Mom refuses).
//   • setEnabled(boolean) — turns the pop-up cycle on/off immediately
//     (off: hide + undock + clear timers); persists to localStorage
//     'kitty_enable_ads' (default ON — Mom always runs the sponsorship).
//   • Node-safe: importing under tools/check.mjs never touches the DOM —
//     the constructor probes canvas.getContext('2d') before building, so
//     headless checks get a live (but DOM-less) manager.
//
// Boot: main.js calls adBanner.start() — the banner stays hidden and the
// first pop-up arrives after a random 30–60 s gap. SettingsScreen
// ._buildAds() binds #set-ads to adBanner.setEnabled().

import { bus } from '../EventBus.js';
import { getSprite, loadAssets } from '../AssetManager.js';
import { disableImageSmoothing } from '../utils.js'; // v3.88.0: crisp pixel-art enforcement

export const VERSION = 'v4.29.1';

// localStorage key for the enable toggle (Settings → MONETIZATION / AD
// BANNERS). Default ON.
export const AD_STORAGE_KEY = 'kitty_enable_ads';

// Pop-up cadence (v4.29.1): the banner starts HIDDEN and pops up with a
// NEW ad after a random 30–60 s gap, stays on screen for VISIBLE_MS,
// then retracts and waits for the next gap. A joke — not a fixture.
export const POPUP_MIN_MS = 30000;
export const POPUP_MAX_MS = 60000;
export const VISIBLE_MS = 12000;

// ─── AD CATALOG (extensible — append new Eridath's Mom Enterprises
//     products here; the banner picks them up automatically) ────────────
export const AD_CATALOG = [
  {
    id: 'eridaths_moms_house',
    title: "SINGLE MOMS IN YOUR AREA! Visit Eridath's Mom's House!",
    subtitle: 'Free soup kitchen open late',
    body: 'Call 1-976-PIPE-CLEANERS ($3.99/min) for 24/7 pipe cleaning hotline!',
    // 512×512 house pixel art (embedded 256×256 in AssetSprites.js) —
    // scaled nearest-neighbor into the 64×64 sprite box (see _drawSprite).
    sprite: 'eridath_moms_house',
    cta: 'CALL 1-976-PIPE-CLEANERS',
  },
  {
    id: 'rhino_cat_9000',
    title: 'NEVER FLY HALF-STAFF AGAIN!',
    subtitle: "Eridath's Mom's Black Market Rhino-Cat 9000",
    body: "Eridath's Mom's Black Market Rhino-Cat 9000 Extra Strength Gas Station Pills. Formulated in Eridath's Mom's basement! Unlock 300% maximum cannon power! Available at all Eridath's Mom gas stations.",
    sprite: 'frenzy', // red pill — extra strength, obviously
    cta: "BUY AT MOM'S GAS STATION",
  },
  {
    id: 'only_eridaths_mom',
    title: 'ONLY-ERIDATHS-MOM.COM',
    subtitle: 'Exclusive Catship content',
    body: 'Exclusive Catship content and VIP soup kitchen footage! Unlock unlimited Frenzy power-ups!',
    sprite: 'cat_white_pink',
    cta: 'VISIT THE SITE',
  },
  {
    id: 'boneyard_disposal',
    title: "ERIDATH'S MOM'S BONEYARD DISPOSAL",
    subtitle: 'Personal burial service',
    body: "Got too many bones? Eridath's Mom will personally bury your problems fast!",
    sprite: 'profile_bone',
    cta: 'DISPOSE NOW',
  },
];

// ─── persistence (own key — the toggle belongs to the banner, not
//     Settings.js's kve-settings-v1 blob) ───────────────────────────────
function loadEnabled() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(AD_STORAGE_KEY);
      if (raw != null) return raw !== 'false';
    }
  } catch {}
  return true; // default ON
}

function persistEnabled(on) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(AD_STORAGE_KEY, on ? 'true' : 'false');
  } catch {}
}

// Browser probe: a real canvas 2D context must exist. The tools/check.mjs
// document shim returns stub elements WITHOUT getContext, so headless
// imports build no DOM (the manager stays logic-only).
function domReady() {
  try {
    if (typeof document === 'undefined') return false;
    const c = document.createElement('canvas');
    return !!(c && c.getContext && c.getContext('2d'));
  } catch {
    return false;
  }
}

export class AdBannerManager {
  constructor() {
    this.enabled = loadEnabled();
    this._index = 0;
    this._timer = null;        // pending pop-up timer
    this._visibleTimer = null; // auto-retract timer
    this._visible = false;     // banner currently on screen
    this._docked = false;      // minimized chip sitting in the FC mini-bar
    this._root = null;         // #ad-banner element
    this._sprite = null;       // 64×64 sprite canvas
    this._dock = null;         // #ad-dock chip in #fc-mini-bar
    this._build();
  }

  /** The full catalog (extensible). */
  get ads() { return AD_CATALOG; }

  /** The ad currently on screen (or the next one to pop up). */
  get current() { return AD_CATALOG[this._index]; }

  /** True while the banner is on screen. */
  get visible() { return this._visible; }

  /** True while the minimized chip is docked in the FC mini-bar. */
  get docked() { return this._docked; }

  // ─── DOM (retro 90s ad window, built entirely by this module) ────────
  _build() {
    if (!domReady()) return;
    const root = document.getElementById('game-root') || document.body;
    if (!root) return;

    const el = document.createElement('div');
    el.id = 'ad-banner';
    el.className = 'ad-banner';
    el.setAttribute('role', 'complementary');
    el.setAttribute('aria-label', "Sponsored by Eridath's Mom Enterprises");

    // Title bar — "SPONSORED BY ERIDATH'S MOM ENTERPRISES" + fake window
    // buttons (90s authenticity; clicking them does NOT close the ad).
    const bar = document.createElement('div');
    bar.className = 'ad-titlebar';
    const label = document.createElement('span');
    label.className = 'ad-titlebar-text';
    label.textContent = "SPONSORED BY ERIDATH'S MOM ENTERPRISES";
    const btns = document.createElement('span');
    btns.className = 'ad-titlebar-btns';
    const mkBtn = (cls, ch, tip) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.textContent = ch;
      b.title = tip;
      btns.appendChild(b);
      return b;
    };
    const closeBtn = mkBtn('ad-btn ad-btn-close', '✕', 'Close — Mom said no');
    const minBtn = mkBtn('ad-btn ad-btn-min', '–', 'Minimize — dock into the fire-control bar');
    const maxBtn = mkBtn('ad-btn ad-btn-max', '□', 'Maximize — Mom said no');
    bar.append(label, btns);

    // Body — 64×64 pixel-art sprite box + ad copy + CTA.
    const body = document.createElement('div');
    body.className = 'ad-body';
    const cv = document.createElement('canvas');
    cv.className = 'ad-sprite';
    cv.width = 64;
    cv.height = 64;
    const copy = document.createElement('div');
    copy.className = 'ad-copy';
    this._titleEl = document.createElement('div');
    this._titleEl.className = 'ad-title';
    this._subEl = document.createElement('div');
    this._subEl.className = 'ad-subtitle';
    this._textEl = document.createElement('div');
    this._textEl.className = 'ad-text';
    this._ctaEl = document.createElement('button');
    this._ctaEl.type = 'button';
    this._ctaEl.className = 'ad-cta';
    copy.append(this._titleEl, this._subEl, this._textEl, this._ctaEl);
    body.append(cv, copy);

    // Footer — AD badge + rotator position (1/4 …).
    const foot = document.createElement('div');
    foot.className = 'ad-footer';
    const badge = document.createElement('span');
    badge.className = 'ad-ad-badge';
    badge.textContent = 'AD';
    this._rotEl = document.createElement('span');
    this._rotEl.className = 'ad-rotator';
    foot.append(badge, this._rotEl);

    el.append(bar, body, foot);
    this._root = el;
    this._sprite = cv;
    root.appendChild(el);
    this._buildDock(); // v4.29.1: the minimized chip lives in the FC mini-bar

    // Window buttons — close/maximize are FAKE (90s authenticity, Mom
    // refuses); minimize is REAL (v4.29.1): it retracts the banner and
    // docks the "AD · MOM" chip into the fire-control mini-bar.
    const refuse = (msg) => () => bus.emit('banner', { text: msg, tone: 'bad', duration: 2 });
    closeBtn.addEventListener('click', refuse('CANNOT CLOSE — MOM APPROVES THIS SPONSORSHIP'));
    minBtn.addEventListener('click', () => this.minimize());
    maxBtn.addEventListener('click', refuse('NO MAXIMIZE — 240px IS ENOUGH FOR EVERYONE'));

    // CTA click — Mom logs your interest (bus event) and the ad wiggles.
    this._ctaEl.addEventListener('click', () => {
      bus.emit('adBannerClick', { id: this.current.id });
      el.classList.remove('ad-wiggle');
      void el.offsetWidth; // restart the CSS animation
      el.classList.add('ad-wiggle');
    });

    // v4.29.1 fix: the banner is ALWAYS built hidden — it only ever
    // appears via _popup() (30–60 s in), which renders the ad FIRST.
    // (The old `if (!this.enabled)` guard left an EMPTY window on
    // screen at boot when ads were enabled — visible but blank, and
    // minimize() refused to act because _visible was never set.)
    el.classList.add('hidden');
  }

  /** v4.29.1: the minimized chip — a small "AD · MOM" button docked into
   *  the fire-control mini-bar (#fc-mini-bar) so a minimized ad lives in
   *  the bottom bar instead of floating on the game screen. Clicking it
   *  pops the ad back up. */
  _buildDock() {
    if (!domReady()) return;
    const host = document.getElementById('fc-mini-bar') || document.getElementById('fc-dashboard');
    if (!host) return;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.id = 'ad-dock';
    chip.className = 'ad-dock';
    chip.textContent = 'AD · MOM';
    chip.title = "Eridath's Mom Enterprises — click to restore the ad";
    chip.classList.add('hidden');
    chip.addEventListener('click', () => this.restore());
    host.appendChild(chip);
    this._dock = chip;
  }

  _setDocked(docked) {
    this._docked = docked;
    if (this._dock) this._dock.classList.toggle('hidden', !docked);
  }

  // ─── lifecycle (v4.29.1: hidden start + random pop-ups) ──────────────

  /** Boot: the banner stays HIDDEN — the first pop-up arrives after a
   *  random 30–60 s gap (no-op under Node). */
  start() {
    if (!this._root) return;
    this._schedulePopup();
  }

  /** Turn the pop-up cycle on/off immediately. Off: hide the banner,
   *  undock the chip, clear all timers. On: schedule the next pop-up
   *  (30–60 s). Persists to localStorage 'kitty_enable_ads'. */
  setEnabled(on) {
    const next = !!on;
    this.enabled = next;
    persistEnabled(next);
    if (!next) {
      this._visible = false;
      this._clearTimers();
      if (this._root) this._root.classList.add('hidden');
      this._setDocked(false);
    } else {
      this._schedulePopup();
    }
  }

  toggle() { this.setEnabled(!this.enabled); }

  /** Minimize (the REAL window button): retract the banner now and dock
   *  the "AD · MOM" chip into the fire-control mini-bar. The next pop-up
   *  is scheduled 30–60 s out. */
  minimize() {
    // The banner must actually be on screen (defensive: the _visible
    // flag can lag if the DOM was shown out-of-band).
    if (!this._root || this._root.classList.contains('hidden')) return;
    if (!this._visible) {
      this._visible = true;
      this._clearVisibleTimer();
    }
    this._retract();
    this._setDocked(true);
  }

  /** Restore from the docked chip: pop the current ad back up now. */
  restore() {
    if (!this.enabled || this._visible) return;
    this._popup();
  }

  /** Pause all timers (the banner stays exactly as-is). */
  pause() { this._clearTimers(); }

  /** Resume: if visible, restart the auto-retract; if hidden, schedule
   *  the next pop-up. */
  resume() {
    if (!this.enabled) return;
    if (this._visible) {
      this._clearVisibleTimer();
      this._visibleTimer = setTimeout(() => this._retract(), VISIBLE_MS);
    } else {
      this._schedulePopup();
    }
  }

  /** Dev / easter-egg hook: pop up the NEXT ad immediately. */
  next() {
    if (!this.enabled) return;
    this._advance();
    this._popup();
  }

  // ─── pop-up state machine ─────────────────────────────────────────────

  /** Pop up the current ad (with the pop-in animation) and start the
   *  12 s auto-retract. Undocks the chip first. */
  _popup() {
    if (!this.enabled || !this._root) return;
    this._setDocked(false);
    this._renderAd();
    this._root.classList.remove('hidden');
    this._root.classList.remove('ad-pop');
    void this._root.offsetWidth; // restart the pop-in animation
    this._root.classList.add('ad-pop');
    this._visible = true;
    this._clearVisibleTimer();
    this._visibleTimer = setTimeout(() => this._retract(), VISIBLE_MS);
  }

  /** Retract (auto-hide after VISIBLE_MS, or minimize): hide the banner,
   *  advance to the NEXT ad, and wait 30–60 s for the next pop-up. */
  _retract() {
    this._visible = false;
    this._clearVisibleTimer();
    if (this._root) this._root.classList.add('hidden');
    this._advance();
    this._schedulePopup();
  }

  /** Each pop-up shows a NEW ad. */
  _advance() {
    this._index = (this._index + 1) % AD_CATALOG.length;
  }

  _schedulePopup() {
    this._clearTimers();
    if (!this.enabled) return;
    const delay = POPUP_MIN_MS + Math.random() * (POPUP_MAX_MS - POPUP_MIN_MS);
    this._timer = setTimeout(() => this._popup(), delay);
  }

  _clearTimers() {
    if (this._timer != null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._clearVisibleTimer();
  }

  _clearVisibleTimer() {
    if (this._visibleTimer != null) {
      clearTimeout(this._visibleTimer);
      this._visibleTimer = null;
    }
  }

  // ─── rendering ────────────────────────────────────────────────────────

  _renderAd() {
    if (!this._root) return;
    const ad = this.current;
    this._titleEl.textContent = ad.title;
    this._subEl.textContent = ad.subtitle;
    this._textEl.textContent = ad.body;
    this._ctaEl.textContent = ad.cta;
    this._rotEl.textContent = (this._index + 1) + '/' + AD_CATALOG.length;
    this._drawSprite(ad);
  }

  /** Nearest-neighbor blit of the ad's sprite into the 64×64 box (crisp
   *  pixel art — smoothing disabled, integer fit: the 256×256 house art
   *  scales exactly 4× down). Until the AssetSprites.js base64 decodes
   *  (or if it fails) a procedural pixel-art placeholder stands in, and
   *  the re-render fires when the decode lands. */
  _drawSprite(ad) {
    const cv = this._sprite;
    if (!cv || !cv.getContext) return;
    const ctx = cv.getContext('2d');
    disableImageSmoothing(ctx);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const sprite = ad.sprite ? getSprite(ad.sprite) : null;
    if (sprite && sprite.width > 0 && sprite.height > 0) {
      const s = Math.min(cv.width / sprite.width, cv.height / sprite.height);
      const w = Math.max(1, Math.round(sprite.width * s));
      const h = Math.max(1, Math.round(sprite.height * s));
      ctx.drawImage(sprite, Math.round((cv.width - w) / 2), Math.round((cv.height - h) / 2), w, h);
    } else {
      this._drawPlaceholder(ctx, ad);
      if (ad.sprite) {
        loadAssets([ad.sprite]).then(() => {
          if (this.current === ad) this._drawSprite(ad);
        });
      }
    }
  }

  /** Chunky 64×64 procedural fallback (8×8 grid of 8px art pixels) —
   *  one icon per ad id, drawn while the sprite decodes / if it failed. */
  _drawPlaceholder(ctx, ad) {
    const px = 8;
    const r = (gx, gy, gw, gh, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(gx * px, gy * px, gw * px, gh * px);
    };
    switch (ad.id) {
      case 'eridaths_moms_house': // little house
        r(4, 1, 1, 1, '#ff4fd8'); r(3, 2, 2, 1, '#ff4fd8'); r(2, 3, 4, 1, '#ff4fd8');
        r(2, 4, 4, 3, '#e8c15a'); r(3, 5, 2, 2, '#8a5a2b');
        r(2, 4, 1, 1, '#00e5ff'); r(5, 4, 1, 1, '#00e5ff');
        break;
      case 'rhino_cat_9000': // extra-strength pill
        r(1, 3, 1, 2, '#ff8a80'); r(2, 3, 2, 2, '#ffffff'); r(4, 3, 2, 2, '#ff5252'); r(6, 3, 1, 2, '#ff8a80');
        r(2, 5, 4, 1, '#7a1020');
        break;
      case 'only_eridaths_mom': // cat face
        r(2, 1, 1, 1, '#ff4fd8'); r(5, 1, 1, 1, '#ff4fd8');
        r(2, 2, 4, 4, '#ff9ad5');
        r(3, 3, 1, 1, '#10041f'); r(4, 3, 1, 1, '#10041f');
        r(1, 4, 1, 1, '#00e5ff'); r(6, 4, 1, 1, '#00e5ff');
        break;
      case 'boneyard_disposal': // bone
        r(1, 2, 2, 2, '#e8e8f0'); r(5, 2, 2, 2, '#e8e8f0'); r(2, 3, 4, 1, '#e8e8f0');
        break;
      default: // MOM monogram
        r(1, 1, 2, 4, '#00e5ff'); r(5, 1, 2, 4, '#00e5ff'); r(3, 2, 2, 1, '#ff4fd8');
    }
  }
}

// Singleton (same pattern as EventBus's `bus` / AudioSystem's `audio`).
// Constructed at import — DOM-safe under Node (see domReady above).
export const adBanner = new AdBannerManager();
