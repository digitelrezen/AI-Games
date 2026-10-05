// C:\Dev\AI-GAMES\.cline\test-e6.mjs — E6 codec + NetProtocol round-trip test (Node, no DOM)
import E6 from '../Kitty Vs Everything/net/E6.js';
import NetProtocol from '../Kitty Vs Everything/net/NetProtocol.js';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  \u2713 ' + msg); } else { fail++; console.log('  \u2717 ' + msg); } };

console.log('[E6] round-trip (escaping)');
{
  const fields = ['a', 'b', 'c'];
  const recs = [{ a: 'x', b: 'y|z', c: 'w\\n' }];
  const text = E6.serialize('test', '1.0', fields, recs);
  const parsed = E6.parse(text);
  ok(parsed.schemaId === 'test', 'schema id preserved');
  ok(parsed.fields.join(',') === 'a,b,c', 'field order preserved');
  ok(parsed.records.length === 1, 'record count');
  ok(parsed.records[0].b === 'y|z', 'pipe escape round-trip');
  ok(parsed.records[0].c === 'w\\n', 'newline escape round-trip');
}

console.log('[E6] validate shipped data files');
{
  const base = 'c:/Dev/AI-GAMES/Kitty Vs Everything/net/data/';
  const mp = fs.readFileSync(base + 'multiplayer.config.e6', 'utf8');
  ok(E6.validate(mp, 'netsettings', ['role', 'hosting', 'port', 'hostIp', 'syncRate']).ok, 'multiplayer.config.e6 valid');
  const p1 = fs.readFileSync(base + 'player1.profile.e6', 'utf8');
  ok(E6.validate(p1, 'profile', ['slot', 'theme', 'callsign', 'score']).ok, 'player1.profile.e6 valid');
  const p2 = fs.readFileSync(base + 'player2.profile.e6', 'utf8');
  ok(E6.validate(p2, 'profile', ['slot', 'theme', 'callsign', 'score']).ok, 'player2.profile.e6 valid');
}

console.log('[NetProtocol] player encode/decode');
{
  const fakePlayer = { netId: 'p1', theme: 'yellow', x: 100.5, y: 200.7, angle: 1.23, hp: 80, shield: 30, weapon: 'vulkan', minis: [1, 2], score: 1234, lives: 2, alive: true };
  const text = NetProtocol.encodePlayers([fakePlayer]);
  const recs = NetProtocol.decodePlayers(text);
  ok(recs.length === 1, 'player record count');
  ok(recs[0].id === 'p1', 'player id');
  ok(Number(recs[0].hp) === 80, 'player hp');
  ok(Number(recs[0].lives) === 2, 'player lives');
  ok(Number(recs[0].score) === 1234, 'player score');
  ok(Number(recs[0].minis) === 2, 'player minis');
}

console.log('[NetProtocol] enemy + boss encode/decode');
{
  const enemies = [{ netId: 0, type: 'wasp', x: 10, y: 20, hp: 15, angle: 0.5, alive: true }, { netId: 1, type: 'wolf', x: 30, y: 40, hp: 30, angle: 1.0, alive: true }];
  const etext = NetProtocol.encodeEnemies(enemies);
  const erecs = NetProtocol.decodeEnemies(etext);
  ok(erecs.length === 2, 'enemy record count');
  ok(erecs[0].type === 'wasp', 'enemy type');
  const bossText = NetProtocol.encodeBoss({ boss: { alive: true, hp: 500, maxHp: 1000, phase: 2, x: 100, y: 50 } });
  const bossRec = NetProtocol.decodeBoss(bossText);
  ok(Number(bossRec.active) === 1, 'boss active');
  ok(Number(bossRec.hp) === 500, 'boss hp');
  ok(Number(bossRec.phase) === 2, 'boss phase');
}

console.log('[NetProtocol] input encode');
{
  const input = {
    isDownAction: (n) => (n === 'thrust' || n === 'fire'),
    wasPressedAction: (n) => (n === 'stun'),
  };
  const msg = NetProtocol.encodeInput(input, 42);
  ok(msg.type === 'input', 'input type');
  ok(msg.seq === 42, 'input seq');
  ok(msg.thrust === 1 && msg.fire === 1, 'held actions');
  ok(msg.stun === 1, 'pressed action');
  ok(msg.brake === 0 && msg.boost === 0, 'unheld actions');
}

console.log(`\n${fail === 0 ? 'PASSED' : 'FAILED'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
