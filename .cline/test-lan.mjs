// Test the LAN relay server: connect a host + client, verify message routing.
import { createRequire } from 'module';
const require = createRequire('c:/AI-Games/Everything Vs Kitty/package.json');
const WebSocket = require('ws');

const URL = 'ws://127.0.0.1:8765';
let passed = 0, failed = 0;
const ok = (name, cond) => { if (cond) { passed++; console.log('  \u2713 ' + name); } else { failed++; console.log('  \u2717 ' + name); } };

const host = new WebSocket(URL);
const client = new WebSocket(URL);

const hostGot = [];
const clientGot = [];

host.on('message', (d) => hostGot.push(JSON.parse(d.toString())));
client.on('message', (d) => clientGot.push(JSON.parse(d.toString())));

const hostOpen = new Promise((r) => host.on('open', r));
const clientOpen = new Promise((r) => client.on('open', r));

await hostOpen;
await clientOpen;
console.log('[LAN] both sockets open');

// Host sends hello (role=host) first so the server knows which socket is the host.
host.send(JSON.stringify({ type: 'hello', role: 'host', profile: { theme: 'yellow', callsign: 'PILOT-1' } }));
await new Promise((r) => setTimeout(r, 200));

// Client sends hello (role=client) -> should be forwarded to host.
client.send(JSON.stringify({ type: 'hello', role: 'client', profile: { theme: 'orange', callsign: 'PILOT-2' } }));
await new Promise((r) => setTimeout(r, 300));
ok('host received client hello', hostGot.some((m) => m.type === 'hello' && m.role === 'client'));

// Host sends welcome -> should reach client.
host.send(JSON.stringify({ type: 'welcome', yourId: 'p2', host: { theme: 'yellow', callsign: 'PILOT-1' }, config: {} }));
await new Promise((r) => setTimeout(r, 300));
ok('client received welcome', clientGot.some((m) => m.type === 'welcome'));

// Host sends state -> should reach client.
host.send(JSON.stringify({ type: 'state', seq: 1, time: 0, score: 0, multiplier: 1, wave: 1, players: '#E6 player v1.0\n#FIELDS id|theme|x|y|angle|hp|shield|weapon|minis|score|lives|alive\np1|yellow|100|200|-90|100|50|vulkan|0|0|3|1\n', enemies: '#E6 enemy v1.0\n#FIELDS id|type|x|y|hp|angle\n', boss: '#E6 boss v1.0\n#FIELDS active|hp|maxHp|phase|x|y\n0|0|0|0|0|0\n' }));
await new Promise((r) => setTimeout(r, 300));
ok('client received state', clientGot.some((m) => m.type === 'state' && m.seq === 1));

// Client sends input -> should reach host.
client.send(JSON.stringify({ type: 'input', seq: 1, thrust: 1, brake: 0, boost: 0, fire: 1, stun: 0, napalm: 0, ultimate: 0, cycleWeapon: 0, deployFleet: 0 }));
await new Promise((r) => setTimeout(r, 300));
ok('host received client input', hostGot.some((m) => m.type === 'input' && m.thrust === 1 && m.fire === 1));

// Client closes -> host should get bye.
client.close();
await new Promise((r) => setTimeout(r, 300));
ok('host received bye on client close', hostGot.some((m) => m.type === 'bye'));

host.close();
console.log(`\n${failed === 0 ? 'PASSED' : 'FAILED'} \u2014 ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
