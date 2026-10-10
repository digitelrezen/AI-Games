// ═══════════════════════════════════════════════════════════
//  [6aq] v4.13.0 WEAPON SFX BALANCE + VULCAN REDESIGN — the
//        Catship primary weapon fire (vulkanShot / pulseShot /
//        railShot) routes through a dedicated WEAPON BUS
//        (WEAPON_BUS_GAIN 0.65, a ~35% reduction) wired into
//        the SFX bus, so continuous Gatling fire blends under
//        the music bed + impact SFX instead of drowning them.
//        vulkanShot() is rebuilt as a fast, heavy, dual-layer
//        mechanical snap: a LOW-MID TRANSIENT CLICK (180–270 Hz
//        square "thock") under a PUNCHY NOISE BURST (480–820 Hz
//        bandpass casing pop), both with subtle per-shot pitch
//        variance (bandpass center + playbackRate jitter) — the
//        high-pitched screech/chirp (the v4.11.0 1800–2700 Hz
//        bandpass + 1500–2000 Hz square click) is GONE. Total
//        voice life stays under the 70 ms Gatling cadence.
//        v4.20.0: CANNON DE-PITCH — the Pulse + Rail cannon voices
//        dropped ~40% so they no longer sound like toys: the pulse
//        energy core 900→180 Hz is now 520→105 Hz (zap click
//        2400→900 → 1400→520 Hz), the rail discharge zing 2800→7500 Hz
//        is now 1100→3200 Hz (crack highpass 4500 → 3200 Hz).
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
  console.log('\n[6aq] v4.13.0 weapon SFX balance + vulcan redesign');
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const sfxSrc = read('js/core/audio/SoundEffects.js');

  // Strip // comment lines so the v4.11.0 header history note (which
  // mentions the old screech frequencies) doesn't trip the "screech is
  // gone" gates.
  const code = (src) => src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const codeSrc = code(sfxSrc);

  // ─── Primary-weapon master bus (30–40% under the raw SFX bus) ───
  const m = codeSrc.match(/WEAPON_BUS_GAIN\s*=\s*([0-9.]+)/);
  check('sfx: WEAPON_BUS_GAIN constant defined', !!m, 'not found');
  check('sfx: WEAPON_BUS_GAIN in the 0.6–0.7 range (30–40% reduction)',
    !!m && +m[1] >= 0.6 && +m[1] <= 0.7, m ? `got ${m[1]}` : 'not found');
  check('sfx: weapon bus is a GainNode wired into the SFX bus',
    codeSrc.includes('this._wBus = ctx.createGain()')
    && codeSrc.includes('this._wBus.connect(this.core.sfxBus)'));
  check('sfx: weapon bus cached per AudioContext (rebuilt on engine reset)',
    codeSrc.includes('this._wBusCtx') && codeSrc.includes('this._wBusCtx !== ctx'));
  check('sfx: _weaponBus() helper defined', /_weaponBus\(ctx\)\s*\{/.test(codeSrc));

  // Extract each weapon voice body (code only, comments stripped).
  const body = (name) => {
    const m2 = codeSrc.match(new RegExp(`${name}\\s*\\(\\)\\s*\\{[\\s\\S]*?\\n  \\}`));
    return m2 ? m2[0] : '';
  };
  for (const w of ['vulkanShot', 'pulseShot', 'railShot']) {
    check(`sfx: ${w}() routes through the weapon bus`, body(w).includes('this._weaponBus(ctx)'));
  }
  check('sfx: rocket whoosh (shoot()) stays on the raw SFX bus (not a primary weapon)',
    !body('shoot').includes('this._weaponBus(ctx)') && body('shoot').includes('this.core.sfxBus'));

  // ─── Vulcan redesign: heavy dual-layer snap, no high-pitched screech ───
  const vulkan = body('vulkanShot');
  check('vulkan: low-mid transient click (180–270 Hz square "thock")',
    /freq:\s*180\s*\+\s*Math\.random\(\)\s*\*\s*90/.test(vulkan) && vulkan.includes("type: 'square'"));
  check('vulkan: punchy noise burst (480–820 Hz bandpass casing pop)',
    /bp\.frequency\.value\s*=\s*480\s*\+\s*Math\.random\(\)\s*\*\s*340/.test(vulkan)
    && vulkan.includes("bp.type = 'bandpass'"));
  check('vulkan: subtle per-shot pitch variance (playbackRate jitter)',
    /playbackRate\.value\s*=\s*0\.9\s*\+\s*Math\.random\(\)\s*\*\s*0\.18/.test(vulkan));
  check('vulkan: no high-pitched screech/chirp (old 1800–2700 / 1500–2000 voices gone)',
    !/1800\s*\+\s*Math\.random/.test(vulkan) && !/1500\s*\+\s*Math\.random/.test(vulkan)
    && !/frequency\.value\s*=\s*[12]\d{3}/.test(vulkan)
    && !/freq:\s*[12]\d{3}/.test(vulkan));
  check('vulkan: total voice life under the 70 ms Gatling cadence',
    /src\.stop\(t0 \+ 0\.048\)/.test(vulkan) && /dur:\s*0\.022/.test(vulkan));

  // ─── v4.20.0: CANNON DE-PITCH — the Pulse + Rail cannon voices dropped
  // ~40% so they no longer sound like toys (the v4.11.0 900→180 Hz pulse
  // core and the 2800→7500 Hz rail zing are gone) ───
  const pulse = body('pulseShot');
  const rail = body('railShot');
  check('pulse: energy core de-pitched (520→105 Hz sweep, was 900→180 Hz)',
    /freq:\s*520,\s*slideTo:\s*105/.test(pulse) && !/freq:\s*900/.test(pulse));
  check('pulse: zap click de-pitched (1400→520 Hz, was 2400→900 Hz)',
    /freq:\s*1400,\s*slideTo:\s*520/.test(pulse) && !/freq:\s*2400/.test(pulse));
  check('rail: discharge zing de-pitched (1100→3200 Hz, was the toy-bright 2800→7500 Hz)',
    /freq:\s*1100,\s*slideTo:\s*3200/.test(rail) && !/freq:\s*2800/.test(rail));
  check('rail: crack highpass lowered (3200 Hz, was 4500 Hz)',
    /hp\.frequency\.value\s*=\s*3200/.test(rail) && !/hp\.frequency\.value\s*=\s*4500/.test(rail));

  // ─── Module version + headless safety ───
  const sfxMod = await mod('js/core/audio/SoundEffects.js');
  check('SoundEffects: VERSION v4.13.0', sfxMod.VERSION === 'v4.13.0', `got ${sfxMod.VERSION}`);
  const coreMod = await mod('js/core/audio/AudioCore.js');
  const core = new coreMod.AudioCore();
  const sfx = new sfxMod.SoundEffects(core);
  for (const wm of ['vulkanShot', 'pulseShot', 'railShot']) {
    sfx[wm](); // must be headless-safe (no crash without an AudioContext)
  }
  check('headless: weapon fire voices are crash-free without an AudioContext', true);
  sfx.clearAll();
}
