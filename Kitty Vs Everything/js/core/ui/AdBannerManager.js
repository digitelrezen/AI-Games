// Filename: AdBannerManager.js
// Kitty Vs Everything — v4.29.0
// Eridath's Mom Enterprises — the lower-left "sponsored by" ad banner.
//
// A decoupled, extensible UI module: it builds its OWN DOM (a retro 90s
// ad window — neon cyan/magenta borders, gradient title bar, fake
// close/minimize/maximize buttons) as a standalone overlay at the
// LOWER-LEFT of the main game screen (inside #game-root, NOT part of the
// fire-control panel) and rotates the AD_CATALOG every 8–12 s. index.html
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
//   • setEnabled(boolean) — show/hide the banner AND pause/resume the
//     rotation immediately; persists to localStorage 'kitty_enable_ads'
//     (default ON — Mom always runs the sponsorship).
//   • Fake window buttons are decorative (90s authenticity): clicking
//     them fires a bus 'banner' toast instead of closing the ad.
//   • Node-safe: importing under tools/check.mjs never touches the DOM —
//     the constructor probes canvas.getContext('2d') before building, so
//     headless checks get a live (but DOM-less) manager.
//
// Boot: main.js calls adBanner.start() (renders ad #1 + schedules the
// first 8–12 s rotation). SettingsScreen._buildAds() binds #set-ads to
// adBanner.setEnabled().

import { bus } from '../EventBus.js';
import { getSprite, loadAssets } from '../AssetManager.js';
import { disableImageSmoothing } from '../utils.js'; // v3.88.0: crisp pixel-art enforcement

export const VERSION = 'v4.29.0';

// localStorage key for the enable toggle (Settings → MONETIZATION / AD
// BANNERS). Default ON.
export const AD_STORAGE_KEY = 'kitty_enable_ads';

// Rotation window: the catalog advances every 8–12 s (randomized so the
// cadence never feels mechanical).
export const ROTATE_MIN_MS = 8000;
export const ROTATE_MAX_MS = 12000;

// ─── AD CATALOG (extensible — append new Eridath's Mom Enterprises
//     products here; the banner picks them up automatically) ────────────
export const AD_CATALOG = [
  {
    id: 'eridaths_moms_house',
    title: "SINGLE MOMS IN YOUR AREA! Visit Eridath's Mom's House!",
    subtitle: 'Free soup kitchen open late',
    body: 'Call 1-976-PIPE-CLEANERS ($3.99/min) for 24/7 pipe cleaning hotline!',
    // 512×512 house pixel art (embedded 256×256 in AssetSprites.js) —
    // scaled nearest-neighbor into the 96×96 sprite box (see _drawSprite).
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
    this._timer = null;
    this._root = null; // #ad-banner element
    this._sprite = null; // 96×96 sprite canvas
    this._build();
  }

  /** The full catalog (extensible). */
  get ads() { return AD_CATALOG; }

  /** The ad currently on screen. */
  get current() { return AD_CATALOG[this._index]; }

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
    const minBtn = mkBtn('ad-btn ad-btn-min', '–', 'Minimize — Mom said no');
    const maxBtn = mkBtn('ad-btn ad-btn-max', '□', 'Maximize — Mom said no');
    bar.append(label, btns);

    // Body — 96×96 pixel-art sprite box + ad copy + CTA.
    const body = document.createElement('div');
    body.className = 'ad-body';
    const cv = document.createElement('canvas');
    cv.className = 'ad-sprite';
    cv.width = 96;
    cv.height = 96;
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

    // Fake window buttons — decorative; the ad refuses to close.
    const refuse = (msg) => () => bus.emit('banner', { text: msg, tone: 'bad', duration: 2 });
    closeBtn.addEventListener('click', refuse('CANNOT CLOSE — MOM APPROVES THIS SPONSORSHIP'));
    minBtn.addEventListener('click', refuse('NO MINIMIZE — THE AD IS ALWAYS WATCHING'));
    maxBtn.addEventListener('click', refuse('NO MAXIMIZE — 320px IS ENOUGH FOR EVERYONE'));

    // CTA click — Mom logs your interest (bus event) and the ad wiggles.
    this._ctaEl.addEventListener('click', () => {
      bus.emit('adBannerClick', { id: this.current.id });
      el.classList.remove('ad-wiggle');
      void el.offsetWidth; // restart the CSS animation
      el.classList.add('ad-wiggle');
    });

    if (!this.enabled) el.classList.add('hidden');
  }

  // ─── lifecycle ────────────────────────────────────────────────────────

  /** Boot the banner: render ad #1 + start the 8–12 s rotation.
   *  Called from main.js at boot (no-op under Node). */
  start() {
    if (!this._root) return;
    this._renderAd();
    if (this.enabled) this._scheduleNext();
  }

  /** Show/hide the banner AND pause/resume the rotation immediately.
   *  Persists to localStorage 'kitty_enable_ads'. */
  setEnabled(on) {
    const next = !!on;
    this.enabled = next;
    persistEnabled(next);
    if (!this._root) return;
    this._root.classList.toggle('hidden', !next);
    if (next) {
      this._renderAd();
      this._scheduleNext();
    } else {
      this._clearTimer();
    }
  }

  toggle() { this.setEnabled(!this.enabled); }

  /** Pause the rotation (banner stays on screen on the current ad). */
  pause() { this._clearTimer(); }

  /** Resume the rotation (only when enabled). */
  resume() { if (this.enabled) this._scheduleNext(); }

  /** Advance to the next ad immediately (dev / easter-egg hook). */
  next() {
    if (!this.enabled || !this._root) return;
    this._index = (this._index + 1) % AD_CATALOG.length;
    this._renderAd();
    this._scheduleNext();
  }

  // ─── rotation ─────────────────────────────────────────────────────────

  _scheduleNext() {
    this._clearTimer();
    if (!this.enabled) return;
    const delay = ROTATE_MIN_MS + Math.random() * (ROTATE_MAX_MS - ROTATE_MIN_MS);
    this._timer = setTimeout(() => this.next(), delay);
  }

  _clearTimer() {
    if (this._timer != null) {
      clearTimeout(this._timer);
      this._timer = null;
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

  /** Nearest-neighbor blit of the ad's sprite into the 96×96 box (crisp
   *  pixel art — smoothing disabled, integer fit). Until the
   *  AssetSprites.js base64 decodes (or if it fails) a procedural
   *  pixel-art placeholder stands in, and the re-render fires when the
   *  decode lands. */
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

  /** Chunky 96×96 procedural fallback (12×12 grid of 8px art pixels) —
   *  one icon per ad id, drawn while the sprite decodes / if it failed. */
  _drawPlaceholder(ctx, ad) {
    const px = 8;
    const r = (gx, gy, gw, gh, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(gx * px, gy * px, gw * px, gh * px);
    };
    switch (ad.id) {
      case 'eridaths_moms_house': // little house
        r(5, 2, 2, 1, '#ff4fd8'); r(4, 3, 4, 1, '#ff4fd8'); r(3, 4, 6, 1, '#ff4fd8');
        r(3, 5, 6, 5, '#e8c15a'); r(5, 7, 2, 3, '#8a5a2b');
        r(3, 6, 1, 1, '#00e5ff'); r(8, 6, 1, 1, '#00e5ff');
        break;
      case 'rhino_cat_9000': // extra-strength pill
        r(3, 5, 1, 2, '#ff8a80'); r(4, 5, 2, 2, '#ffffff'); r(6, 5, 2, 2, '#ff5252'); r(8, 5, 1, 2, '#ff8a80');
        r(4, 7, 4, 1, '#7a1020');
        break;
      case 'only_eridaths_mom': // cat face
        r(3, 3, 1, 2, '#ff4fd8'); r(8, 3, 1, 2, '#ff4fd8');
        r(3, 4, 6, 5, '#ff9ad5');
        r(4, 6, 1, 1, '#10041f'); r(7, 6, 1, 1, '#10041f');
        r(2, 7, 1, 1, '#00e5ff'); r(9, 7, 1, 1, '#00e5ff');
        break;
      case 'boneyard_disposal': // bone
        r(3, 5, 2, 3, '#e8e8f0'); r(7, 5, 2, 3, '#e8e8f0'); r(4, 6, 4, 1, '#e8e8f0');
        break;
      default: // MOM monogram
        r(3, 4, 2, 5, '#00e5ff'); r(8, 4, 2, 5, '#00e5ff'); r(5, 5, 2, 2, '#ff4fd8');
    }
  }
}

// Singleton (same pattern as EventBus's `bus` / AudioSystem's `audio`).
// Constructed at import — DOM-safe under Node (see domReady above).
export const adBanner = new AdBannerManager();
