// Filename: HUDFireControl.js
// Kitty Vs Everything — v3.47.0
// Bottom sci-fi fire-control dashboard panel: hull/shield meters, speed
// readout, weapon status (READY / HOT / LOCKED), the three secondary-weapon
// slots (STUN / NAPALM / NOVA) with live cooldown bars + bound-key labels,
// and the docked-fleet strip. Pure DOM updates — no canvas.
// v3.16.0: fleet deploy status (DOCKED = inert / DEPLOYED = combat orbit)
//          read from player.fleetDeployed (MiniDeploy.js).
// v3.18.0: dashboard re-laid-out as a 3-column grid (index.html + style.css
//          only — every DOM id this file reads is unchanged, no JS changes).
// v3.19.0: combat console integrated into the left column (TIME moved into
//          its header's top-right corner), SPD readout moved to the far
//          right, mini HP bars now side-by-side under the shield bar
//          (index.html + style.css only — every DOM id this file reads is
//          unchanged, no JS changes).
// v3.21.0: M key toggles the panel between the full dashboard and a clean
//          single minimized bar (#fc-mini-bar) showing HULL + SHIELD only.
//          toggleMinimized()/setMinimized() drive the .minimized class on
//          #fc-dashboard; Game.start() resets it to expanded each mission.
// v3.29.0: TIME readout switched from 24-hour HH:MM to 12-hour h:MM AM/PM
//          (e.g. "9:41 PM") — player preference. Still reads `new Date()`
//          directly (the realTimeClock singleton only syncs during Internet
//          Bonus rounds, so it can't feed the always-visible HUD).
// v3.33.0: FRENZY indicator (#frenzy-indicator) — gold pulsing
//          "⚡ FRENZY Ns" chip in the weapon panel while player.frenzyTime
//          > 0 (all cooldowns off, Vulcan overheat neutralized). The
//          weapon status naturally reads READY / T:0 during FRENZY since
//          PlayerWeapons.js holds fireTimer/thermal/thermalLockout at zero.
// v3.45.0: NOVA meter (F slot) — purple charge/cooldown/ready. Replaces the
//          old "minis.length > 0" ready flag. charge = synergy (superCharge,
//          the old gold ring), cooldown = ultimate recovery (ultimateCooldown),
//          ready = fully charged & off cooldown. The ship-side rings are gone;
//          this slot is the sole Nova display (nova-ready/-charging/-cooldown).
// v3.47.0: NOVA slot key label now tracks the 'synergy' action (T / -
//          default) — the Synergy Explosion is key-triggered (PlayerFleet.js)
//          instead of the old 10s auto-fire. Slot state logic unchanged
//          (superCharge / ultimateCooldown / nova-ready/-charging/-cooldown).
// v3.96.0: the 'synergy' action is now FLEET ORBIT — the slot label reads
//          "Fleet Orbit"; superCharge is a HUD color-match meter only.
// v4.2.0: FIRE-CONTROL PANEL REDESIGN — (1) the SPD readout is GONE: its
//          right-column slot now hosts the embedded radar scope (#fc-radar);
//          RadarManager renders the live SAR scope there while the panel is
//          expanded, and this module draws the idle NO SIGNAL / RADAR OFF
//          scope in every other state (classic mode, radar toggled off).
//          (2) the lower button array is a 2×2 grid: STUN (Q) / NAPALM (E) /
//          SUPER (F — the old T-keyed NOVA slot, now keyed to the 'ultimate'
//          action with a live cooldown timer) / ORBIT (T — the undock/redock
//          toggle state, DOCKED <-> ORBITING, from player.fleetOrbiting).
// v4.27.0: EXPANDED MINIMIZED BAR — the M-key collapsed strip (#fc-mini-bar)
//          now carries more combat readouts besides HULL + SHIELD: the FRENZY
//          countdown chip (#fc-mini-frenzy — mirrors #frenzy-indicator, gold
//          pulse, hidden unless player.frenzyTime > 0), the weapon name +
//          READY/HOT/LOCKED status (#fc-mini-weapon / #fc-mini-weapon-status),
//          the SUPER (ultimate) charge/cooldown state (#fc-mini-super), and
//          the fleet count + orbit state (#fc-mini-fleet).
export const VERSION = 'v4.27.0';
import { WEAPONS, PLAYER, MINI_SHIP, SAR } from '../core/config.js';
import { getBinds, codeLabel } from '../input/Keybinds.js';
import { bus } from '../core/EventBus.js';
import { TAU } from '../core/utils.js';

function byId(id) { return document.getElementById(id); }

export default class HUDFireControl {
  constructor(game) {
    this.game = game;
    this.el = byId('fc-dashboard'); // v3.21.0: panel root (minimized class target)
    this.els = {
      hpFill: byId('hp-fill'), hpText: byId('hp-text'),
      shieldFill: byId('shield-fill'), shieldText: byId('shield-text'),
      radarCanvas: byId('fc-radar'), // v4.2.0: embedded radar scope (replaces the SPD readout)
      time: byId('fc-time'), // v3.17.0: live system time readout
      weaponLabel: byId('weapon-label'),
      weaponStatus: byId('fc-weapon-status'),
      thermal: byId('thermal-indicator'),
      stunSlot: byId('stun-slot'), napalmSlot: byId('napalm-slot'),
      superSlot: byId('super-slot'), orbitSlot: byId('orbit-slot'), // v4.2.0: 2×2 action matrix
      frenzy: byId('frenzy-indicator'), // v3.33.0: FRENZY indicator (30s all-cooldowns-off)
      fleetRow: byId('fleet-row'), fleetCount: byId('fc-fleet-count'),
      fleetDeploy: byId('fc-fleet-deploy'), // v3.16.0: deploy status
      // v3.21.0: minimized bar (M key) — compact hull/shield strip
      miniHpFill: byId('fc-mini-hp-fill'), miniHpText: byId('fc-mini-hp-text'),
      miniShieldFill: byId('fc-mini-shield-fill'), miniShieldText: byId('fc-mini-shield-text'),
      // v4.27.0: expanded minimized bar — frenzy countdown + weapon / super / fleet
      miniFrenzy: byId('fc-mini-frenzy'),
      miniWeapon: byId('fc-mini-weapon'), miniWeaponStatus: byId('fc-mini-weapon-status'),
      miniSuper: byId('fc-mini-super'), miniFleet: byId('fc-mini-fleet'),
    };
    // Re-sync slot key labels whenever keybinds change.
    bus.on('keybindsChanged', () => { this._keysDirty = true; });
    this._keysDirty = true;
    // v3.21.0: M toggles the fire-control panel (minimize / expand).
    // Same pattern as PauseMenu (Esc/P) and TestAimbot (T): a module-owned
    // window keydown listener, guarded against repeats, text-entry targets,
    // the hidden (menu/game-over) panel, and a paused mission.
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyM' || e.repeat) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!this.el || this.el.classList.contains('hidden')) return;
      if (this.game.paused) return;
      this.toggleMinimized();
    });
  }

  /** v3.21.0: flip the panel between full dashboard and minimized bar. */
  toggleMinimized() {
    if (!this.el) return;
    this.el.classList.toggle('minimized');
  }

  /** v3.21.0: set the panel state explicitly (Game.start() → expanded). */
  setMinimized(v) {
    if (!this.el) return;
    this.el.classList.toggle('minimized', !!v);
  }

  _slotLabel(slotEl, action) {
    if (!slotEl) return;
    const binds = getBinds(action);
    const keyEl = slotEl.querySelector('.fc-slot-key');
    if (keyEl) keyEl.textContent = binds.length ? codeLabel(binds[0]) : '—';
  }

  update() {
    const g = this.game, p = g.player, e = this.els;
    if (!p) return;
    // v3.15.0: defensive guard — if the dashboard DOM is missing (e.g. an
    // older index.html), skip instead of throwing. A TypeError here used to
    // kill Game.loop before render(), freezing the whole game.
    if (!e.hpFill || !e.shieldFill || !e.weaponStatus) return;

    // ─── HULL / SHIELD METERS ───
    const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
    const shPct = Math.max(0, (p.shield / p.maxShield) * 100);
    e.hpFill.style.width = hpPct + '%';
    e.shieldFill.style.width = shPct + '%';
    e.hpFill.classList.toggle('crit', hpPct < 30);
    e.hpText.textContent = String(Math.max(0, Math.ceil(p.hp)));
    e.shieldText.textContent = p.maxShield > 0 ? String(Math.max(0, Math.ceil(p.shield))) : '—';

    // ─── v3.21.0: MINIMIZED BAR (M key) — mirrors hull/shield when collapsed ───
    if (e.miniHpFill && e.miniShieldFill) {
      e.miniHpFill.style.width = hpPct + '%';
      e.miniHpFill.classList.toggle('crit', hpPct < 30);
      e.miniHpText.textContent = String(Math.max(0, Math.ceil(p.hp)));
      e.miniShieldFill.style.width = shPct + '%';
      e.miniShieldText.textContent = p.maxShield > 0 ? String(Math.max(0, Math.ceil(p.shield))) : '—';
    }

    // ─── v4.2.0: SPEED READOUT REMOVED — the SPD block's slot now hosts
    // the embedded radar scope (#fc-radar, drawn by RadarManager / below). ───

    // ─── v3.17.0: LIVE SYSTEM TIME (re-read ≤1×/s) ───
    // v3.29.0: 12-hour h:MM AM/PM (e.g. "9:41 PM") instead of 24-hour.
    if (e.time) {
      const now = new Date();
      const h24 = now.getHours();
      const label = (h24 % 12 || 12) + ':' + String(now.getMinutes()).padStart(2, '0')
        + ' ' + (h24 < 12 ? 'AM' : 'PM');
      if (this._lastTime !== label) {
        this._lastTime = label;
        e.time.textContent = label;
      }
    }

    // ─── WEAPON STATUS ───
    const w = WEAPONS[p.weapon];
    e.weaponLabel.textContent = w.name + (p.minis.length ? ' ×' + (1 + p.minis.length) : '');
    const heatPct = p.thermal / w.thermalMax;
    if (p.thermalLockout > 0) {
      e.weaponStatus.textContent = 'LOCKED ' + p.thermalLockout.toFixed(1) + 's';
      e.weaponStatus.className = 'fc-weapon-status locked';
    } else if (heatPct > 0.7) {
      e.weaponStatus.textContent = 'HOT ' + Math.round(heatPct * 100) + '%';
      e.weaponStatus.className = 'fc-weapon-status hot';
    } else {
      e.weaponStatus.textContent = 'READY';
      e.weaponStatus.className = 'fc-weapon-status ready';
    }
    if (e.thermal) {
      e.thermal.className = p.thermalLockout > 0 ? 'thermal-lockout' : (heatPct > 0.7 ? 'thermal-warn' : 'thermal-ok');
      e.thermal.textContent = p.thermalLockout > 0 ? '🔥 LOCK' : 'T:' + Math.round(heatPct * 100);
    }
    // ─── v4.27.0: MINIMIZED BAR — weapon name + status (mirrors the panel) ───
    if (e.miniWeapon && e.miniWeaponStatus) {
      e.miniWeapon.textContent = w.name;
      e.miniWeaponStatus.textContent = e.weaponStatus.textContent;
      e.miniWeaponStatus.className = e.weaponStatus.className;
    }

    // ─── v3.33.0: FRENZY INDICATOR (30s all-cooldowns-off, no overheat) ───
    // Shown while player.frenzyTime > 0; the weapon status above naturally
    // reads READY / T:0 during FRENZY (PlayerWeapons.js holds the fire
    // cooldown + all thermal state at zero).
    if (e.frenzy) {
      if (p.frenzyTime > 0) {
        e.frenzy.textContent = '⚡ FRENZY ' + Math.ceil(p.frenzyTime) + 's';
        e.frenzy.classList.remove('hidden');
      } else {
        e.frenzy.classList.add('hidden');
      }
    }
    // ─── v4.27.0: the minimized bar carries the same FRENZY countdown chip ───
    if (e.miniFrenzy) {
      if (p.frenzyTime > 0) {
        e.miniFrenzy.textContent = '⚡ FRENZY ' + Math.ceil(p.frenzyTime) + 's';
        e.miniFrenzy.classList.remove('hidden');
      } else {
        e.miniFrenzy.classList.add('hidden');
      }
    }

    // ─── SECONDARY SLOTS (cooldown bars + bound keys) ───
    this._updateSlot(e.stunSlot, 'stun', p.stunCooldown, PLAYER.STUN_COOLDOWN);
    this._updateSlot(e.napalmSlot, 'napalm', p.napalmCooldown, PLAYER.NAPALM_COOLDOWN);
    // ─── v4.2.0: SUPER slot (F) — the ultimate's live cooldown timer.
    // Renamed from the T-keyed NOVA slot: the key now tracks the 'ultimate'
    // action (F / C). charge = superCharge (HUD color-match read only since
    // v3.96.0); cooldown = ultimate recovery (ultimateCooldown); ready =
    // charged & off cooldown. ───
    if (e.superSlot) {
      const maxCd = p.ULTIMATE_COOLDOWN || 8;
      const onCooldown = p.ultimateCooldown > 0;
      const charge = Math.max(0, Math.min(1, p.superCharge || 0));
      const ready = !onCooldown && charge >= 1;
      const charging = !onCooldown && !ready;
      e.superSlot.classList.toggle('super-ready', ready);
      e.superSlot.classList.toggle('super-charging', charging);
      e.superSlot.classList.toggle('super-cooldown', onCooldown);
      const st = e.superSlot.querySelector('.fc-slot-state');
      if (st) st.textContent = onCooldown ? p.ultimateCooldown.toFixed(1) + 's' : (ready ? 'READY' : 'CHARGING');
      const bar = e.superSlot.querySelector('.fc-slot-bar .fc-slot-fill');
      if (bar) {
        const pct = onCooldown ? (1 - p.ultimateCooldown / maxCd) * 100 : charge * 100;
        bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
      }
      // ─── v4.27.0: the minimized bar mirrors the SUPER state (text only) ───
      if (e.miniSuper) {
        e.miniSuper.textContent = onCooldown ? p.ultimateCooldown.toFixed(1) + 's' : (ready ? 'READY' : 'CHARGING');
        e.miniSuper.className = 'fc-readout ' + (onCooldown ? 'cooldown' : ready ? 'ready' : 'charging');
      }
    }
    // ─── v4.2.0: ORBIT slot (T) — the undock/redock toggle state.
    // DOCKED = minis on the flank hardpoints (inert); ORBITING = the flat-
    // circle combat orbit (MiniDeploy.toggleFleetOrbit, 'synergy' action). ───
    if (e.orbitSlot) {
      const orbiting = !!p.fleetOrbiting;
      e.orbitSlot.classList.toggle('orbit-active', orbiting);
      e.orbitSlot.classList.toggle('orbit-docked', !orbiting);
      const st = e.orbitSlot.querySelector('.fc-slot-state');
      if (st) st.textContent = orbiting ? 'ORBITING' : 'DOCKED';
      const bar = e.orbitSlot.querySelector('.fc-slot-bar .fc-slot-fill');
      if (bar) bar.style.width = orbiting ? '100%' : '0%';
    }
    if (this._keysDirty) {
      this._slotLabel(e.stunSlot, 'stun');
      this._slotLabel(e.napalmSlot, 'napalm');
      this._slotLabel(e.superSlot, 'ultimate');
      this._slotLabel(e.orbitSlot, 'synergy');
      this._keysDirty = false;
    }

    // ─── FLEET STRIP (docked mini-ships) ───
    e.fleetCount.textContent = String(p.minis.length) + '/' + MINI_SHIP.maxDocked;
    // ─── v3.16.0: FLEET DEPLOY STATUS (DOCKED = inert, DEPLOYED = orbit) ───
    if (e.fleetDeploy) {
      const deployed = p.fleetDeployed && p.minis.length > 0;
      e.fleetDeploy.textContent = deployed ? 'DEPLOYED' : 'DOCKED';
      e.fleetDeploy.className = 'fc-fleet-deploy ' + (deployed ? 'deployed' : 'docked');
    }
    // ─── v4.27.0: the minimized bar mirrors the fleet count + orbit state ───
    if (e.miniFleet) {
      const orbiting = !!p.fleetOrbiting;
      e.miniFleet.textContent = p.minis.length + '/' + MINI_SHIP.maxDocked + (orbiting ? ' ORBIT' : ' DOCKED');
    }
    const minis = e.fleetRow.querySelectorAll('.fleet-mini');
    minis.forEach((el, i) => {
      const mini = p.minis[i];
      if (!mini) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.classList.remove('fleet-hit');
      const pct = Math.max(0, (mini.hp / mini.maxHp) * 100);
      const fill = el.querySelector('.fleet-fill');
      fill.style.width = pct + '%';
      fill.className = 'fleet-fill ' + (pct > 60 ? 'ok' : pct > 30 ? 'warn' : 'crit');
      el.querySelector('.fleet-num').textContent = String(Math.max(0, Math.ceil(mini.hp)));
    });

    // ─── v4.2.0: EMBEDDED RADAR SCOPE (idle state) ───
    // While the panel is expanded, the LIVE SAR scope is drawn into the same
    // canvas by RadarManager (sard.renderHud, later in the same frame) — so
    // only draw the idle scope when there is no live radar: classic mode
    // (NO SIGNAL) or SAR with the radar toggled off (RADAR OFF). The
    // standalone bottom-right screen radar is suppressed in this state.
    if (e.radarCanvas && this._panelExpanded()) {
      const radar = (g.mode === 'sard' && g.sard) ? g.sard.radar : null;
      if (!(radar && radar.visible)) {
        const ctx = e.radarCanvas.getContext('2d');
        if (radar) this._drawRadarIdle(ctx, 'RADAR OFF', '[' + SAR.RADAR.KEY + '] TO ENABLE');
        else this._drawRadarIdle(ctx, 'NO SIGNAL', 'SAR AVIONICS OFFLINE');
      }
    }
  }

  /** v4.2.0: true while the full dashboard columns are on screen. */
  _panelExpanded() {
    return !!this.el && !this.el.classList.contains('hidden') && !this.el.classList.contains('minimized');
  }

  /**
   * v4.2.0: dimmed idle scope for the embedded radar canvas (#fc-radar).
   * Same geometry as the live embedded scope (RadarManager._renderEmbedded)
   * so the two never disagree: R = 62, center (w/2, R + 8).
   */
  _drawRadarIdle(ctx, label, hint) {
    const c = this.els.radarCanvas;
    const w = c.width, h = c.height;
    const R = 62, cx = w / 2, cy = R + 8;
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
    bg.addColorStop(0, 'rgba(0, 40, 48, 0.45)');
    bg.addColorStop(1, 'rgba(0, 20, 26, 0.6)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
    ctx.lineWidth = 1;
    for (const f of [0.33, 0.66, 1]) {
      ctx.beginPath();
      ctx.arc(cx, cy, R * f, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0, 229, 255, 0.65)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + 3);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.5)';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(hint, cx, cy + R + 14);
    ctx.textAlign = 'left';
  }

  _updateSlot(slotEl, action, cooldown, maxCooldown) {
    if (!slotEl) return;
    const ready = cooldown <= 0;
    slotEl.classList.toggle('ready', ready);
    slotEl.classList.toggle('cooldown', !ready);
    const st = slotEl.querySelector('.fc-slot-state');
    if (st) st.textContent = ready ? 'READY' : cooldown.toFixed(1) + 's';
    const bar = slotEl.querySelector('.fc-slot-bar .fc-slot-fill');
    if (bar) bar.style.width = (ready ? 100 : (1 - cooldown / maxCooldown) * 100) + '%';
  }
}