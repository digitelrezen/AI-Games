import fs from 'node:fs';

// 1. Full geometry + sprite dims (no base64)
const j = JSON.parse(fs.readFileSync('C:/Dev/AI-GAMES/.cline/bender-egg/sprites-v2.json', 'utf8'));
console.log('=== sprites-v2.json geometry ===');
console.log(JSON.stringify(j.geometry, null, 2));
for (const k of ['body', 'arm', 'head']) {
  console.log(k, 'w=' + j[k].w, 'h=' + j[k].h, 'b64len=' + j[k].b64.length);
}

// 2. build.mjs file list
console.log('\n=== build.mjs (EasterEgg/PowerUp/MiniPoster/Bender/FILES lines) ===');
const bs = fs.readFileSync('C:/Dev/AI-GAMES/Kitty Vs Everything/build.mjs', 'utf8');
bs.split('\n').forEach((l, i) => {
  if (/EasterEgg|PowerUp|MiniPoster|Bender|FILES|fileList|jsFiles/i.test(l)) console.log((i + 1) + ': ' + l);
});

// 3. index.html title + version label
console.log('\n=== index.html title/version ===');
const hs = fs.readFileSync('C:/Dev/AI-GAMES/Kitty Vs Everything/index.html', 'utf8');
hs.split('\n').forEach((l, i) => {
  if (/title|version-label/i.test(l)) console.log((i + 1) + ': ' + l.trim());
});

// 4. package.json scripts
console.log('\n=== package.json ===');
console.log(fs.readFileSync('C:/Dev/AI-GAMES/Kitty Vs Everything/package.json', 'utf8'));

// 5. config.js VERSION line context
console.log('\n=== config.js VERSION line ===');
fs.readFileSync('C:/Dev/AI-GAMES/Kitty Vs Everything/config.js', 'utf8').split('\n').slice(0, 50).forEach((l, i) => {
  if (/VERSION|v3\.2[0-9]/.test(l)) console.log((i + 1) + ': ' + l);
});
