#!/usr/bin/env node
/**
 * TrueNAS SCALE MCP Server
 * Connects to a TrueNAS SCALE instance via the REST API v2.0 and exposes system
 * info, storage pools, and physical disk health.
 *
 * Environment variables:
 *   TRUENAS_HOST     - host (default: 192.168.1.3)
 *   TRUENAS_PORT     - port (default: 443)
 *   TRUENAS_USERNAME - user (default: root)
 *   TRUENAS_PASSWORD - password (required)
 *   TRUENAS_SSL      - "insecure" (default) for self-signed, "strict" to verify
 *   TRUENAS_API_KEY  - optional: use a Bearer API key instead of basic auth
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import https from "https";
import http from "http";

const TN_HOST = process.env.TRUENAS_HOST || "192.168.1.3";
const TN_PORT = parseInt(process.env.TRUENAS_PORT || "443", 10);
const TN_USER = process.env.TRUENAS_USERNAME || "root";
const TN_PASS = process.env.TRUENAS_PASSWORD || "";
const TN_API_KEY = process.env.TRUENAS_API_KEY || "";
const STRICT = (process.env.TRUENAS_SSL || "insecure").toLowerCase() === "strict";
const REJECT_UNAUTHORIZED = STRICT && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0";

const lib = TN_PORT === 80 ? http : https;

function authHeader() {
  if (TN_API_KEY) return `Bearer ${TN_API_KEY}`;
  return `Basic ${Buffer.from(`${TN_USER}:${TN_PASS}`).toString("base64")}`;
}

function request(path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: TN_HOST,
      port: TN_PORT,
      path,
      method,
      headers: {
        "Authorization": authHeader(),
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "mcp-truenas/1.0",
      },
      rejectUnauthorized: REJECT_UNAUTHORIZED,
      timeout: 30000,
    };
    if (bodyStr) opts.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    const req = lib.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error(`Timeout connecting to ${TN_HOST}:${TN_PORT}`)); });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function api(path) {
  const r = await request(`/api/v2.0/${path}`);
  if (r.status !== 200) throw new Error(`TrueNAS API /${path} -> HTTP ${r.status}: ${typeof r.body === "string" ? r.body.substring(0, 200) : JSON.stringify(r.body).substring(0, 200)}`);
  return r.body;
}

function sizeGB(bytes) {
  if (bytes == null) return "?";
  return (bytes / (1024 ** 3)).toFixed(1);
}

const TOOLS = [
  {
    name: "truenas_status",
    description: "High-level TrueNAS status: version, hostname, pool count, disk count with health, and uptime.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_pool",
    description: "List TrueNAS storage pools (ZFS) with size, status, and used/free space.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "truenas_disk",
    description: "List physical disks with health status, size, and rotation rate. Optionally filter by health or by in-pool status.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Filter by drive type (e.g. 'SSD' or 'HDD')." },
        in_pool: { type: "boolean", description: "If true only disks in a pool; if false only disks not in a pool." },
      },
    },
  },
  {
    name: "truenas_system_info",
    description: "Return full TrueNAS system info (version, hostname, CPU, memory, model, serial).",
    inputSchema: { type: "object", properties: {} },
  },
];

async function handleToolCall(name, args) {
  const text = (t) => ({ content: [{ type: "text", text: t }] });

  if (name === "truenas_status") {
    const info = await api("system/info");
    const pools = await api("pool");
    const disks = await api("disk");
    let out = `# TrueNAS Status\n\n`;
    out += `**Version:** ${info.version}\n**Hostname:** ${info.hostname}\n`;
    if (info.model) out += `**Model:** ${info.model}\n`;
    if (info.serial) out += `**Serial:** ${info.serial}\n`;
    const cpu = `${info.cores || info.physical_cores || "?"} cores${info.model ? " (" + info.model + ")" : ""}`;
    const mem = info.physmem ? `${sizeGB(info.physmem)} GB` : "?";
    out += `\n**CPU:** ${cpu}   **RAM:** ${mem}\n`;
    if (info.loadavg && info.loadavg.length) out += `**Load:** ${info.loadavg.join(" ")}\n`;
    if (info.uptime) out += `**Uptime:** ${info.uptime}\n`;
    out += `\n**Pools:** ${pools.length}\n` + pools.map((p) => `  **${p.name}** [${p.status}] ${p.healthy ? "🟢 healthy" : "⚠️ check"}`).join("\n");
    const ssd = disks.filter((d) => (d.type || "").toUpperCase() === "SSD").length;
    const hdd = disks.length - ssd;
    out += `\n**Disks:** ${disks.length} total (${ssd} SSD, ${hdd} HDD)\n`;
    return text(out);
  }

  if (name === "truenas_pool") {
    const pools = await api("pool");
    if (!pools.length) return text("# TrueNAS Pools\n\n  (none)");
    return text(`# TrueNAS Pools (${pools.length})\n\n` + pools.map((p) => {
      let s = `  **${p.name}** [${p.status}]  total=${sizeGB(p.size)}GB  used=${sizeGB(p.allocated)}GB  free=${sizeGB(p.free)}GB  ${p.healthy ? "🟢 healthy" : "⚠️ unhealthy"}`;
      if (p.path) s += `\n     path=${p.path}`;
      return s;
    }).join("\n"));
  }

  if (name === "truenas_disk") {
    let disks = await api("disk");
    if (args.type) disks = disks.filter((d) => (d.type || "").toLowerCase() === String(args.type).toLowerCase());
    if (typeof args.in_pool === "boolean") disks = disks.filter((d) => !!(d.pool && (d.pool.name || d.pool.id)) === args.in_pool);
    if (!disks.length) return text("# TrueNAS Disks\n\n  (none match)");
    return text(`# TrueNAS Disks (${disks.length})\n\n` + disks.map((d) => {
      const kind = (d.type || (d.rotationrate === "0" ? "SSD" : "HDD") || "HDD").toUpperCase();
      const inPool = d.pool && (d.pool.name || d.pool.id) ? ` (pool: ${d.pool.name || d.pool.id})` : "";
      return `  **${d.name}** ${sizeGB(d.size)}GB ${kind} [${d.bus || "?"}]${d.model ? " " + d.model : ""}${inPool}${d.serial ? "  sn=" + d.serial : ""}`;
    }).join("\n"));
  }

  if (name === "truenas_system_info") {
    const info = await api("system/info");
    const pick = {
      version: info.version,
      hostname: info.hostname,
      cpu_model: info.model,
      cpu_cores: info.cores,
      physical_cores: info.physical_cores,
      physical_memory_gb: info.physmem ? sizeGB(info.physmem) : undefined,
      loadavg: info.loadavg,
      uptime: info.uptime,
      system_product: info.system_product,
      system_manufacturer: info.system_manufacturer,
      system_serial: info.system_serial,
      timezone: info.timezone,
    };
    return text("# TrueNAS System Info\n\n" + JSON.stringify(pick, null, 2));
  }

  return text(`❌ Unknown tool: ${name}`);
}

const server = new Server({ name: "mcp-truenas", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try { return await handleToolCall(name, args || {}); }
  catch (err) { return { content: [{ type: "text", text: `❌ Error: ${err.message}` }], isError: true }; }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp-truenas] Started. Target: https://${TN_HOST}:${TN_PORT}`);
  console.error(`[mcp-truenas] Auth: ${TN_API_KEY ? "API key" : `basic (${TN_USER})`}`);
  console.error(`[mcp-truenas] TLS: ${REJECT_UNAUTHORIZED ? "strict" : "insecure"}`);
}
main().catch((err) => { console.error("[mcp-truenas] Fatal:", err); process.exit(1); });
