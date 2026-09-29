// Filename: net/server.mjs
// Kitty Vs Everything — v3.20.0
// LAN WebSocket relay server (Node, 'ws' dependency). Runs on the HOST machine
// and relays messages between the host browser (authoritative) and the client
// browser (mirror). Enforces host-authoritative semantics:
//   * host   -> client: state, event, welcome
//   * client -> host:   input, hello
//   * either -> other:  bye
//
// Run: npm run lan   (or: node net/server.mjs [port])   (default port 8765)
// The host browser connects to 127.0.0.1:<port>; the client browser connects
// to <host-ip>:<port>.
import { WebSocketServer } from 'ws';

const port = Number(process.argv[2] || process.env.PORT || 8765);
const wss = new WebSocketServer({ port });

let hostWs = null;
let clientWs = null;

function send(ws, msg) {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(msg)); } catch (e) { /* ignore */ }
  }
}

wss.on('connection', (ws) => {
  ws.isHost = false;
  ws.isClient = false;

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch (e) { return; }
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'hello':
        if (msg.role === 'host') {
          hostWs = ws;
          ws.isHost = true;
          console.log('[LAN] host connected');
        } else if (msg.role === 'client') {
          clientWs = ws;
          ws.isClient = true;
          console.log('[LAN] client connected');
          // Forward the client's hello to the host so it can send a welcome.
          if (hostWs) send(hostWs, msg);
        }
        break;
      case 'welcome':
        // host -> client
        if (clientWs) send(clientWs, msg);
        break;
      case 'input':
        // client -> host
        if (hostWs) send(hostWs, msg);
        break;
      case 'state':
      case 'event':
        // host -> client
        if (clientWs) send(clientWs, msg);
        break;
      case 'bye':
        // either -> other
        if (ws.isHost && clientWs) send(clientWs, msg);
        if (ws.isClient && hostWs) send(hostWs, msg);
        break;
    }
  });

  ws.on('close', () => {
    if (ws.isHost) {
      console.log('[LAN] host disconnected');
      hostWs = null;
      if (clientWs) send(clientWs, { type: 'bye', reason: 'host left' });
    }
    if (ws.isClient) {
      console.log('[LAN] client disconnected');
      clientWs = null;
      if (hostWs) send(hostWs, { type: 'bye', reason: 'client left' });
    }
  });
});

console.log('[LAN] Kitty Vs Everything relay listening on ws://0.0.0.0:' + port);
console.log('[LAN] Host browser: connect to 127.0.0.1:' + port);
console.log('[LAN] Client browser: connect to <host-ip>:' + port);