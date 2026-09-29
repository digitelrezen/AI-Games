// Filename: net/E6.js
// Kitty Vs Everything — v3.20.0
// E6 flat-file codec — the project's standard plain-text record format.
//
// E6 is a dependency-free, line-oriented, pipe-delimited record format used
// for ALL new config files, network state schemas, player profiles, and local
// save state. It is intentionally boring and greppable:
//
//   #E6 <schema-id> v<major>.<minor>     <- header (schema id + version)
//   #FIELDS <f1>|<f2>|...|<fn>           <- schema mapping (field order)
//   <v1>|<v2>|...|<vn>                   <- record row (one per line)
//   <v1>|<v2>|...|<vn>                   <- record row
//
// Rules:
//   * Lines starting with '#' are comments (the header + #FIELDS are special).
//   * Blank lines are ignored.
//   * The delimiter is a single pipe '|'. Values are escaped so a value can
//     itself contain a pipe, backslash, or newline:
//         '\'  -> '\\'      '|'  -> '\|'      newline -> '\n'
//   * Field order is fixed by the #FIELDS line (consistent schema mapping).
//   * A record row with fewer values than fields pads the rest with ''.
//
// This module is pure (no DOM, no game imports) so it runs identically in the
// browser (localStorage persistence + export/import) and in Node (the LAN
// server writes live .e6 state files).
export const E6_VERSION = '1.0';
const DELIM = '|';
const HEADER_PREFIX = '#E6 ';
const FIELDS_PREFIX = '#FIELDS ';

/** Escape a single value for safe embedding in a pipe-delimited row. */
export function escapeValue(v) {
  return String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '\\n');
}

/** Reverse of escapeValue (single-pass, so `\\n` and `\n` stay distinct). */
export function unescapeValue(v) {
  const s = String(v);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === 'n') { out += '\n'; i++; continue; }
      if (next === '|') { out += '|'; i++; continue; }
      if (next === '\\') { out += '\\'; i++; continue; }
    }
    out += c;
  }
  return out;
}

/** Split a raw record row into unescaped values on unescaped pipes.
 *  Only responsible for NOT splitting on an escaped pipe (`\|`); it preserves
 *  every character (including backslashes) so unescapeValue can process them. */
export function splitRow(line) {
  const out = [];
  let cur = '';
  let esc = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (esc) { cur += c; esc = false; continue; }
    if (c === '\\') { cur += c; esc = true; continue; }
    if (c === DELIM) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map(unescapeValue);
}

/**
 * Serialize records into E6 text.
 * @param {string} schemaId  short identifier (e.g. 'netsettings', 'profile').
 * @param {string} version   schema version (e.g. '1.0').
 * @param {string[]} fields  ordered field names (the schema mapping).
 * @param {Array<object|*>} records  objects keyed by field, or raw value arrays.
 * @returns {string} E6 text (trailing newline).
 */
export function serialize(schemaId, version, fields, records) {
  const lines = [
    `${HEADER_PREFIX}${schemaId} v${version}`,
    `${FIELDS_PREFIX}${fields.join(DELIM)}`,
  ];
  for (const rec of records) {
    const vals = fields.map((f) => {
      const raw = Array.isArray(rec) ? rec[fields.indexOf(f)] : rec[f];
      return escapeValue(raw);
    });
    lines.push(vals.join(DELIM));
  }
  return lines.join('\n') + '\n';
}

/**
 * Parse E6 text into { schemaId, version, fields, records }.
 * Tolerant: missing header/fields degrade to null/[] without throwing.
 */
export function parse(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  let schemaId = null;
  let version = null;
  let fields = [];
  const records = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      if (line.startsWith(HEADER_PREFIX)) {
        const m = line.slice(HEADER_PREFIX.length).trim().match(/^(\S+)\s+v?([\d.]+)?$/);
        if (m) { schemaId = m[1]; version = m[2] || null; }
      } else if (line.startsWith(FIELDS_PREFIX)) {
        fields = splitRow(line.slice(FIELDS_PREFIX.length).trim());
      }
      continue;
    }
    const vals = splitRow(line);
    const rec = {};
    fields.forEach((f, i) => { rec[f] = vals[i] !== undefined ? vals[i] : ''; });
    records.push(rec);
  }
  return { schemaId, version, fields, records };
}

/** Convenience: parse and return just the record objects. */
export function toRecords(text) {
  return parse(text).records;
}

/**
 * Validate E6 text against an expected schema id + field list.
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validate(text, expectedSchemaId, expectedFields) {
  const errors = [];
  const doc = parse(text);
  if (doc.schemaId !== expectedSchemaId) {
    errors.push(`schema id '${doc.schemaId}' != expected '${expectedSchemaId}'`);
  }
  if (expectedFields && doc.fields.join(',') !== expectedFields.join(',')) {
    errors.push(`fields [${doc.fields.join(',')}] != expected [${expectedFields.join(',')}]`);
  }
  return { ok: errors.length === 0, errors };
}

/** Coerce an E6 string value to a number (0 on failure). */
export function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Coerce an E6 string value to a boolean ('1'/'true'/'on' => true). */
export function bool(v, fallback = false) {
  if (v === undefined || v === null || v === '') return fallback;
  return ['1', 'true', 'on', 'yes'].includes(String(v).toLowerCase());
}

export const E6 = {
  VERSION: E6_VERSION,
  escapeValue,
  unescapeValue,
  splitRow,
  serialize,
  parse,
  toRecords,
  validate,
  num,
  bool,
};
export default E6;
