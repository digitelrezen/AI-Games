// ═══════════════════════════════════════════════════════════
//  [6an] v4.9.0 AUDIO MODULARIZATION — the AudioSystem.js monolith is
//        split into js/core/audio/ (AudioCore / SoundEffects /
//        MusicScheduler / MusicPlaylists / SynthVoice) with the
//        AudioSystem.js facade keeping the public `audio` singleton API.
//        v4.9.0: POLYPHONIC SYNTH OVERHAUL — SynthVoice.js (polyphonic
//        voice builders + percussion) under the scheduler + SFX; the
//        scheduler keeps the single-source-of-truth architecture: ONE
//        lookahead timer, ONE session graph, hard teardown before every
//        restart (zero overlapping loops), tracked timers + live-source
//        GC.
//        v4.14.0: SYMPHONIC CELLO-METAL OVERHAUL — the SONGS album is
//        now a 14-track cello-ensemble album: the new intro-overture
//        (the game's primary opening theme, first in the open queue) +
//        the Für Elise / Johnny March cello-metal re-arrangements
//        (staccato detuned-saw leads, woody lowpass, heavy low-end bass,
//        downbeat chord stabs) — all routed through the SynthVoice.js
//        polyphonic engine.
// ═══════════════════════════════════════════════════════════

import { ROOT, check, mod } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
  console.log('\n[6an] v4.9.0 audio modularization');
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  // ─── Static layout: the E6 audio tree exists + facade wiring ───
  for (const f of ['js/core/audio/AudioCore.js', 'js/core/audio/SoundEffects.js', 'js/core/audio/MusicScheduler.js', 'js/core/audio/MusicPlaylists.js']) {
    check(`${f} exists`, fs.existsSync(path.join(ROOT, f)));
  }
  const facadeSrc = read('js/core/AudioSystem.js');
  check('facade: keeps the public API (audio singleton + VERSION + playlist re-exports)',
    facadeSrc.includes('export const audio = new AudioSystem()')
    && facadeSrc.includes("export const VERSION = 'v4.11.0'")
    && facadeSrc.includes("export { MUSIC_MODES, SONGS, PLAYLISTS } from './audio/MusicPlaylists.js'"));
  check('facade: composes AudioCore + SoundEffects + MusicScheduler',
    facadeSrc.includes("import { AudioCore } from './audio/AudioCore.js'")
    && facadeSrc.includes("import { SoundEffects } from './audio/SoundEffects.js'")
    && facadeSrc.includes("import { MusicScheduler } from './audio/MusicScheduler.js'"));
  check('facade: stopAllMusic() + resetAudioEngine() + setMuted() teardown API',
    facadeSrc.includes('stopAllMusic()') && facadeSrc.includes('resetAudioEngine()') && facadeSrc.includes('setMuted('));
  const schedSrc = read('js/core/audio/MusicScheduler.js');
  check('scheduler: clears the lookahead timer on stop (no dangling loop)',
    schedSrc.includes('clearTimeout(this._timer)') && schedSrc.includes('this._timer = null'));
  check('scheduler: start() hard-kills any previous session (single active stream)',
    schedSrc.includes('if (this.playing) this.stop({ hard: true })'));
  check('scheduler: teardown timer is tracked + cleared (no orphaned disconnect)',
    schedSrc.includes('clearTimeout(this._teardownTimer)') && schedSrc.includes('this._teardownTimer = null'));
  check('scheduler: live-source GC (onended auto-remove + force-stop on teardown)',
    schedSrc.includes('src.onended') && schedSrc.includes('_killLive()'));
  check('scheduler: lookahead never re-arms while inactive',
    schedSrc.includes('if (!this.playing || !this.core.ctx) return'));
  const sfxSrc = read('js/core/audio/SoundEffects.js');
  check('sfx: tracked setTimeout + clearAll() (no dangling coin timer)',
    sfxSrc.includes('this._timers') && sfxSrc.includes('clearAll()'));
  const coreSrc = read('js/core/audio/AudioCore.js');
  check('core: masterGain → compressor → destination + SFX/music buses + mute',
    coreSrc.includes('createDynamicsCompressor()') && coreSrc.includes('this.sfxBus') && coreSrc.includes('this.musicBus') && coreSrc.includes('setMuted('));

  // ─── Module surface ───
  const coreMod = await mod('js/core/audio/AudioCore.js');
  check('AudioCore exports the class + VERSION v4.11.0', typeof coreMod.AudioCore === 'function' && coreMod.VERSION === 'v4.11.0');
  const core = new coreMod.AudioCore();
  check('AudioCore: ensure() is headless-safe (no AudioContext → null, enabled=false)',
    core.ensure() === null && core.enabled === false);
  const sfxMod = await mod('js/core/audio/SoundEffects.js');
  check('SoundEffects exports the class', typeof sfxMod.SoundEffects === 'function');
  const sfx = new sfxMod.SoundEffects(core);
  for (const m of ['tone', 'uiBlip', 'shoot', 'hit', 'explosion', 'coin', 'powerup', 'banner', 'superWeapon', 'gameOver', 'clearAll']) {
    check(`SoundEffects.${m} is a function`, typeof sfx[m] === 'function');
  }
  const plMod = await mod('js/core/audio/MusicPlaylists.js');
  check('MusicPlaylists: 4 context modes', Object.keys(plMod.MUSIC_MODES).length === 4, `got ${Object.keys(plMod.MUSIC_MODES).join(', ')}`);
  check('MusicPlaylists: 14 songs in the album', Object.keys(plMod.SONGS).length === 14, `got ${Object.keys(plMod.SONGS).length}`);
  check('MusicPlaylists: 4 per-mode playlist queues', Object.keys(plMod.PLAYLISTS).length === 4);
  check('MusicPlaylists: every playlist entry resolves to a song',
    Object.values(plMod.PLAYLISTS).every((list) => list.every((id) => plMod.SONGS[id])));
  check('MusicPlaylists: crossover tracks ride two modes each (fur-elise open+combat, johnny-march combat+boneyard)',
    plMod.PLAYLISTS.open.includes('fur-elise') && plMod.PLAYLISTS.combat.includes('fur-elise')
    && plMod.PLAYLISTS.combat.includes('johnny-march') && plMod.PLAYLISTS.boneyard.includes('johnny-march'));
  check('MusicPlaylists: Für Elise motif = 40 16th-grid notes (20-note phrase × 2 loop halves)', plMod.SONGS['fur-elise'].lead.motif.length === 40, `got ${plMod.SONGS['fur-elise'].lead.motif.length}`);
  check('MusicPlaylists: Johnny March motif = 64 8th-grid notes', plMod.SONGS['johnny-march'].lead.motif.length === 64, `got ${plMod.SONGS['johnny-march'].lead.motif.length}`);
  // ─── v4.14.0: symphonic cello-metal overhaul pins ───
  check('MusicPlaylists: v4.14.0 intro overture is the primary opening theme (first in the open queue)',
    plMod.PLAYLISTS.open[0] === 'intro-overture', `got ${plMod.PLAYLISTS.open[0]}`);
  check('MusicPlaylists: v4.14.0 intro overture is a polyphonic cello-metal ballad (27-note lead + open-fifth harmony + stabs + build sweep)',
    plMod.SONGS['intro-overture'].lead.motif.length === 27
    && plMod.SONGS['intro-overture'].harmony.motif.length === 27
    && plMod.SONGS['intro-overture'].stab === true
    && plMod.SONGS['intro-overture'].sweeps.includes(6));
  check('MusicPlaylists: v4.14.0 cello-metal crossover arrangement (staccato leads + heavy downbeat stabs)',
    plMod.SONGS['fur-elise'].lead.glide === false && plMod.SONGS['fur-elise'].stab === true
    && plMod.SONGS['johnny-march'].lead.glide === false && plMod.SONGS['johnny-march'].stab === true);
  check('MusicPlaylists: hz() + mulberry32() helpers exported', typeof plMod.hz === 'function' && typeof plMod.mulberry32 === 'function');
  const schedMod = await mod('js/core/audio/MusicScheduler.js');
  check('MusicScheduler exports the class', typeof schedMod.MusicScheduler === 'function');
  const sched = new schedMod.MusicScheduler(core);
  for (const m of ['start', 'stop', 'setMode', 'getMode', 'getSong']) {
    check(`MusicScheduler.${m} is a function`, typeof sched[m] === 'function');
  }

  // ─── Facade surface (the public `audio` singleton) ───
  const facade = await mod('js/core/AudioSystem.js');
  check('facade: VERSION v4.11.0', facade.VERSION === 'v4.11.0');
  check('facade: re-exported playlist data is the module data (same bindings)',
    facade.MUSIC_MODES === plMod.MUSIC_MODES && facade.SONGS === plMod.SONGS && facade.PLAYLISTS === plMod.PLAYLISTS);
  const a = facade.audio;
  check('facade: audio singleton instance exists', !!a);
  for (const m of ['tone', 'uiBlip', 'shoot', 'hit', 'explosion', 'coin', 'powerup', 'banner', 'superWeapon', 'gameOver',
    'startMusic', 'stopMusic', 'setMusicMode', 'getMusicMode', 'getMusicSong', 'setVolumes', 'setMuted', 'stopAllMusic', 'resetAudioEngine']) {
    check(`audio.${m} is a function`, typeof a[m] === 'function');
  }

  // ─── Headless behavior: the zero-overlap lifecycle ───
  a.startMusic();
  check('headless: startMusic() is safe without an AudioContext (no crash, playing=true)', a.musicPlaying === true);
  a.setMusicMode('boss');
  check('headless: setMusicMode() is headless-safe (pending mode stored)', a.getMusicMode() === 'boss');
  a.stopMusic();
  check('headless: stopMusic() drops the session', a.musicPlaying === false);
  a.stopAllMusic();
  a.resetAudioEngine();
  a.startMusic();
  check('headless: restart after resetAudioEngine() is clean (no crash, playing=true)', a.musicPlaying === true);
  a.stopMusic();
  a.setVolumes(0.5, 0.5, 0.5);
  check('headless: setVolumes() clamps + stores on the core', a.core.master === 0.5 && a.core.sfx === 0.5 && a.core.music === 0.5);
  a.setMuted(true);
  check('headless: setMuted() flips the global mute state', a.muted === true);
  a.setMuted(false);
  a.setVolumes(1, 1, 1);
}
