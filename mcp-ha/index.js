#!/usr/bin/env node
/**
 * Home Assistant MCP Server
 * Connects to a Home Assistant instance via the REST API and exposes entity
 * states, search, and configuration.
 *
 * Environment variables:
 *   HA_HOST  - HA host (default: 192.168.1.4)
 *   HA_PORT  - HA port (default: 8123)
 *   HA_TOKEN - long-lived access token (required)
 *   HA_SSL   - "insecure" (default) for self-signed https, "strict" to verify,
 *              "plain" to force http
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import https from "https";
import http from "http";

const HA_HOST = process.env.HA_HOST || "192.168.1.4";
const HA_PORT = parseInt(process.env.HA_PORT || "8123", 10);
const HA_TOKEN = process.env.HA_TOKEN || "";
const SSL_MODE = (process.env.HA_SSL || "insecure").toLowerCase();
const USE_HTTPS = SSL_MODE !== "plain";
const REJECT_UNAUTHORIZED = SSL_MODE === "strict" && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0";

const lib = USE_HTTPS ? https : http;

function request(path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: HA_HOST,
      port: HA_PORT,
      path,
      method,
      headers: {
        "Authorization": `Bearer ${HA_TOKEN}`,
        "Accept": "application/json",
        "User-Agent": "mcp-ha/1.0",
        ...(!bodyStr ? {} : { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr) }),
      },
      rejectUnauthorized: REJECT_UNAUTHORIZED,
      timeout: 30000,
    };
    const req = lib.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error(`Timeout connecting to ${HA_HOST}:${HA_PORT}`)); });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function api(path) {
  const r = await request(path);
  if (r.status !== 200) throw new Error(`HA API ${path} -> HTTP ${r.status}: ${typeof r.body === "string" ? r.body.substring(0, 200) : JSON.stringify(r.body).substring(0, 200)}`);
  return r.body;
}

function stateIcon(st) {
  if (st === "on" || st === "open" || st === "playing" || st === "home") return "🟢";
  if (st === "off" || st === "closed" || st === "idle" || st === "stopped") return "⚫";
  if (st === "unavailable" || st === "unknown") return "⚪";
  if (st === "paused" || st === "on_pause") return "🟡";
  return "•";
}

function fmtEntity(s, verbose) {
  const a = s.attributes || {};
  const name = a.friendly_name || s.entity_id;
  const line = `  ${stateIcon(s.state)} **${name}** \`${s.entity_id}\` = ${s.state}`;
  if (!verbose) return line;
  const extra = [];
  if (a.unit_of_measurement) extra.push(`unit=${a.unit_of_measurement}`);
  if (a.device_class) extra.push(`dc=${a.device_class}`);
  if (a.friendly_name && a.friendly_name !== name) extra.push("");
  if (a.state_class) extra.push(`sc=${a.state_class}`);
  return line + (extra.length ? `\n     ${extra.join("  ")}` : "");
}

const TOOLS = [
  {
    name: "ha_status",
    description: "High-level Home Assistant status: version, location, total entity count, and a summary of key domains (lights, switches, sensors on/off).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ha_entities",
    description: "List Home Assistant entities. Optionally filter by domain (e.g. switch, light, sensor, binary_sensor), by state, and limit results.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Filter by entity domain (e.g. 'switch', 'light', 'sensor', 'binary_sensor', 'climate')." },
        state: { type: "string", description: "Filter by exact state (e.g. 'on', 'off', 'unavailable')." },
        limit: { type: "number", description: "Max entities to show (default 40)." },
        verbose: { type: "boolean", description: "Include unit, device_class, state_class. Default false." },
      },
    },
  },
  {
    name: "ha_entity",
    description: "Get the full state and attributes of a single Home Assistant entity by entity_id.",
    inputSchema: {
      type: "object",
      properties: {
        entity_id: { type: "string", description: "Full entity id (e.g. 'switch.office_lamp')." },
      },
      required: ["entity_id"],
    },
  },
  {
    name: "ha_search",
    description: "Search Home Assistant entities by name or id (case-insensitive substring match).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Substring to match against entity id and friendly name." },
        limit: { type: "number", description: "Max results (default 25)." },
      },
      required: ["query"],
    },
  },
  {
    name: "ha_call_service",
    description: "Call a Home Assistant service (e.g. homeassistant.toggle, switch.turn_on). Use target.entity_id for a specific entity. Read-only tools are recommended; service calls can change state.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Service domain (e.g. 'homeassistant', 'switch', 'light', 'climate')." },
        service: { type: "string", description: "Service name (e.g. 'toggle', 'turn_on', 'turn_off')." },
        entity_id: { type: "string", description: "Optional single entity id to target." },
        data: { type: "object", description: "Optional extra service data." },
      },
      required: ["domain", "service"],
    },
  },
];

async function handleToolCall(name, args) {
  const text = (t) => ({ content: [{ type: "text", text: t }] });

  if (name === "ha_status") {
    const cfg = await api("/api/config");
    const states = await api("/api/states");
    let out = `# Home Assistant Status\n\n`;
    out += `**Version:** ${cfg.version}\n**Location:** ${cfg.location_name}\n**Time zone:** ${cfg.time_zone || "?"}\n\n`;
    out += `**Entities:** ${states.length}\n`;
    // summarize domains
    const counts = {};
    let on = 0, off = 0, unav = 0;
    for (const s of states) {
      const dom = s.entity_id.split(".")[0];
      counts[dom] = (counts[dom] || 0) + 1;
      if (s.state === "on") on++;
      else if (s.state === "off") off++;
      else if (s.state === "unavailable" || s.state === "unknown") unav++;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15);
    out += "**Domains (top 15):**\n";
    out += top.map(([d, c]) => `  ${d}: ${c}`).join("\n");
    out += `\n\n**State summary:** ${on} on, ${off} off, ${unav} unavailable/unknown\n`;
    // a few notable entities
    const switches = states.filter((s) => s.entity_id.startsWith("switch.") || s.entity_id.startsWith("light.")).slice(0, 10);
    if (switches.length) {
      out += `\n**Sample lights/switches:**\n` + switches.map((s) => `  ${stateIcon(s.state)} ${s.attributes.friendly_name || s.entity_id} = ${s.state}`).join("\n");
    }
    return text(out);
  }

  if (name === "ha_entities") {
    const states = await api("/api/states");
    let filtered = states;
    if (args.domain) filtered = filtered.filter((s) => s.entity_id.startsWith(args.domain + "."));
    if (args.state) filtered = filtered.filter((s) => s.state === args.state);
    filtered.sort((a, b) => a.entity_id.localeCompare(b.entity_id));
    const limit = args.limit || 40;
    const shown = filtered.slice(0, limit);
    return text(`# HA Entities (${filtered.length} match${args.domain ? ` in ${args.domain}` : ""}${args.state ? ` state=${args.state}` : ""})\n` + (shown.length ? shown.map((s) => fmtEntity(s, !!args.verbose)).join("\n") : "  (none)") + (filtered.length > limit ? `\n... and ${filtered.length - limit} more` : ""));
  }

  if (name === "ha_entity") {
    const s = await api(`/api/states/${args.entity_id}`);
    return text(`# ${s.attributes.friendly_name || args.entity_id}\n\n` + JSON.stringify(s, null, 2));
  }

  if (name === "ha_search") {
    const states = await api("/api/states");
    const q = String(args.query).toLowerCase();
    const matches = states.filter((s) => {
      const nm = (s.attributes.friendly_name || "").toLowerCase();
      return s.entity_id.toLowerCase().includes(q) || nm.includes(q);
    });
    const limit = args.limit || 25;
    return text(`# HA Search "${args.query}" (${matches.length} match${matches.length === 1 ? "" : "es"})\n` + (matches.length ? matches.slice(0, limit).map((s) => fmtEntity(s, true)).join("\n") : "  (no matches)"));
  }

  if (name === "ha_call_service") {
    const data = { ...(args.data || {}) };
    if (args.entity_id) data.entity_id = args.entity_id;
    const r = await request(`/api/services/${args.domain}/${args.service}`, "POST", data);
    if (r.status === 200) {
      const n = Array.isArray(r.body) ? r.body.length : 0;
      return text(`✅ ${args.domain}.${args.service} called on ${args.entity_id || "no specific entity"} — ${n} entity(ies) affected.`);
    }
    return text(`❌ ${args.domain}.${args.service} failed: HTTP ${r.status} ${typeof r.body === "string" ? r.body : JSON.stringify(r.body)}`);
  }

  return text(`❌ Unknown tool: ${name}`);
}

const server = new Server({ name: "mcp-ha", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try { return await handleToolCall(name, args || {}); }
  catch (err) { return { content: [{ type: "text", text: `❌ Error: ${err.message}` }], isError: true }; }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp-ha] Started. Target: ${USE_HTTPS ? "https" : "http"}://${HA_HOST}:${HA_PORT}`);
  console.error(`[mcp-ha] Token: ${HA_TOKEN ? "configured" : "⚠️ NOT SET"}`);
}
main().catch((err) => { console.error("[mcp-ha] Fatal:", err); process.exit(1); });
