#!/usr/bin/env node
/**
 * TrueNAS SCALE MCP Server
 * Connects to a TrueNAS SCALE instance via WebSocket JSON-RPC 2.0 API
 * and exposes system info, storage pools, and physical disk health.
 *
 * Uses the modern TrueNAS WebSocket API (api/current) instead of the
 * deprecated REST API v2.0.
 *
 * Environment variables:
 *   TRUENAS_HOST     - host (default: 192.168.1.3)
 *   TRUENAS_PORT     - port (default: 443)
 *   TRUENAS_USERNAME - user (default: root)
 *   TRUENAS_PASSWORD - password (optional if API key is provided)
 *   TRUENAS_SSL      - "insecure" (default) for self-signed, "strict" to verify
 *   TRUENAS_API_KEY  - optional: use a Bearer API key instead of basic auth
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const TN_HOST = process.env.TRUENAS_HOST || "192.168.1.3";
const TN_PORT = parseInt(process.env.TRUENAS_PORT || "443", 10);
const TN_USER = process.env.TRUENAS_USERNAME || "root";
const TN_PASS = process.env.TRUENAS_PASSWORD || "";
const TN_API_KEY = process.env.TRUENAS_API_KEY || "";
const STRICT = (process.env.TRUENAS_SSL || "insecure").toLowerCase() === "strict";
const REJECT_UNAUTHORIZED = STRICT && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0";

// WebSocket URL (TrueNAS serves both HTTPS and WebSocket on the same port)
const WS_SCHEME = TN_PORT === 80 ? "ws" : "wss";
const WS_URL = `${WS_SCHEME}://${TN_HOST}:${TN_PORT}/api/current`;

// ─── WebSocket JSON-RPC 2.0 Client ───────────────────────────────────────────

class TrueNASClient {
  constructor() {
    this.ws = null;
    this.authenticated = false;
    this.pending = new Map(); // id -> {resolve, reject}
    this.nextId = 1;
    this.connecting = null;
  }

  connect() {
    if (this.connecting) return this.connecting;

    this.connecting = new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        reject(new Error(`WebSocket connection timeout to ${WS_URL}`));
        this.ws?.close();
      }, 15000);

      this.ws.onopen = async () => {
        clearTimeout(timeout);
        try {
          await this._login();
          this.authenticated = true;
          console.error(`[mcp-truenas] WebSocket connected & authenticated: ${WS_URL}`);
          resolve();
        } catch (err) {
          reject(err);
          this.ws?.close();
        }
      };

      this.ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        // JSON-RPC response (has id + result/error)
        if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
          const p = this.pending.get(msg.id);
          if (p) {
            this.pending.delete(msg.id);
            if (msg.error) {
              p.reject(new Error(`JSON-RPC error ${msg.error.code}: ${msg.error.message}`));
            } else {
              p.resolve(msg.result);
            }
          }
        }
        // Ignore notifications/events (msg.method without id, or subscriptions)
      };

      this.ws.onclose = () => {
        this.authenticated = false;
        console.error("[mcp-truenas] WebSocket closed");
        // Reject all pending requests
        for (const [id, p] of this.pending) {
          p.reject(new Error("WebSocket connection closed"));
          this.pending.delete(id);
        }
      };

      this.ws.onerror = (err) => {
        clearTimeout(timeout);
        const msg = err?.message || "WebSocket connection error";
        console.error(`[mcp-truenas] WebSocket error: ${msg}`);
        if (!this.authenticated && !this.connecting) {
          reject(new Error(msg));
        }
      };
    });

    // Reset connecting flag when resolved/rejected
    const p = this.connecting;
    p.finally(() => { this.connecting = null; });
    return p;
  }

  async _login() {
    if (TN_API_KEY) {
      // API key authentication - dedicated method in TrueNAS 25.10+
      const result = await this.call("auth.login_with_api_key", [TN_API_KEY]);
      if (result !== true) throw new Error(`API key auth returned: ${result}`);
    } else if (TN_USER && TN_PASS) {
      // Username/password authentication (positional params: [username, password])
      const result = await this.call("auth.login", [TN_USER, TN_PASS]);
      if (result !== true) throw new Error(`Username/password auth returned: ${result}`);
    } else {
      throw new Error("No authentication method configured. Set TRUENAS_API_KEY or TRUENAS_USERNAME + TRUENAS_PASSWORD.");
    }
  }

  call(method, params = []) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("WebSocket not connected"));
    }
    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: "2.0", method, params, id });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout waiting for response to ${method}`));
      }, 30000);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timeout); resolve(v); },
        reject: (e) => { clearTimeout(timeout); reject(e); },
      });
      this.ws.send(payload);
    });
  }

  /**
   * Ensure we're connected and authenticated, then make the call.
   * Reconnects automatically if the socket dropped.
   */
  async ensureCall(method, params = []) {
    if (!this.authenticated || this.ws?.readyState !== WebSocket.OPEN) {
      this.ws?.close();
      this.connecting = null;
      await this.connect();
    }
    return this.call(method, params);
  }

  close() {
    this.ws?.close();
  }
}

const client = new TrueNASClient();

// ─── MCP Server ───────────────────────────────────────────────────────────────

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
    const info = await client.ensureCall("system.info");
    const pools = await client.ensureCall("pool.query");
    const disks = await client.ensureCall("disk.query");
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
    const pools = await client.ensureCall("pool.query");
    if (!pools.length) return text("# TrueNAS Pools\n\n  (none)");
    return text(`# TrueNAS Pools (${pools.length})\n\n` + pools.map((p) => {
      let s = `  **${p.name}** [${p.status}]  total=${sizeGB(p.size)}GB  used=${sizeGB(p.allocated)}GB  free=${sizeGB(p.free)}GB  ${p.healthy ? "🟢 healthy" : "⚠️ unhealthy"}`;
      if (p.path) s += `\n     path=${p.path}`;
      return s;
    }).join("\n"));
  }

  if (name === "truenas_disk") {
    let disks = await client.ensureCall("disk.query");
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
    const info = await client.ensureCall("system.info");
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

const server = new Server({ name: "mcp-truenas", version: "2.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try { return await handleToolCall(name, args || {}); }
  catch (err) { return { content: [{ type: "text", text: `❌ Error: ${err.message}` }], isError: true }; }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp-truenas] v2.0.0 Started. WebSocket: ${WS_URL}`);
  console.error(`[mcp-truenas] Auth: ${TN_API_KEY ? "API key" : `username (${TN_USER})`}`);
  console.error(`[mcp-truenas] TLS: ${REJECT_UNAUTHORIZED ? "strict" : "insecure"}`);

  // Connect eagerly so we fail fast if TrueNAS is unreachable
  try {
    await client.connect();
    console.error("[mcp-truenas] ✅ Initial connection established");
  } catch (err) {
    console.error(`[mcp-truenas] ⚠️ Initial connection failed: ${err.message}`);
    console.error("[mcp-truenas] Will retry on first tool call.");
  }
}

main().catch((err) => { console.error("[mcp-truenas] Fatal:", err); process.exit(1); });

// Clean shutdown
process.on("SIGINT", () => { client.close(); process.exit(0); });
process.on("SIGTERM", () => { client.close(); process.exit(0); });
