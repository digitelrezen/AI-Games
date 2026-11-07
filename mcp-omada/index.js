#!/usr/bin/env node
/**
 * Omada SDN Controller MCP Server
 * Connects to a TP-Link Omada SDN controller via the Open API (authorization_code
 * grant) and exposes sites, devices, and clients.
 *
 * Authentication (validated flow):
 *   1. POST /openapi/authorize/login?client_id&omadac_id  {username,password} -> csrfToken + session cookie
 *   2. POST /openapi/authorize/code?client_id&omadac_id&response_type=code (Csrf-Token header) -> code
 *   3. POST /openapi/authorize/token?client_id&omadac_id&grant_type=authorization_code&code {client_secret} -> accessToken
 *
 * Data requests use header `Authorization: AccessToken=<accessToken>` (NOT "Bearer")
 * and must include pagination params (page, pageSize) on list endpoints.
 *
 * Environment variables:
 *   OMADA_HOST          - controller IP/hostname (default: 192.168.1.99)
 *   OMADA_PORT          - port (default: 8043)
 *   OMADA_CLIENT_ID     - Open API client_id (required)
 *   OMADA_CLIENT_SECRET - Open API client_secret (required)
 *   OMADA_CONTROLLER_ID - controller ID / omadac_id (required)
 *   OMADA_USERNAME      - Open API user (default: local-ai)
 *   OMADA_PASSWORD      - Open API user password (required)
 *   OMADA_SSL           - "insecure" (default) to skip self-signed TLS, "strict" to verify
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import https from "https";
import http from "http";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const OMADA_HOST = process.env.OMADA_HOST || "192.168.1.99";
const OMADA_PORT = parseInt(process.env.OMADA_PORT || "8043", 10);
const OMADA_CLIENT_ID = process.env.OMADA_CLIENT_ID || "";
const OMADA_CLIENT_SECRET = process.env.OMADA_CLIENT_SECRET || "";
const OMADA_CONTROLLER_ID = process.env.OMADA_CONTROLLER_ID || "";
const OMADA_USERNAME = process.env.OMADA_USERNAME || "local-ai";
const OMADA_PASSWORD = process.env.OMADA_PASSWORD || "";
const STRICT_TLS = (process.env.OMADA_SSL || "insecure").toLowerCase() === "strict";
// Allow NODE_TLS_REJECT_UNAUTHORIZED=0 to also force insecure (belt-and-suspenders).
const FORCE_INSECURE = process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";
const REJECT_UNAUTHORIZED = STRICT_TLS && !FORCE_INSECURE;

// ---------------------------------------------------------------------------
// HTTP client (cookie-aware, self-signed tolerant)
// ---------------------------------------------------------------------------
let sessionCookie = "";
let accessToken = null;
let tokenExpiry = 0; // epoch ms

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const isSecure = isSecurePort();
    const lib = isSecure ? https : http;
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: OMADA_HOST,
      port: OMADA_PORT,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "mcp-omada/1.0",
        ...headers,
      },
      rejectUnauthorized: REJECT_UNAUTHORIZED,
      timeout: 30000,
    };
    if (bodyStr) opts.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    if (sessionCookie) opts.headers["Cookie"] = sessionCookie;
    const req = lib.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const setCookies = res.headers["set-cookie"] || [];
        for (const sc of setCookies) {
          const part = sc.split(";")[0];
          if (part && !part.includes("deleteMe")) sessionCookie = part;
        }
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed, headers: res.headers });
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error(`Timeout connecting to ${OMADA_HOST}:${OMADA_PORT}`)); });
    req.on("error", (err) => {
      if (err.code === "SELF_SIGNED_CERT_IN_CHAIN" || err.code === "DEPTH_ZERO_SELF_SIGNED_CERT" || err.code === "CERT_HAS_EXPIRED") {
        reject(new Error(`TLS cert error to ${OMADA_HOST}:${OMADA_PORT}. Set OMADA_SSL=insecure (default) to skip.`));
      } else reject(err);
    });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function isSecurePort() {
  return OMADA_PORT !== 80;
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  const qp = `client_id=${encodeURIComponent(OMADA_CLIENT_ID)}&omadac_id=${encodeURIComponent(OMADA_CONTROLLER_ID)}`;

  // 1) login
  let r = await request("POST", `/openapi/authorize/login?${qp}`,
    { username: OMADA_USERNAME, password: OMADA_PASSWORD },
    { "X-Requested-With": "XMLHttpRequest" });
  const csrf = r.body && r.body.result && r.body.result.csrfToken;
  if (r.status !== 200 || !csrf) {
    throw new Error(`Omada login failed (${r.status}): ${JSON.stringify(r.body).substring(0, 200)}`);
  }

  // 2) code
  r = await request("POST", `/openapi/authorize/code?${qp}&response_type=code`, null,
    { "X-Requested-With": "XMLHttpRequest", "Csrf-Token": csrf });
  const code = r.body && r.body.result;
  if (r.status !== 200 || typeof code !== "string") {
    throw new Error(`Omada authorize/code failed (${r.status}): ${JSON.stringify(r.body).substring(0, 200)}`);
  }

  // 3) token
  r = await request("POST",
    `/openapi/authorize/token?${qp}&grant_type=authorization_code&code=${encodeURIComponent(code)}`,
    { client_secret: OMADA_CLIENT_SECRET });
  const at = r.body && r.body.result && r.body.result.accessToken;
  if (r.status !== 200 || !at) {
    throw new Error(`Omada authorize/token failed (${r.status}): ${JSON.stringify(r.body).substring(0, 200)}`);
  }
  accessToken = at;
  tokenExpiry = Date.now() + ((r.body.result.expiresIn || 7200) * 1000) - 120000;
  return accessToken;
}

async function apiGet(path) {
  const token = await getAccessToken();
  const r = await request("GET", path, null, { Authorization: `AccessToken=${token}` });
  if (r.status !== 200) {
    throw new Error(`Omada API GET ${path} -> HTTP ${r.status}: ${JSON.stringify(r.body).substring(0, 300)}`);
  }
  if (r.body && typeof r.body === "object" && "errorCode" in r.body && r.body.errorCode !== 0) {
    throw new Error(`Omada API error ${r.body.errorCode}: ${r.body.msg} (GET ${path})`);
  }
  return r.body;
}

async function resolveSiteId(siteId) {
  if (siteId) return siteId;
  const r = await apiGet(`/openapi/v1/${OMADA_CONTROLLER_ID}/sites?page=1&pageSize=1`);
  const data = (r && r.result && r.result.data) || [];
  if (!data.length) throw new Error("No sites found on this Omada controller.");
  return data[0].siteId;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function fmtUptime(s) { return s || "n/a"; }
function statusIcon(st) { return st === 1 ? "🟢" : "🔴"; }

function formatDevices(data, verbose) {
  if (!data || !data.length) return "  (no devices)";
  return data.map((d) => {
    const type = (d.type || "?").toUpperCase().padEnd(7);
    const on = statusIcon(d.status);
    const ip = d.ip || "no-ip";
    let line = `  ${on} **${d.name || d.mac}** [${type}] ${ip}`;
    if (verbose) {
      line += `\n     model=${d.model || d.modelName || "?"}  fw=${d.firmwareVersion || "?"}  cpu=${d.cpuUtil ?? "?"}%  mem=${d.memUtil ?? "?"}%  up=${fmtUptime(d.uptime)}`;
      line += `\n     mac=${d.mac}  sn=${d.sn || "?"}  lastSeen=${d.lastSeen ? new Date(d.lastSeen).toISOString() : "?"}`;
    }
    return line;
  }).join("\n");
}

function formatClients(data, limit) {
  if (!data || !data.length) return "  (no clients)";
  const shown = limit ? data.slice(0, limit) : data;
  return shown.map((c) => {
    const name = c.name || c.hostName || c.mac;
    const ip = c.ip || "no-ip";
    const dev = c.deviceType || c.deviceTypeDesc || "";
    const ssid = c.ssid || c.ssidName || "";
    const radio = c.radio || "";
    const rssi = c.rssi != null ? `  rssi=${c.rssi}` : "";
    return `  **${name}** ${ip} ${[dev, ssid, radio].filter(Boolean).join(" / ")}${rssi}`;
  }).join("\n");
}

function formatSites(data) {
  if (!data || !data.length) return "  (no sites)";
  return data.map((s) => {
    return `  **${s.name}** (siteId=${s.siteId}) — ${s.region || "?"} / ${s.timeZone || "?"} / scenario=${s.scenario || "?"}`;
  }).join("\n");
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    name: "omada_status",
    description: "High-level Omada controller status: version, site count, device count, and client count for the primary site.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "omada_sites",
    description: "List all Omada sites managed by the controller.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "omada_devices",
    description: "List network devices (switches, access points, gateways) in an Omada site. Omit siteId to use the first/primary site.",
    inputSchema: {
      type: "object",
      properties: {
        siteId: { type: "string", description: "Optional site ID (defaults to first site)." },
        verbose: { type: "boolean", description: "Include model, firmware, CPU/mem, serial, last-seen. Default false." },
      },
    },
  },
  {
    name: "omada_clients",
    description: "List connected clients (hosts) in an Omada site. Supports name/MAC/IP search and a result limit. Omit siteId to use the first/primary site.",
    inputSchema: {
      type: "object",
      properties: {
        siteId: { type: "string", description: "Optional site ID (defaults to first site)." },
        search: { type: "string", description: "Optional case-insensitive filter on name/hostname/MAC/IP." },
        limit: { type: "number", description: "Max clients to show (default 25)." },
      },
    },
  },
  {
    name: "omada_controller_info",
    description: "Return controller version, category, and Open API info (anonymous info endpoint).",
    inputSchema: { type: "object", properties: {} },
  },
];

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------
async function handleToolCall(name, args) {
  const text = (t) => ({ content: [{ type: "text", text: t }] });

  if (name === "omada_status") {
    const sites = await apiGet(`/openapi/v1/${OMADA_CONTROLLER_ID}/sites?page=1&pageSize=100`);
    const siteData = (sites && sites.result && sites.result.data) || [];
    const site = siteData[0];
    let out = `# Omada Controller Status\n\n`;
    const info = await request("GET", "/api/v2/anon/info", null, {});
    if (info.status === 200 && info.body && info.body.result) {
      const ir = info.body.result;
      out += `**Version:** ${ir.controllerVer || "?"}\n**Category:** ${ir.omadacCategory || "?"}\n**Configured:** ${ir.configured}\n\n`;
    }
    out += `**Sites:** ${siteData.length}\n`;
    out += formatSites(siteData) + "\n";
    if (site) {
      const devs = await apiGet(`/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${site.siteId}/devices?page=1&pageSize=1`);
      const clients = await apiGet(`/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${site.siteId}/clients?page=1&pageSize=1`);
      const devTotal = devs && devs.result ? devs.result.totalRows : "?";
      const cliTotal = clients && clients.result ? clients.result.totalRows : "?";
      out += `\n**Primary site "${site.name}"**\n  Devices: ${devTotal}\n  Clients: ${cliTotal}\n`;
    }
    return text(out);
  }

  if (name === "omada_sites") {
    const r = await apiGet(`/openapi/v1/${OMADA_CONTROLLER_ID}/sites?page=1&pageSize=100`);
    const data = (r && r.result && r.result.data) || [];
    return text(`# Omada Sites (${data.length})\n` + formatSites(data));
  }

  if (name === "omada_devices") {
    const siteId = await resolveSiteId(args.siteId);
    const r = await apiGet(`/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${siteId}/devices?page=1&pageSize=200`);
    const data = (r && r.result && r.result.data) || [];
    const total = r && r.result ? r.result.totalRows : data.length;
    return text(`# Omada Devices (${total})\n` + formatDevices(data, !!args.verbose));
  }

  if (name === "omada_clients") {
    const siteId = await resolveSiteId(args.siteId);
    const r = await apiGet(`/openapi/v1/${OMADA_CONTROLLER_ID}/sites/${siteId}/clients?page=1&pageSize=500`);
    let data = (r && r.result && r.result.data) || [];
    const total = r && r.result ? r.result.totalRows : data.length;
    if (args.search) {
      const q = String(args.search).toLowerCase();
      data = data.filter((c) =>
        [c.name, c.hostName, c.mac, c.ip, c.deviceType, c.ssid].some((f) => f && String(f).toLowerCase().includes(q)));
    }
    const limit = args.limit || 25;
    const header = `# Omada Clients (${args.search ? `matched ${data.length}` : total} total)`;
    return text(header + "\n" + formatClients(data, limit));
  }

  if (name === "omada_controller_info") {
    const r = await request("GET", "/api/v2/anon/info", null, {});
    if (r.status !== 200) return text(`❌ Failed to read controller info: HTTP ${r.status}`);
    const j = r.body && r.body.result;
    return text("# Omada Controller Info\n" + JSON.stringify(j, null, 2));
  }

  return text(`❌ Unknown tool: ${name}`);
}

// ---------------------------------------------------------------------------
// MCP server setup
// ---------------------------------------------------------------------------
const server = new Server({ name: "mcp-omada", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    return await handleToolCall(name, args || {});
  } catch (err) {
    return { content: [{ type: "text", text: `❌ Error: ${err.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp-omada] Started. Target: ${OMADA_HOST}:${OMADA_PORT}`);
  console.error(`[mcp-omada] Controller: ${OMADA_CONTROLLER_ID || "⚠️ NOT SET"}`);
  console.error(`[mcp-omada] Client ID: ${OMADA_CLIENT_ID ? "configured" : "⚠️ NOT SET"}`);
  console.error(`[mcp-omada] User: ${OMADA_USERNAME} / ${OMADA_PASSWORD ? "configured" : "⚠️ PASSWORD NOT SET"}`);
  console.error(`[mcp-omada] TLS: ${REJECT_UNAUTHORIZED ? "strict" : "insecure"}`);
}

main().catch((err) => { console.error("[mcp-omada] Fatal:", err); process.exit(1); });
