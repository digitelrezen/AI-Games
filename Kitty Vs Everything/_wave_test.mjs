// TEMP verification of the v3.30.0 wave-system math (mirrors config.WAVE + WaveManager).
const WAVE = {
  SPECIES_COUNT: 16, COUNT_MIN: 20, COUNT_MAX: 300, COUNT_RAMP_WAVES: 12,
  DIFF_PER_WAVE: 0.06, DIFF_CAP_CYCLES: 2, DIFF_CAP: 3.0,
  TIER_MIX: { mob: 0.82, champion: 0.12, miniboss: 0.06 },
};

function getWaveCount(wave, spawnOverride = 0) {
  if (spawnOverride > 0) return spawnOverride;
  const w = Math.max(1, wave);
  const span = WAVE.COUNT_RAMP_WAVES - 1;
  const t = ((w - 1) % WAVE.COUNT_RAMP_WAVES) / span;
  return Math.round(WAVE.COUNT_MIN + t * (WAVE.COUNT_MAX - WAVE.COUNT_MIN));
}
function difficulty(wave) {
  const waves = Math.max(0, wave);
  const capWaves = WAVE.SPECIES_COUNT * WAVE.DIFF_CAP_CYCLES;
  return Math.min(1 + Math.min(waves, capWaves) * WAVE.DIFF_PER_WAVE, WAVE.DIFF_CAP);
}
function speciesFor(wave, n = 16) { return (wave - 1) % n; } // index

console.log('wave | count | difficulty | speciesIdx | bossTier');
for (let w = 1; w <= 34; w++) {
  const boss = (w % 10 === 0) ? 'finalboss' : 'boss';
  console.log(String(w).padStart(4), '|', String(getWaveCount(w)).padStart(5), '|', difficulty(w).toFixed(2).padStart(6), '|', String(speciesFor(w)).padStart(9), '|', boss);
}
console.log('\nspawnOverride=75 ->', getWaveCount(3, 75), '(should be 75)');
console.log('spawnOverride=0  ->', getWaveCount(3, 0), '(should be auto ~71)');
console.log('difficulty cap check: wave 32 =', difficulty(32), ' wave 40 =', difficulty(40), ' wave 50 =', difficulty(50));
