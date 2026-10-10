// ═══════════════════════════════════════════════════════════
//  [6ao] v4.11.0 AUDIO SUITE POLISH + ADMIN JUKEBOX — dedicated
//        weapon SFX (vulkanShot / pulseShot / railShot), the
//        zero-silent-trigger action SFX (hullHit / shieldBreak /
//        bossSpawn / overheat / dock / weaponSwitch), the SFX-bus
//        soft-clip shaper + bounded voice pool (anti-clipping), the
//        rebuilt explosion (pre-shaped crack buffer, no hollow
//        comb tail), and the DevPanel Music Jukebox (MusicScheduler
//        preview session: previewSong / stopPreview / getPreview).
//        The shoot() generic is now the ROCKET LAUNCH whoosh.
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
  console.log('\n[6ao] v4.11.0 audio suite polish + admin jukebox');
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  // ─── Anti-clipping: SFX-bus soft-clip shaper + bounded voice pool ───
  const coreSrc = read('js/core/audio/AudioCore.js');
  check('core: SFX bus runs through a soft-clip WaveShaper (sfxBus → sfxShaper → masterGain)',
    coreSrc.includes('this.sfxShaper = ctx.createWaveShaper()')
    && coreSrc.includes('this.sfxBus.connect(this.sfxShaper)')
    && coreSrc.includes('this.sfxShaper.connect(this.masterGain)'));
  check('core: shaper curve is the SynthVoice softClipCurve (tanh, 2x oversample)',
    coreSrc.includes('softClipCurve(') && coreSrc.includes("oversample = '2x'")
    && coreSrc.includes("import { softClipCurve } from './SynthVoice.js'"));
  check('core: shaper node nulled on close (no dangling graph)',
    coreSrc.includes('this.sfxShaper = null'));
  const synthSrc = read('js/core/audio/SynthVoice.js');
  check('SynthVoice: softClipCurve() helper exported',
    synthSrc.includes('export function softClipCurve('));
  const sfxSrc = read('js/core/audio/SoundEffects.js');
  check('sfx: bounded live-source pool with oldest-voice stealing (anti-starvation)',
    sfxSrc.includes('MAX_LIVE_SOURCES') && sfxSrc.includes('this._live')
    && /shift\(\)|first|oldest/i.test(sfxSrc));

  // Strip // comment lines so header notes (which mention the old generic
  // voices) don't trip the "no longer calls the generic" gates.
  const code = (src) => src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  // ─── Weapon SFX: dedicated voices + the rocket-launch whoosh ───
  check('sfx: shoot() is now the rocket launch whoosh (bandpass noise sweep 500→2400 Hz)',
    sfxSrc.includes('ROCKET LAUNCH whoosh')
    && /frequency\.setValueAtTime\(500/.test(sfxSrc)
    && /exponentialRampToValueAtTime\(2400/.test(sfxSrc));
  check('sfx: explosion uses a pre-shaped crack buffer (no hollow comb tail)',
    sfxSrc.includes('PRE-SHAPED noise buffer') && sfxSrc.includes('this._boom'));
  for (const m of ['vulkanShot', 'pulseShot', 'railShot', 'hullHit', 'shieldBreak', 'bossSpawn', 'overheat', 'dock', 'weaponSwitch']) {
    check(`sfx: ${m}() voice defined`, new RegExp(`${m}\\s*\\(\\)\\s*\\{`).test(sfxSrc));
  }

  // ─── Gameplay wiring: zero silent triggers ───
  const vulkanSrc = read('js/combat/VulcanCannon.js');
  check('VulcanCannon: fire() plays audio.vulkanShot() (not the generic shoot())',
    code(vulkanSrc).includes('audio.vulkanShot()') && !code(vulkanSrc).includes('audio.shoot()'));
  check('VulcanCannon: overheat lockout plays audio.overheat()',
    code(vulkanSrc).includes('audio.overheat()'));
  const pulseSrc = read('js/combat/PulseCannon.js');
  check('PulseCannon: fire() plays audio.pulseShot() (not the generic shoot())',
    code(pulseSrc).includes('audio.pulseShot()') && !code(pulseSrc).includes('audio.shoot()'));
  const railSrc = read('js/combat/RailCannon.js');
  check('RailCannon: fire() plays audio.railShot() (not the generic tone())',
    code(railSrc).includes('audio.railShot()') && !code(railSrc).includes('audio.tone(200'));
  const rocketSrc = read('js/combat/BaseRocket.js');
  check('BaseRocket: twin-salvo launch still plays audio.shoot() (now the whoosh)',
    rocketSrc.includes('audio.shoot()'));
  const playerSrc = read('js/player/Player.js');
  check('Player.hit: shield break plays audio.shieldBreak()',
    playerSrc.includes('audio.shieldBreak()'));
  check('Player.hit: non-lethal hull damage plays audio.hullHit() (death keeps explosion())',
    playerSrc.includes('audio.hullHit()') && playerSrc.includes('this.hp > 0 && this.hp < hpBefore'));
  const waveSrc = read('js/core/WaveManager.js');
  check('WaveManager.spawn: boss + finalboss tiers play audio.bossSpawn()',
    waveSrc.includes('audio.bossSpawn()') && waveSrc.includes("s.tier === 'boss'") && waveSrc.includes("s.tier === 'finalboss'"));
  const pwSrc = read('js/player/PlayerWeapons.js');
  check('PlayerWeapons.cycleWeapon plays audio.weaponSwitch()',
    pwSrc.includes('audio.weaponSwitch()'));
  const fleetSrc = read('js/player/PlayerFleet.js');
  check('PlayerFleet.addMini plays audio.dock()',
    fleetSrc.includes('audio.dock()'));

  // ─── MusicScheduler: jukebox preview session ───
  const schedSrc = read('js/core/audio/MusicScheduler.js');
  check('scheduler: previewSong(id) hard-kills any current session + arms the preview',
    schedSrc.includes('previewSong(id)') && schedSrc.includes('this._preview = id')
    && schedSrc.includes('if (this.playing) this.stop({ hard: true })'));
  check('scheduler: stopPreview() clears the preview + stops',
    schedSrc.includes('stopPreview()') && schedSrc.includes('this._preview = null'));
  check('scheduler: getPreview() reports the preview id (null = none)',
    schedSrc.includes('getPreview() { return this._preview; }'));
  check('scheduler: preview WRAPS at song end (loops the track, no playlist rotation)',
    schedSrc.includes('if (this._preview)') && schedSrc.includes('if (this._songStep >= total) this._songStep = 0'));
  check('scheduler: gameplay start()/stop() clear the preview state',
    (schedSrc.match(/this\._preview = null;/g) || []).length >= 3);

  // ─── DevPanel jukebox UI ───
  const htmlSrc = read('index.html');
  check('index.html: jukebox section (v4.16.0 dropdown picker + stop button + status line)',
    htmlSrc.includes('<select id="dev-jukebox"') && htmlSrc.includes('id="dev-jukebox-stop"')
    && htmlSrc.includes('id="dev-jukebox-status"'));
  const devSrc = read('js/ui/DevPanel.js');
  check('DevPanel: imports SONGS + PLAYLISTS (v4.15.0) + the audio facade for the jukebox',
    devSrc.includes("import { SONGS, PLAYLISTS } from '../core/audio/MusicPlaylists.js'")
    && devSrc.includes("import { audio } from '../core/AudioSystem.js'"));
  check('DevPanel: v4.16.0 builds the dropdown picker (one <option> per SONGS track) + stop + live status',
    devSrc.includes('jukebox.add(new Option(') && devSrc.includes('audio.previewSong(jukebox.value)')
    && devSrc.includes('audio.stopPreview()') && devSrc.includes('audio.getPreviewSong()')
    && devSrc.includes('Object.values(SONGS)'));
  const cssSrc = read('style.css');
  check('style.css: v4.16.0 jukebox picker is a <select> (styled by .dev-section select; old .dev-jukebox list styles removed)',
    cssSrc.includes('.dev-section select {') && !cssSrc.includes('.dev-jukebox {'));

  // ─── Module surface ───
  const coreMod = await mod('js/core/audio/AudioCore.js');
  const core = new coreMod.AudioCore();
  const sfxMod = await mod('js/core/audio/SoundEffects.js');
  const sfx = new sfxMod.SoundEffects(core);
  for (const m of ['vulkanShot', 'pulseShot', 'railShot', 'shoot', 'hit', 'explosion', 'hullHit', 'shieldBreak', 'bossSpawn', 'overheat', 'dock', 'weaponSwitch', 'coin', 'powerup', 'banner', 'superWeapon', 'gameOver', 'clearAll']) {
    check(`SoundEffects.${m} is a function`, typeof sfx[m] === 'function');
  }
  const schedMod = await mod('js/core/audio/MusicScheduler.js');
  const sched = new schedMod.MusicScheduler(core);
  for (const m of ['previewSong', 'stopPreview', 'getPreview']) {
    check(`MusicScheduler.${m} is a function`, typeof sched[m] === 'function');
  }

  // ─── Facade surface (the public `audio` singleton) ───
  const facade = await mod('js/core/AudioSystem.js');
  check('facade: VERSION v4.11.0', facade.VERSION === 'v4.11.0');
  const a = facade.audio;
  for (const m of ['vulkanShot', 'pulseShot', 'railShot', 'shoot', 'hit', 'explosion', 'hullHit', 'shieldBreak', 'bossSpawn', 'overheat', 'dock', 'weaponSwitch',
    'previewSong', 'stopPreview', 'getPreviewSong']) {
    check(`audio.${m} is a function`, typeof a[m] === 'function');
  }

  // ─── Headless behavior: jukebox preview lifecycle + SFX safety ───
  check('headless: previewSong() with a bogus id is a no-op (returns false)',
    a.previewSong('not-a-song') === false && a.getPreviewSong() === null);
  a.previewSong('metallica-nem');
  check('headless: previewSong() arms state without an AudioContext (playing + preview id)',
    a.musicPlaying === true && a.getPreviewSong() === 'metallica-nem');
  a.previewSong('tool-forty-six');
  check('headless: re-previewing swaps the track (singleton session)',
    a.getPreviewSong() === 'tool-forty-six');
  a.stopPreview();
  check('headless: stopPreview() clears the preview + drops the session',
    a.getPreviewSong() === null && a.musicPlaying === false);
  a.previewSong('tool-pneuma');
  a.startMusic();
  check('headless: gameplay startMusic() clears the preview (game music wins)',
    a.getPreviewSong() === null && a.musicPlaying === true);
  a.stopMusic();
  for (const m of ['vulkanShot', 'pulseShot', 'railShot', 'shoot', 'explosion', 'hullHit', 'shieldBreak', 'bossSpawn', 'overheat', 'dock', 'weaponSwitch']) {
    a[m](); // must be headless-safe (no crash without an AudioContext)
  }
  check('headless: every new SFX call is crash-free without an AudioContext', true);
  a.stopAllMusic();
  a.resetAudioEngine();
}
