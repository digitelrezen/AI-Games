// ═══════════════════════════════════════════════════════════
//  [7] --full: full smoke.mjs logic suite (subprocess)
// ═══════════════════════════════════════════════════════════

import { FULL, runTool } from '../infra.mjs';

export default async function run() {
if (FULL) {
  console.log('\n[7] Full smoke suite (subprocess)');
  runTool(['smoke.mjs'], 'tools/smoke.mjs (Settings/Keybinds/EventBus/MessageLog/DebugBridge)');
}
}
