#!/usr/bin/env node
// ../tools/harness.mjs — Kitty Vs Everything v3.14.0 (tools/ moved up to AI-GAMES root)
// EXTERNAL DEBUGGER HARNESS (dev tooling, runs in Node).
// Bridges a terminal REPL to the running game through the in-browser
// DebugBridge (window.__KVE__):
//   1. Run the game in a browser tab (npm start or any static server).
//   2. node ../tools/harness.mjs [port]   (default port 3123)
//   3. In the browser DEVTOOLS CONSOLE, paste the printed one-liner.
//   4. Type commands in the terminal — `help` lists them. The bridge
//      executes them via window.__KVE__.run() and streams results +
//      live state snapshots back here.
import http from 'node:http';
import readline from 'node:readline';

const PORT = Number(process.argv[2] || 3123);
const BASE = 'http://localhost:' + PORT;

// The in-browser bridge: polls window.__KVE__ every 500 ms, executes queued
// terminal commands, and POSTs results/snapshots to this server.
const BRIDGE = `
(function () {
  if (window.__KVE_BRIDGE__) { console.warn('[KVE bridge] already loaded'); return; }
  var BASE = ${JSON.stringify(BASE)};
  var state = { queued: [] };
  var send = function (type, payload) {
    fetch(BASE + '/msg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: type, payload: payload })
    }).catch(function () {});
  };
  window.__KVE_BRIDGE__ = state;
  var tick = function () {
    var d = window.__KVE__;
    if (!d) return; // game modules not up yet
    // pull queued commands from the harness
    fetch(BASE + '/queue').then(function (r) { return r.json(); }).then(function (cmds) {
      cmds.forEach(function (c) { state.queued.push(c); });
    }).catch(function () {}).finally(function () {
      while (state.queued.length) {
        var cmd = state.queued.shift();
        try { send('result', Object.assign({ cmd: cmd }, d.run(cmd))); }
        catch (e) { send('result', { cmd: cmd, ok: false, output: String(e) }); }
      }
      try { send('snapshot', d.snapshot()); } catch (e) {}
    });
  };
  setInterval(tick, 500);
  send('hello', { title: document.title });
  console.log('%c[KVE bridge] connected to harness at ' + BASE + ' — type commands in the terminal',
    'color:#00ffaa;font-weight:bold');
})();
`;

const state = { connected: false, lastSnapshot: null };
const pendingCmds = []; // terminal → browser queue (polled via GET /queue)

function paint(msg, color) {
  const codes = { red: 31, green: 32, yellow: 33, cyan: 36, magenta: 35, dim: 90 };
  console.log(color && codes[color] ? `\x1b[${codes[color]}m${msg}\x1b[0m` : msg);
}

function paintSnapshot(s) {
  if (state.lastSnapshot && state.lastSnapshot.score === s.score &&
      state.lastSnapshot.enemies === s.enemies && state.lastSnapshot.state === s.state &&
      state.lastSnapshot.testAimbot.active === s.testAimbot.active) return;
  state.lastSnapshot = s;
  const p = s.player;
  paint(`  [${String(s.state).toUpperCase()}] score=${s.score} wave=${s.wave} enemies=${s.enemies} ` +
    (p ? `hp=${p.hp}/${p.maxHp} lives=${p.lives} weapon=${p.weapon} ` : '') +
    (s.testAimbot.active ? `AIMBOT→${s.testAimbot.target || 'none'} dps=${s.testAimbot.dps} ` : '') +
    (s.paused ? 'PAUSED' : ''), s.paused ? 'yellow' : 'dim');
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }
  if (req.method === 'GET' && req.url === '/bridge.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(BRIDGE);
    return;
  }
  if (req.method === 'GET' && req.url === '/queue') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(pendingCmds.splice(0, pendingCmds.length)));
    return;
  }
  if (req.method === 'POST' && req.url === '/msg') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        const { type, payload } = JSON.parse(body);
        if (type === 'hello') {
          state.connected = true;
          paint('● bridge connected: ' + (payload.title || 'game tab'), 'green');
        } else if (type === 'snapshot') {
          paintSnapshot(payload);
        } else if (type === 'cmd') {
          pendingCmds.push(payload.cmd);
        } else if (type === 'result') {
          paint('» ' + payload.cmd, 'cyan');
          String(payload.output).split('\n').forEach((l) => paint('   ' + l, payload.ok ? 'green' : 'red'));
        }
      } catch {}
      res.writeHead(200);
      res.end('ok');
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  paint('KVE debug harness listening on ' + BASE, 'magenta');
  paint('1) Make sure the game tab is open (npm start / any static server).', 'dim');
  paint('2) In the browser DEVTOOLS CONSOLE paste this and press Enter:', 'dim');
  paint('   fetch("' + BASE + '/bridge.js").then(r => r.text()).then(eval)', 'yellow');
  paint('3) Back here, type: help', 'dim');
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
  const cmd = line.trim();
  if (!cmd) return;
  if (cmd === 'quit' || cmd === 'exit') { rl.close(); server.close(); process.exit(0); }
  if (!state.connected) { paint('… bridge not connected yet (paste the one-liner in the browser console)', 'yellow'); return; }
  fetch(BASE + '/msg', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'cmd', payload: { cmd } }),
  }).catch(() => {});
  // The browser executes on its next 500 ms tick; results arrive via /msg.
});