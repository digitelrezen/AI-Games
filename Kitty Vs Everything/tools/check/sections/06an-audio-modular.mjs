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
//        v4.15.0: JUKEBOX PLAYLIST VIEW + TRACK REPLACEMENTS — the admin
//        Music Jukebox shows the per-mode PLAYLISTS queues (readable
//        rotation order + preview highlight), the fur-elise slot is
//        replaced by the new "Neon Horizon" D-minor composition, and
//        boss-overdrive / boss-redline are rebuilt as clearly distinct
//        tracks (gallop riff vs breakbeat).
//        v4.16.0: MIDI ALBUM — the entire SONGS album is the exact note
//        sequences parsed from the local .mid files (tools/midi-import.mjs,
//        zero-dependency SMF parser): 11 tracks (Nothing Else Matters — the
//        main intro sequence — Forty Six & 2 / No Quarter / Pneuma,
//        Harvester of Sorrow / The Unforgiven, Cowboys From Hell, Axel F,
//        Für Elise, When Johnny Comes Marching Home, Requiem for a Dream);
//        every MIDI channel maps to a SynthVoice.js voice slot (lead/bass/
//        arp/pad/drums) and the scheduler grid moves to 32nds; all
//        procedural placeholder tracks are removed.
//        v4.17.0: MIDI ALBUM EXPANSION — the SONGS album grows 11 → 13
//        tracks: + Classical Gas (Mose Ziering, the fingerpicked-arpeggio
//        piano arrangement — open + boneyard queues, 'piano' profile) +
//        Eiffel 65 — Blue (Da Ba Dee) (the Eurodance lead hook + horn-stab
//        chord hits — combat queue, 'synth' profile); both are single-channel
//        MIDI arrangements riding the polyphonic lead voice.
//        v4.19.0: CLASSIC HEAVY METAL EXPANSION + PER-TRACK MIX — the
//        SONGS album grows 13 → 15 tracks: + Ozzy Osbourne — Crazy Train
//        (intro riff, the galloping E-minor lead riff as a single-channel
//        acoustic arrangement — combat queue, 'metal' profile) + Black
//        Sabbath — Children Of The Grave (the full heavy metal anthem:
//        power-chord rhythm + vocal melody on the lead voice, bass line,
//        GM drums — boss queue, 'metal' profile). NEW: TRACK_MIX_SETTINGS
//        — a per-song mix table (gainLead / gainBass / gainDrums scalars,
//        one entry per track, defaults 1.0) that the MusicScheduler
//        multiplies into the event-path layer gains, so quiet lead
//        melodies can be boosted or overpowering percussion channels
//        lowered per song without touching the genre profiles.
//        v4.20.0: AUDIO MIX TUNING — per-track volume/mix pass against
//        the Forty Six & 2 reference: TRACK_MIX_SETTINGS grows from 3 to
//        5 scalars (gainLead / gainBass / gainDrums / gainArp / gainPad,
//        the new arp + pad scalars applied in the MusicScheduler event
//        path), quiet leads boosted (Crazy Train 2.6x, Blue 2.3x, Fur
//        Elise / No Quarter / Classical Gas / Axel F 2.0x, Cowboys
//        1.7x), drum-dominant tracks tamed (CoTG / Johnny March / Pneuma
//        / Requiem / Harvester drums 0.35-0.45x), Harvester bass 0.5x,
//        The Unforgiven's "synth" pad 0.25x, Pneuma's rhythm-guitar arp
//        1.9x; Nothing Else Matters moves to the 'piano' profile (the
//        ballad saw+sub "gross synth" lead is gone); Children Of The
//        Grave becomes the OPENING track (PLAYLISTS.open[0], still in
//        the boss queue).
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
  check('MusicPlaylists: v4.19.0 the 15-track MIDI album (13 v4.17.0 tracks + Ozzy Osbourne — Crazy Train (intro riff) + Black Sabbath — Children Of The Grave; all procedural placeholder tracks removed)',
    Object.keys(plMod.SONGS).length === 15, `got ${Object.keys(plMod.SONGS).length}`);
  check('MusicPlaylists: 4 per-mode playlist queues', Object.keys(plMod.PLAYLISTS).length === 4);
  check('MusicPlaylists: every playlist entry resolves to a song',
    Object.values(plMod.PLAYLISTS).every((list) => list.every((id) => plMod.SONGS[id])));
  check('MusicPlaylists: v4.20.0 Children Of The Grave is the OPENING track (first in the open queue — the game starts on the Black Sabbath anthem)',
    plMod.PLAYLISTS.open[0] === 'black-sabbath-cotg', `got ${plMod.PLAYLISTS.open[0]}`);
  check('MusicPlaylists: v4.17.0 crossover tracks ride two modes each (fur-elise open+boneyard, johnny-march open+combat, harvester boneyard+boss, cowboys combat+boss, classical-gas open+boneyard) + eiffel65-blue in the combat queue',
    plMod.PLAYLISTS.open.includes('fur-elise') && plMod.PLAYLISTS.boneyard.includes('fur-elise')
    && plMod.PLAYLISTS.open.includes('johnny-march') && plMod.PLAYLISTS.combat.includes('johnny-march')
    && plMod.PLAYLISTS.boneyard.includes('metallica-harvester') && plMod.PLAYLISTS.boss.includes('metallica-harvester')
    && plMod.PLAYLISTS.combat.includes('pantera-cowboys') && plMod.PLAYLISTS.boss.includes('pantera-cowboys')
    && plMod.PLAYLISTS.open.includes('classical-gas') && plMod.PLAYLISTS.boneyard.includes('classical-gas')
    && plMod.PLAYLISTS.combat.includes('eiffel65-blue'));
  check('MusicPlaylists: v4.17.0 the album is the parsed MIDI lineup (exact titles/artists)',
    plMod.SONGS['metallica-nem'].title === 'Nothing Else Matters' && plMod.SONGS['metallica-nem'].artist === 'Metallica'
    && plMod.SONGS['tool-forty-six'].title === 'Forty Six & 2' && plMod.SONGS['tool-forty-six'].artist === 'Tool'
    && plMod.SONGS['tool-no-quarter'].title === 'No Quarter' && plMod.SONGS['tool-no-quarter'].artist === 'Tool'
    && plMod.SONGS['tool-pneuma'].title === 'Pneuma' && plMod.SONGS['tool-pneuma'].artist === 'Tool'
    && plMod.SONGS['metallica-unforgiven'].title === 'The Unforgiven'
    && plMod.SONGS['metallica-harvester'].title === 'Harvester of Sorrow'
    && plMod.SONGS['pantera-cowboys'].title === 'Cowboys From Hell' && plMod.SONGS['pantera-cowboys'].artist === 'Pantera'
    && plMod.SONGS['axel-f'].title === 'Axel F'
    && plMod.SONGS['fur-elise'].title === 'Für Elise' && plMod.SONGS['fur-elise'].artist === 'Beethoven'
    && plMod.SONGS['johnny-march'].title === 'When Johnny Comes Marching Home'
    && plMod.SONGS['requiem-dream'].title === 'Requiem for a Dream'
    && plMod.SONGS['classical-gas'].title === 'Classical Gas' && plMod.SONGS['classical-gas'].artist === 'Mose Ziering'
    && plMod.SONGS['eiffel65-blue'].title === 'Blue (Da Ba Dee)' && plMod.SONGS['eiffel65-blue'].artist === 'Eiffel 65');
  check('MusicPlaylists: v4.17.0 parsed note-sequence identity (dominant MIDI bpm + full parsed bar length per track)',
    plMod.SONGS['metallica-nem'].bpm === 75 && plMod.SONGS['metallica-nem'].bars === 43
    && plMod.SONGS['requiem-dream'].bpm === 45 && plMod.SONGS['requiem-dream'].bars === 25
    && plMod.SONGS['axel-f'].bpm === 125 && plMod.SONGS['axel-f'].bars === 28
    && plMod.SONGS['fur-elise'].bpm === 135 && plMod.SONGS['fur-elise'].bars === 52
    && plMod.SONGS['johnny-march'].bpm === 165 && plMod.SONGS['johnny-march'].bars === 137
    && plMod.SONGS['tool-forty-six'].bpm === 79 && plMod.SONGS['tool-forty-six'].bars === 124
    && plMod.SONGS['tool-no-quarter'].bpm === 110 && plMod.SONGS['tool-no-quarter'].bars === 15
    && plMod.SONGS['pantera-cowboys'].bpm === 230 && plMod.SONGS['pantera-cowboys'].bars === 45
    && plMod.SONGS['metallica-harvester'].bpm === 92 && plMod.SONGS['metallica-harvester'].bars === 42
    && plMod.SONGS['metallica-unforgiven'].bpm === 70 && plMod.SONGS['metallica-unforgiven'].bars === 110
    && plMod.SONGS['tool-pneuma'].bpm === 115 && plMod.SONGS['tool-pneuma'].bars === 291
    && plMod.SONGS['classical-gas'].bpm === 152 && plMod.SONGS['classical-gas'].bars === 117
    && plMod.SONGS['eiffel65-blue'].bpm === 127 && plMod.SONGS['eiffel65-blue'].bars === 117);
  check('MusicPlaylists: v4.16.0 every song carries parsed MIDI events (lead layer non-empty, 32nd-grid bounds, sane bpm/bars)',
    Object.values(plMod.SONGS).every((s) => {
      if (!s.events || !s.events.lead.length || s.bpm <= 40 || s.bpm >= 300 || s.bars < 4) return false;
      const total = s.bars * 32;
      for (const layer of ['lead', 'bass', 'arp', 'pad']) {
        for (const [t, n, d, v] of s.events[layer] || []) {
          if (t < 0 || t >= total || n < 0 || n > 127 || d < 1 || v < 0 || v > 1) return false;
        }
      }
      for (const [t, k, v] of s.events.drums || []) {
        if (t < 0 || t >= total || k < 0 || k > 3 || v < 0 || v > 1) return false;
      }
      return true;
    }));
  check('MusicPlaylists: v4.17.0 the exact note counts ride the layers (NEM 507 lead / 80 bass / 417 drums; Pneuma 3455 drums; Für Elise 526 lead, piano-only; Classical Gas 1391 lead, piano-only; Eiffel 65 1141 lead, piano-only)',
    plMod.SONGS['metallica-nem'].events.lead.length === 507
    && plMod.SONGS['metallica-nem'].events.bass.length === 80
    && plMod.SONGS['metallica-nem'].events.drums.length === 417
    && plMod.SONGS['tool-pneuma'].events.drums.length === 3455
    && plMod.SONGS['fur-elise'].events.lead.length === 526
    && plMod.SONGS['fur-elise'].events.drums.length === 0
    && plMod.SONGS['classical-gas'].events.lead.length === 1391
    && plMod.SONGS['classical-gas'].events.drums.length === 0
    && plMod.SONGS['eiffel65-blue'].events.lead.length === 1141
    && plMod.SONGS['eiffel65-blue'].events.drums.length === 0);
  check('v4.16.0 FIDELITY FIX: the main melody rides the LEAD slot (Requiem piano 1429 / Johnny trombone 481 / Harvester dist-gtr 395) + correct genre profiles (Axel F = synth perc 0.55, not metal; No Quarter + Für Elise = piano perc 0.3)',
    plMod.SONGS['requiem-dream'].events.lead.length === 1429
    && plMod.SONGS['johnny-march'].events.lead.length === 481
    && plMod.SONGS['metallica-harvester'].events.lead.length === 395
    && plMod.SONGS['axel-f'].vols.perc === 0.55
    && plMod.SONGS['tool-no-quarter'].vols.perc === 0.3
    && plMod.SONGS['fur-elise'].vols.perc === 0.3);
  check('v4.17.0 new tracks ride the correct genre profiles (Classical Gas = piano triangle lead, perc 0.3; Eiffel 65 — Blue = synth saw lead, perc 0.55 — Eurodance, not metal)',
    plMod.SONGS['classical-gas'].lead.wave === 'triangle'
    && plMod.SONGS['classical-gas'].vols.perc === 0.3
    && plMod.SONGS['eiffel65-blue'].lead.wave === 'sawtooth'
    && plMod.SONGS['eiffel65-blue'].vols.perc === 0.55);
  check('v4.19.0 classic heavy metal MIDIs join the album (Crazy Train intro riff — combat queue; Children Of The Grave — boss queue)',
    plMod.SONGS['ozzy-crazy-train'].title === 'Crazy Train (Intro Riff)' && plMod.SONGS['ozzy-crazy-train'].artist === 'Ozzy Osbourne'
    && plMod.SONGS['black-sabbath-cotg'].title === 'Children Of The Grave' && plMod.SONGS['black-sabbath-cotg'].artist === 'Black Sabbath'
    && plMod.PLAYLISTS.combat.includes('ozzy-crazy-train')
    && plMod.PLAYLISTS.boss.includes('black-sabbath-cotg'));
  check('v4.19.0 new tracks ride the parsed note sequences (Crazy Train = 80-lead-note solo-guitar riff, 9 bars @ 69 bpm, no drums; CoTG = 1219 lead (riff + melody) / 495 bass / 1840 drums, 153 bars @ 138 bpm)',
    plMod.SONGS['ozzy-crazy-train'].bpm === 69 && plMod.SONGS['ozzy-crazy-train'].bars === 9
    && plMod.SONGS['ozzy-crazy-train'].events.lead.length === 80
    && plMod.SONGS['ozzy-crazy-train'].events.bass.length === 0
    && plMod.SONGS['ozzy-crazy-train'].events.drums.length === 0
    && plMod.SONGS['black-sabbath-cotg'].bpm === 138 && plMod.SONGS['black-sabbath-cotg'].bars === 153
    && plMod.SONGS['black-sabbath-cotg'].events.lead.length === 1219
    && plMod.SONGS['black-sabbath-cotg'].events.bass.length === 495
    && plMod.SONGS['black-sabbath-cotg'].events.drums.length === 1840);
  check('v4.19.0 new tracks ride the metal genre profile (distorted-saw lead, driven bass)',
    plMod.SONGS['ozzy-crazy-train'].lead.wave === 'sawtooth' && plMod.SONGS['ozzy-crazy-train'].vols.perc === 0.6
    && plMod.SONGS['black-sabbath-cotg'].lead.wave === 'sawtooth' && plMod.SONGS['black-sabbath-cotg'].vols.perc === 0.6);
  check('v4.20.0 TRACK_MIX_SETTINGS: per-song gainLead/gainBass/gainDrums/gainArp/gainPad scalars for every track (one entry per SONGS key, positive scalars)',
    plMod.TRACK_MIX_SETTINGS
    && Object.keys(plMod.TRACK_MIX_SETTINGS).length === Object.keys(plMod.SONGS).length
    && Object.keys(plMod.SONGS).every((id) => {
      const m = plMod.TRACK_MIX_SETTINGS[id];
      return m && typeof m.gainLead === 'number' && typeof m.gainBass === 'number' && typeof m.gainDrums === 'number'
        && typeof m.gainArp === 'number' && typeof m.gainPad === 'number'
        && m.gainLead > 0 && m.gainBass > 0 && m.gainDrums > 0 && m.gainArp > 0 && m.gainPad > 0;
    }));
  check('v4.20.0 TRACK_MIX_SETTINGS: the Forty Six & 2 reference stays all-1.0 while the tuned tracks carry their mix (Crazy Train gainLead 2.6; CoTG gainLead 1.7 + gainDrums 0.45; Unforgiven gainPad 0.25; Pneuma gainArp 1.9; Harvester gainBass 0.5; Johnny March gainDrums 0.35)',
    plMod.TRACK_MIX_SETTINGS['tool-forty-six'].gainLead === 1 && plMod.TRACK_MIX_SETTINGS['tool-forty-six'].gainDrums === 1
    && plMod.TRACK_MIX_SETTINGS['ozzy-crazy-train'].gainLead === 2.6
    && plMod.TRACK_MIX_SETTINGS['black-sabbath-cotg'].gainLead === 1.7
    && plMod.TRACK_MIX_SETTINGS['black-sabbath-cotg'].gainDrums === 0.45
    && plMod.TRACK_MIX_SETTINGS['metallica-unforgiven'].gainPad === 0.25
    && plMod.TRACK_MIX_SETTINGS['tool-pneuma'].gainArp === 1.9
    && plMod.TRACK_MIX_SETTINGS['metallica-harvester'].gainBass === 0.5
    && plMod.TRACK_MIX_SETTINGS['johnny-march'].gainDrums === 0.35);
  check('v4.20.0 scheduler: the event path applies the full 5-scalar per-track mix (TRACK_MIX_SETTINGS → gainLead/gainBass/gainDrums/gainArp/gainPad multipliers)',
    schedSrc.includes('TRACK_MIX_SETTINGS') && schedSrc.includes('mix.gainDrums')
    && schedSrc.includes('mix.gainLead') && schedSrc.includes('mix.gainBass')
    && schedSrc.includes('mix.gainArp') && schedSrc.includes('mix.gainPad'));
  check('v4.20.0: Nothing Else Matters rides the piano profile (the detuned-saw+sub "gross synth" lead is gone — triangle pluck, no sub, perc 0.3)',
    plMod.SONGS['metallica-nem'].lead.wave === 'triangle'
    && plMod.SONGS['metallica-nem'].lead.sub === false
    && plMod.SONGS['metallica-nem'].vols.perc === 0.3);
  check('scheduler: v4.16.0 MIDI event playback path (32nd grid + events map → SynthVoice slots + kick pump)',
    schedSrc.includes('60 / song.bpm / 8') && schedSrc.includes('song.events')
    && schedSrc.includes('_scheduleEventStep') && schedSrc.includes('_evIndex')
    && schedSrc.includes('_eventBass') && schedSrc.includes('_eventPad'));
  check('tools/midi-import.mjs: the zero-dependency MIDI parser + converter exists',
    fs.existsSync(path.join(ROOT, 'tools/midi-import.mjs')));
  check('v4.15.0: the admin jukebox shows the per-mode playlists (index.html #dev-jukebox-playlists + DevPanel builds the queue rows from PLAYLISTS)',
    read('index.html').includes('dev-jukebox-playlists')
    && read('js/ui/DevPanel.js').includes('dev-jukebox-playlists')
    && read('js/ui/DevPanel.js').includes('PLAYLISTS')
    && read('js/ui/DevPanel.js').includes('dev-playlist-track'));
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
