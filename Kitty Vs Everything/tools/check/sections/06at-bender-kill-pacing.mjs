// ═══════════════════════════════════════════════════════════
//  [6at] v4.28.0 BENDER KILL PACING — the aimbot easter-egg
//        dialogue now needs KILLS_PER_LINE (10) friendly kills
//        between lines (BENDER_KILLS 4 → 40), so each line stays
//        on screen long enough to be read under aimbot auto-fire.
// ═══════════════════════════════════════════════════════════

import { ROOT, check } from '../infra.mjs';
import fs from 'node:fs';
import path from 'node:path';

export default async function run() {
{
  console.log('\n[6at] v4.28.0 Bender kill pacing (10 kills between lines)');
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const eggSrc = read('js/core/EasterEgg.js');
  const hudSrc = read('js/ui/HUD.js');

  // ─── EasterEgg.js: the pacing constants ───
  check('EasterEgg.js: KILLS_PER_LINE = 10 (kills between dialogue lines)',
    /const KILLS_PER_LINE = 10;/.test(eggSrc));
  check('EasterEgg.js: BENDER_KILLS derives from KILLS_PER_LINE * 4 (= 40)',
    /export const BENDER_KILLS = KILLS_PER_LINE \* 4;/.test(eggSrc));
  check('EasterEgg.js: the old 1-kill-per-line BENDER_KILLS = 4 is gone',
    !/export const BENDER_KILLS = 4;/.test(eggSrc));

  // ─── EasterEgg.js: the kill → stage mapping ───
  check('EasterEgg.js: onEnemyKilled advances one line per KILLS_PER_LINE kills',
    /const stage = 1 \+ Math\.floor\(this\.killCount \/ KILLS_PER_LINE\);/.test(eggSrc));
  check('EasterEgg.js: the old 1-kill-per-line stage formula is gone',
    !eggSrc.includes('const stage = 1 + this.killCount;'));
  check('EasterEgg.js: the egg still ends at BENDER_KILLS kills',
    eggSrc.includes('if (this.killCount >= BENDER_KILLS) this.end();'));

  // ─── EasterEgg.js: the dialogue is intact ───
  const dialogueMatch = eggSrc.match(/const BENDER_DIALOGUE = \[([\s\S]*?)\];/);
  const dialogueBlock = dialogueMatch ? dialogueMatch[1] : '';
  const dialogueLineCount = (dialogueBlock.match(/^\s*["']/gm) || []).length;
  check('EasterEgg.js: BENDER_DIALOGUE still carries all 6 lines',
    dialogueLineCount === 6, `got ${dialogueLineCount}`);

  // ─── HUD.js: the kill counter still tracks BENDER_KILLS ───
  check('HUD.js: imports BENDER_KILLS for the kill counter',
    hudSrc.includes("import { BENDER_KILLS } from '../core/EasterEgg.js'"));
  check('HUD.js: the counter renders killCount / BENDER_KILLS',
    /abEl\.textContent = 'BENDER ' \+ g\.aimbot\.killCount \+ '\/' \+ BENDER_KILLS;/.test(hudSrc));
}

}