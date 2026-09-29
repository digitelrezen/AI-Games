// Filename: net/NetProtocol.js
// Kitty Vs Everything — v3.20.0
// LAN wire protocol. The WebSocket envelope is a small JSON message; the
// STATE COLLECTIONS (players, enemies, boss) are serialized as E6 flat-file
// record rows (consistent schema mapping + standardized '|' delimiters) so the
// on-the-wire state is human-readable and versioned.
//
// Message types (JSON):
//   hello   client -> host  { type, role, profile:{theme,callsign} }
//   welcome host  -> client { type, yourId, host:{theme,callsign}, config }
//   input   client -> host  { type, seq, thrust,brake,boost,fire,stun,napalm,
//                                            ultimate,cycleWeapon,deployFleet }
//   state   host  -> client { type, seq, time, score, multiplier, wave,
//                                            players:<E6>, enemies:<E6>, boss:<E6> }
//   event   host  -> client { type, kind, ... }   (explosion / banner / powerup)
//   bye     either        { type, reason }
//
// E6 state schemas (fixed field order):
//   player: id|x|y|angle|hp|shield|weapon|minis|score|alive
//   enemy : id|type|x|y|hp|angle
//   boss  : active|hp|maxHp|phase|x|y
import E6 from './E6.js';

export const MSG = {
  HELLO: 'hello',
  WELCOME: 'welcome',
  INPUT: 'input',
  STATE: 'state',
  EVENT: 'event',
  BYE: 'bye',
};

export const PLAYER_FIELDS = ['id', 'theme', 'x', 'y', 'angle', 'hp', 'shield', 'weapon', 'minis', 'score', 'lives', 'alive'];
export const ENEMY_FIELDS = ['id', 'type', 'x', 'y', 'hp', 'angle'];
export const BOSS_FIELDS = ['active', 'hp', 'maxHp', 'phase', 'x', 'y'];

const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
const r0 = (n) => Math.round(Number(n) || 0);

/** Build one player's E6 record row object from a Player instance. */
export function playerRecord(p) {
  return {
    id: p.netId || 'p1',
    theme: p.theme || 'yellow',
    x: r1(p.x), y: r1(p.y), angle: r1(p.angle),
    hp: r0(p.hp), shield: r0(p.shield),
    weapon: p.weapon || 'vulkan',
    minis: (p.minis ? p.minis.length : 0),
    score: r0(p.score || 0),
    lives: r0(p.lives || 0),
    alive: p.alive ? 1 : 0,
  };
}

/** Build the E6 'player' block for a list of players. */
export function encodePlayers(players) {
  return E6.serialize('player', E6.VERSION, PLAYER_FIELDS, players.map(playerRecord));
}

/** Build the E6 'enemy' block for a list of enemies (compact, no art). */
export function encodeEnemies(enemies) {
  const recs = enemies
    .filter((e) => e && e.alive !== false)
    .slice(0, 120) // cap the wire size on LAN
    .map((e, i) => ({
      id: e.netId || i,
      type: e.type || 'wasp',
      x: r1(e.x), y: r1(e.y),
      hp: r0(e.hp),
      angle: r1(e.angle || 0),
    }));
  return E6.serialize('enemy', E6.VERSION, ENEMY_FIELDS, recs);
}

/** Build the E6 'boss' block from the game's boss (or an empty inactive row). */
export function encodeBoss(game) {
  const b = game.boss;
  if (b && b.alive !== false) {
    return E6.serialize('boss', E6.VERSION, BOSS_FIELDS, [{
      active: 1, hp: r0(b.hp), maxHp: r0(b.maxHp || b.hp),
      phase: b.phase || 1, x: r1(b.x), y: r1(b.y),
    }]);
  }
  return E6.serialize('boss', E6.VERSION, BOSS_FIELDS, [{
    active: 0, hp: 0, maxHp: 0, phase: 0, x: 0, y: 0,
  }]);
}

/**
 * Build a full `state` snapshot message from the host's live game.
 * @param {Game} game
 * @param {number} seq monotonic sequence number
 */
export function encodeState(game, seq) {
  const players = (game.players && game.players.length) ? game.players : [game.player];
  return {
    type: MSG.STATE,
    seq,
    time: r1(game.time),
    score: r0(game.score),
    multiplier: r1(game.multiplier),
    wave: game.wave || 0,
    players: encodePlayers(players),
    enemies: encodeEnemies(game.enemies || []),
    boss: encodeBoss(game),
  };
}

/** Parse the E6 'player' block back into record objects. */
export function decodePlayers(text) { return E6.toRecords(text); }
/** Parse the E6 'enemy' block back into record objects. */
export function decodeEnemies(text) { return E6.toRecords(text); }
/** Parse the E6 'boss' block back into a single record (or null). */
export function decodeBoss(text) {
  const recs = E6.toRecords(text);
  return recs.length ? recs[0] : null;
}

/** Build an `input` message from a P2 input source (action layer). */
export function encodeInput(input, seq) {
  const a = (name) => (input.isDownAction ? input.isDownAction(name) : false);
  const p = (name) => (input.wasPressedAction ? input.wasPressedAction(name) : false);
  return {
    type: MSG.INPUT,
    seq,
    thrust: a('thrust') ? 1 : 0,
    brake: a('brake') ? 1 : 0,
    boost: a('boost') ? 1 : 0,
    fire: a('fire') ? 1 : 0,
    stun: p('stun') ? 1 : 0,
    napalm: p('napalm') ? 1 : 0,
    ultimate: p('ultimate') ? 1 : 0,
    cycleWeapon: p('cycleWeapon') ? 1 : 0,
    deployFleet: p('deployFleet') ? 1 : 0,
  };
}

/** Wrap any payload as a JSON WebSocket string. */
export function pack(msg) { return JSON.stringify(msg); }
/** Parse a JSON WebSocket string (null on bad input). */
export function unpack(text) {
  try { return JSON.parse(text); } catch (e) { return null; }
}

export const NetProtocol = {
  MSG, PLAYER_FIELDS, ENEMY_FIELDS, BOSS_FIELDS,
  playerRecord, encodePlayers, encodeEnemies, encodeBoss, encodeState,
  decodePlayers, decodeEnemies, decodeBoss, encodeInput, pack, unpack,
};
export default NetProtocol;
