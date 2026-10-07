// ═══════════════════════════════════════════════════════════
//  [3] ASSET PIPELINE — the real import/validate tools, as
//      subprocesses (import-assets --check never writes)
// ═══════════════════════════════════════════════════════════

import { TOOLS, check } from '../infra.mjs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export default async function run() {
console.log('\n[3] Asset pipeline (subprocess)');
const runTool = (args, label) => {
  const r = spawnSync(process.execPath, [path.join(TOOLS, args[0]), ...args.slice(1)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status !== 0) {
    console.log(out.split('\n').map((l) => '      ' + l).join('\n'));
  }
  check(label, r.status === 0, `exit ${r.status}`);
};
runTool(['import-assets.mjs', '--check'], 'tools/import-assets.mjs --check (decode + validate, no writes)');
runTool(['validate.mjs'], 'tools/validate.mjs (game source validation)');

}
