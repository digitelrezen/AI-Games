import fs from 'node:fs';
const base = 'C:/Dev/AI-GAMES/Kitty Vs Everything/';
for (const f of ['config.js', 'package.json', 'index.html']) {
  const s = fs.readFileSync(base + f, 'utf8');
  const m = s.match(/VERSION\s*=\s*['"][^'"]+['"]/g);
  const v = s.match(/"version"\s*:\s*"[^"]+"/);
  const t = s.match(/v3\.\d+\.\d+/g);
  console.log(`--- ${f} ---`);
  console.log('VERSION consts:', m);
  if (v) console.log('package version:', v[0]);
  if (t) console.log('v3.x.x strings:', [...new Set(t)].join(', '));
}
