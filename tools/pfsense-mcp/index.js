#!/usr/bin/env node
/**
 * pfSense MCP Server
 * Connects to pfSense REST API v2 (pfrest) for logs, status, firewall rules, and diagnostics.
 *
 * Environment variables:
 *   PFSENSE_HOST  - pfSense IP/hostname (default: 192.168.1.1)
 *   PFSENSE_PORT  - Port (default: 10443)
 *   PFSENSE_KEY   - API key (required, used as x-api-key header)
 *   PFSENSE_SSL   - "insecure" to skip TLS cert verification (default: insecure)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import https from "https";
import { URL } from "url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PFSENSE_HOST = process.env.PFSENSE_HOST || "192.168.1.1";
const PFSENSE_PORT = parseInt(process.env.PFSENSE_PORT || "10443", 10);
const PFSENSE_KEY = process.env.PFSENSE_KEY || "";
const PFSENSE_INSECURE = (process.env.PFSENSE_SSL || "insecure").toLowerCase() === "insecure";
const API_PREFIX = "/api/v2";

// ---------------------------------------------------------------------------
// HTTP client (using https module for proper TLS handling)
// ---------------------------------------------------------------------------
function api(method, path, body = null, params = null) {
  return new Promise((resolve, reject) => {
    let pathname = `${API_PREFIX}${path}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      pathname += `?${qs}`;
    }

    const bodyStr = body ? JSON.stringify(body) : null;

    const options = {
      hostname: PFSENSE_HOST,
      port: PFSENSE_PORT,
      path: pathname,
      method: method,
      rejectUnauthorized: !PFSENSE_INSECURE,
      headers: {
        "x-api-key": PFSENSE_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      timeout: 30000,
    };

    if (bodyStr) {
      options.headers["Content-Length"] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          const errMsg =
            typeof parsed === "object" && parsed !== null
              ? JSON.stringify(parsed).substring(0, 500)
              : data.substring(0, 500);
          reject(new Error(`API ${method} ${path} → ${res.statusCode}: ${errMsg}`));
          return;
        }

        resolve(parsed);
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout connecting to ${PFSENSE_HOST}:${PFSENSE_PORT}`));
    });

    req.on("error", (err) => {
      if (err.code === "SELF_SIGNED_CERT_IN_CHAIN" || err.code === "CERT_HAS_EXPIRED" || err.code === "DEPTH_ZERO_SELF_SIGNED_CERT") {
        reject(new Error(`TLS cert error connecting to ${PFSENSE_HOST}:${PFSENSE_PORT}. Set PFSENSE_SSL=insecure to skip verification.`));
      } else if (err.code === "ECONNREFUSED") {
        reject(new Error(`Connection refused to ${PFSENSE_HOST}:${PFSENSE_PORT}. Is pfSense running?`));
      } else if (err.code === "ETIMEDOUT" || err.code === "ECONNRESET") {
        reject(new Error(`Connection failed to ${PFSENSE_HOST}:${PFSENSE_PORT}: ${err.code}`));
      } else {
        reject(new Error(`Failed to reach pfSense at ${PFSENSE_HOST}:${PFSENSE_PORT}: ${err.message}`));
      }
    });

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    name: "pfsense_logs",
    description:
      "Retrieve pfSense logs. Types: firewall, system, auth, dhcp, openvpn. Supports pagination and querying.",
    inputSchema: {
      type: "object",
      properties: {
        log_type: {
          type: "string",
          description: "Log type to retrieve",
          enum: ["firewall", "system", "auth", "dhcp", "openvpn"],
        },
        limit: {
          type: "integer",
          description: "Max entries to return (default: 50, max: 200)",
          minimum: 1,
          maximum: 200,
        },
        offset: {
          type: "integer",
          description: "Offset for pagination (default: 0)",
          minimum: 0,
        },
        query: {
          type: "string",
          description: "Filter query (e.g., 'action:block' or 'interface:lan'). See pfrest query syntax.",
        },
      },
      required: ["log_type"],
    },
  },
  {
    name: "pfsense_status",
    description:
      "Get overall pfSense system status: uptime, CPU load, memory, interfaces, and gateways in one call.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "pfsense_interfaces",
    description: "Get network interface status (IP, link state, traffic).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "pfsense_gateways",
    description: "Get gateway status (IP, state, latency).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "pfsense_version",
    description: "Get pfSense version and build information.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "pfsense_dhcp_leases",
    description: "Get active DHCP leases.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Max leases to return (default: 50)",
        },
      },
    },
  },
  {
    name: "pfsense_rules",
    description:
      "List firewall rules. Supports filtering by interface, type (pass/block), and other fields.",
    inputSchema: {
      type: "object",
      properties: {
        interface: {
          type: "string",
          description: "Filter by interface (e.g., 'lan', 'wan', 'opt0')",
        },
        type: {
          type: "string",
          description: "Filter by rule type: 'pass' or 'block'",
          enum: ["pass", "block"],
        },
        limit: {
          type: "integer",
          description: "Max rules to return (default: 50)",
        },
        query: {
          type: "string",
          description: "Advanced query filter",
        },
      },
    },
  },
  {
    name: "pfsense_add_rule",
    description:
      "Add a new firewall rule to an interface.",
    inputSchema: {
      type: "object",
      properties: {
        interface: {
          type: "string",
          description: "Target interface (e.g., 'lan', 'wan', 'opt0')",
        },
        type: {
          type: "string",
          description: "Rule action: 'pass' or 'block'",
          enum: ["pass", "block"],
        },
        ipprotocol: {
          type: "string",
          description: "Protocol: 'TCP', 'UDP', 'ICMPv4', 'ICMPv6', 'ESP', 'AH', 'IPv6-Route', 'IPv6-Neck', 'IPv6-Opt', 'any' (default: TCP)",
        },
        source: {
          type: "string",
          description: "Source type: 'any', 'single', 'network', 'alias'",
        },
        source_address: {
          type: "string",
          description: "Source IP or network (e.g., '192.168.1.100' or '192.168.1.0/24'). Omit if source is 'any'.",
        },
        source_port: {
          type: "string",
          description: "Source port(s): single (e.g., '1234'), range (e.g., '1000-2000'), or omit for any",
        },
        destination: {
          type: "string",
          description: "Destination type: 'any', 'single', 'network', 'alias'",
        },
        destination_address: {
          type: "string",
          description: "Destination IP or network. Omit if destination is 'any'.",
        },
        destination_port: {
          type: "string",
          description: "Destination port(s): single (e.g., '443'), range (e.g., '8000-9000'), or omit for any",
        },
        descr: {
          type: "string",
          description: "Rule description",
        },
        log: {
          type: "boolean",
          description: "Enable logging for this rule (default: false)",
        },
        position: {
          type: "string",
          description: "Insert position: 'top' or 'bottom' (default: bottom)",
        },
      },
      required: ["interface", "type"],
    },
  },
  {
    name: "pfsense_delete_rule",
    description: "Delete a firewall rule by its ID (UUID).",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The rule ID/UUID to delete (from pfsense_rules output)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "pfsense_ping",
    description: "Run a ping test from pfSense to a target host/IP.",
    inputSchema: {
      type: "object",
      properties: {
        host: {
          type: "string",
          description: "Target IP address or hostname to ping",
        },
        count: {
          type: "integer",
          description: "Number of ping packets (default: 3, max: 10)",
          minimum: 1,
          maximum: 10,
        },
        source_address: {
          type: "string",
          description: "Optional source IP to ping from",
        },
      },
      required: ["host"],
    },
  },
  {
    name: "pfsense_aliases",
    description: "List firewall aliases (address, port, and group aliases).",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Max aliases to return (default: 100)",
        },
      },
    },
  },
  {
    name: "pfsense_port_forwards",
    description: "List NAT port forward rules.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Max entries to return (default: 50)",
        },
      },
    },
  },
  {
    name: "pfsense_services",
    description: "Get status of all running services.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "pfsense_states",
    description: "Get current firewall connection states (active connections).",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Max states to return (default: 50)",
        },
        query: {
          type: "string",
          description: "Filter query (e.g., 'source:192.168.1.100')",
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------
async function handleToolCall(name, args) {
  const text = (s) => ({ content: [{ type: "text", text: s }] });

  switch (name) {
    // --- LOGS ---
    case "pfsense_logs": {
      const limit = Math.min(args.limit || 50, 200);
      const offset = args.offset || 0;
      const params = { limit: String(limit), offset: String(offset) };
      if (args.query) params.query = args.query;

      const result = await api("GET", `/status/logs/${args.log_type}`, null, params);
      const entries = result.data || [];
      let output = `## ${args.log_type.toUpperCase()} Logs (${entries.length} entries)\n\n`;
      for (const entry of entries.slice(0, limit)) {
        output += formatLogEntry(entry) + "\n";
      }
      return text(output);
    }

    // --- STATUS ---
    case "pfsense_status": {
      const [sysRes, ifaceRes, gwRes] = await Promise.allSettled([
        api("GET", "/status/system"),
        api("GET", "/status/interfaces"),
        api("GET", "/status/gateways"),
      ]);

      let output = "## pfSense System Status\n\n";

      if (sysRes.status === "fulfilled") {
        const s = sysRes.value.data;
        output += "### System\n";
        output += `  **Uptime:** ${s.uptime || "N/A"}\n`;
        output += `  **Load:** ${s.load || s.cpu_load || "N/A"}\n`;
        output += `  **Memory:** ${s.memory || s.mem || "N/A"}\n`;
        if (s.hostname) output += `  **Hostname:** ${s.hostname}\n`;
        if (s.version) output += `  **Version:** ${s.version}\n`;
        output += "\n";
      } else {
        output += `### System\n  ⚠️ ${sysRes.reason.message}\n\n`;
      }

      if (ifaceRes.status === "fulfilled") {
        output += "### Interfaces\n";
        output += formatInterfaceList(ifaceRes.value.data) + "\n";
      } else {
        output += `### Interfaces\n  ⚠️ ${ifaceRes.reason.message}\n`;
      }

      if (gwRes.status === "fulfilled") {
        output += "\n### Gateways\n";
        output += formatGatewayList(gwRes.value.data) + "\n";
      }

      return text(output);
    }

    case "pfsense_interfaces": {
      const result = await api("GET", "/status/interfaces");
      let output = "## Network Interfaces\n\n";
      output += formatInterfaceList(result.data);
      return text(output);
    }

    case "pfsense_gateways": {
      const result = await api("GET", "/status/gateways");
      let output = "## Gateway Status\n\n";
      output += formatGatewayList(result.data);
      return text(output);
    }

    // --- SYSTEM ---
    case "pfsense_version": {
      const result = await api("GET", "/system/version");
      const v = result.data;
      let output = "## pfSense Version\n\n";
      output += `**Version:** ${v.version}\n`;
      if (v.base) output += `**Base:** ${v.base}\n`;
      if (v.patch) output += `**Patch:** ${v.patch}\n`;
      if (v.buildtime) output += `**Build:** ${v.buildtime}\n`;
      return text(output);
    }

    case "pfsense_dhcp_leases": {
      const limit = Math.min(args.limit || 50, 200);
      const result = await api("GET", "/status/dhcp_server/leases", null, { limit: String(limit) });
      const leases = result.data || [];
      let output = `## DHCP Leases (${leases.length})\n\n`;
      output += "IP | MAC | Hostname | Interface\n";
      output += "---|---|---|---\n";
      for (const l of leases) {
        output += `${l.ip || l.address || "N/A"} | ${l.mac || "N/A"} | ${l.hostname || l.host || "N/A"} | ${l.interface || l.sci || "N/A"}\n`;
      }
      return text(output);
    }

    // --- FIREWALL RULES ---
    case "pfsense_rules": {
      const limit = Math.min(args.limit || 50, 200);
      const params = { limit: String(limit) };
      let query = args.query;
      if (args.interface) query = query ? `${query} AND interface:${args.interface}` : `interface:${args.interface}`;
      if (args.type) query = query ? `${query} AND type:${args.type}` : `type:${args.type}`;
      if (query) params.query = query;

      const result = await api("GET", "/firewall/rules", null, params);
      const rules = result.data || [];
      let output = `## Firewall Rules (${rules.length})\n\n`;
      output += "ID (short) | Type | Interface | Proto | Source | Dest | Port | Descr | Log\n";
      output += "---|---|---|---|---|---|---|---|---\n";
      for (const r of rules) {
        const id = (r.id || r.uuid || "N/A").substring(0, 8);
        const type = r.disabled ? `❌${r.type}` : r.type;
        const iface = r.interface || "N/A";
        const proto = (r.ipprotocol || "TCP").substring(0, 4);
        const src = r.source?.address || r.source || "any";
        const dst = r.destination?.address || r.destination || "any";
        const port = r.destination_port || r.destination?.port || "";
        const descr = (r.descr || "").substring(0, 30);
        const log = r.log ? "✓" : "";
        output += `${id} | ${type} | ${iface} | ${proto} | ${src} | ${dst} | ${port} | ${descr} | ${log}\n`;
      }
      return text(output);
    }

    case "pfsense_add_rule": {
      const rule = {
        type: args.type || "pass",
        interface: args.interface,
        ipprotocol: args.ipprotocol || "TCP",
        source: args.source || "any",
        destination: args.destination || "any",
        tracker: "00000000-0000-0000-0000-000000000000",
      };

      if (args.source_address) rule.source_address = args.source_address;
      if (args.source_port) rule.source_port = args.source_port;
      if (args.destination_address) rule.destination_address = args.destination_address;
      if (args.destination_port) rule.destination_port = args.destination_port;
      if (args.descr) rule.descr = args.descr;
      if (args.log !== undefined) rule.log = args.log;

      const result = await api("POST", "/firewall/rule", rule);
      return text(
        `✅ Rule added to ${args.interface}:\n\`\`\`json\n${JSON.stringify(rule, null, 2)}\n\`\`\`\n\nResponse: ${JSON.stringify(result.data || result, null, 2).substring(0, 500)}`
      );
    }

    case "pfsense_delete_rule": {
      const result = await api("DELETE", `/firewall/rule`, null, { id: args.id });
      return text(`✅ Rule ${args.id.substring(0, 8)} deleted.\nResponse: ${JSON.stringify(result, null, 2).substring(0, 300)}`);
    }

    // --- NETWORK TOOLS ---
    case "pfsense_ping": {
      const body = {
        host: args.host,
        count: Math.min(args.count || 3, 10),
      };
      if (args.source_address) body.source_address = args.source_address;

      const result = await api("POST", "/diagnostics/ping", body);
      const data = result.data || {};
      let output = `## Ping: ${args.host}\n\n`;
      if (data.output) {
        output += "```\n" + data.output + "\n```\n";
      }
      output += `**Result code:** ${data.result_code ?? "N/A"} ${data.result_code === 0 ? "✅" : "❌"}`;
      return text(output);
    }

    case "pfsense_aliases": {
      const limit = Math.min(args.limit || 100, 500);
      const result = await api("GET", "/firewall/aliases", null, { limit: String(limit) });
      const aliases = result.data || [];
      let output = `## Firewall Aliases (${aliases.length})\n\n`;
      output += "Name | Type | Value\n";
      output += "---|---|---\n";
      for (const a of aliases) {
        const name = a.name || "N/A";
        const type = a.type || "N/A";
        const value = a.address || a.port || a.aliases || JSON.stringify(a).substring(0, 60);
        output += `${name} | ${type} | ${value}\n`;
      }
      return text(output);
    }

    case "pfsense_port_forwards": {
      const limit = Math.min(args.limit || 50, 200);
      const result = await api("GET", "/firewall/nat/port_forwards", null, { limit: String(limit) });
      const forwards = result.data || [];
      let output = `## NAT Port Forwards (${forwards.length})\n\n`;
      output += "Interface | Proto | Dest IP | Dest Port | Target | Target Port | Descr\n";
      output += "---|---|---|---|---|---|---\n";
      for (const f of forwards) {
        const iface = f.interface || "N/A";
        const proto = f.ipprotocol || "TCP";
        const dip = f.destination?.address || "N/A";
        const dport = f.destination?.port || "N/A";
        const target = f.target || "N/A";
        const tport = f.target_port || "N/A";
        const descr = (f.descr || "").substring(0, 30);
        output += `${iface} | ${proto} | ${dip} | ${dport} | ${target} | ${tport} | ${descr}\n`;
      }
      return text(output);
    }

    case "pfsense_services": {
      const result = await api("GET", "/status/services");
      const services = result.data || [];
      let output = "## Services Status\n\n";
      output += "Service | Status\n";
      output += "---|---\n";
      if (Array.isArray(services)) {
        for (const s of services) {
          const name = s.name || s.service || "N/A";
          const status = s.status || s.running || "unknown";
          output += `${name} | ${status}\n`;
        }
      } else {
        output += JSON.stringify(services, null, 2);
      }
      return text(output);
    }

    case "pfsense_states": {
      const limit = Math.min(args.limit || 50, 200);
      const params = { limit: String(limit) };
      if (args.query) params.query = args.query;
      const result = await api("GET", "/firewall/states", null, params);
      const states = result.data || [];
      let output = `## Connection States (${states.length})\n\n`;
      output += "Source | Dest | Proto | State | Interface\n";
      output += "---|---|---|---|---\n";
      for (const s of states) {
        output += `${s.source || "N/A"} | ${s.destination || "N/A"} | ${s.proto || "N/A"} | ${s.state || "N/A"} | ${s.interface || "N/A"}\n`;
      }
      return text(output);
    }

    default:
      return text(`❌ Unknown tool: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function formatLogEntry(entry) {
  if (typeof entry === "string") return entry;
  // pfrest v2 log entries have {id, text} format
  if (entry.text) return entry.text;
  // Fallback for other formats
  const parts = [];
  if (entry.time || entry.timestamp) parts.push(entry.time || entry.timestamp);
  if (entry.interface) parts.push(`[${entry.interface}]`);
  if (entry.action) parts.push(entry.action.toUpperCase());
  if (entry.source) parts.push(`src:${entry.source}`);
  if (entry.destination) parts.push(`dst:${entry.destination}`);
  if (entry.proto) parts.push(entry.proto);
  if (entry.reason) parts.push(`reason:${entry.reason}`);
  if (entry.rule || entry.rule_id) parts.push(`rule:${entry.rule || entry.rule_id}`);
  if (entry.message) parts.push(entry.message);

  if (parts.length > 0) return parts.join(" ");
  return JSON.stringify(entry).substring(0, 200);
}

function formatInterfaceList(data) {
  if (!data) return "  (no data)";
  if (Array.isArray(data)) {
    return data
      .map((i) => {
        const name = i.name || i.description || i.interface || "unknown";
        const status = i.link || i.status || "unknown";
        const ip = i.address || i.ipaddr || i.ip || "N/A";
        const bps = i.bps ? ` (${i.bps} bps)` : "";
        return `  **${name}**: ${status} — ${ip}${bps}`;
      })
      .join("\n");
  }
  if (typeof data === "object") {
    return Object.entries(data)
      .filter(([k]) => !k.startsWith("_"))
      .map(([key, val]) => {
        if (typeof val === "object" && val !== null) {
          const status = val.link || val.status || "unknown";
          const ip = val.address || val.ipaddr || "N/A";
          return `  **${key}**: ${status} — ${ip}`;
        }
        return `  **${key}**: ${val}`;
      })
      .join("\n");
  }
  return `  ${JSON.stringify(data, null, 2)}`;
}

function formatGatewayList(data) {
  if (!data) return "  (no data)";
  if (Array.isArray(data)) {
    return data
      .map((g) => {
        const name = g.name || g.description || "unknown";
        const status = g.status || g.state || "unknown";
        const ip = g.gateway || g.ip || "N/A";
        const latency = g.latency ? ` (${latency}ms)` : "";
        const icon = status === "online" || status === "up" ? "🟢" : "🔴";
        return `  ${icon} **${name}** (${ip}): ${status}${latency}`;
      })
      .join("\n");
  }
  if (typeof data === "object") {
    return Object.entries(data)
      .filter(([k]) => !k.startsWith("_"))
      .map(([key, val]) => {
        if (typeof val === "object" && val !== null) {
          const status = val.status || val.state || "unknown";
          const ip = val.gateway || val.ip || "N/A";
          return `  **${key}** (${ip}): ${status}`;
        }
        return `  **${key}**: ${val}`;
      })
      .join("\n");
  }
  return `  ${JSON.stringify(data, null, 2)}`;
}

// ---------------------------------------------------------------------------
// MCP Server setup
// ---------------------------------------------------------------------------
const server = new Server(
  { name: "pfsense-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    return await handleToolCall(name, args || {});
  } catch (err) {
    return {
      content: [{ type: "text", text: `❌ Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[pfsense-mcp] Started. Target: ${PFSENSE_HOST}:${PFSENSE_PORT}`);
  console.error(`[pfsense-mcp] API key: ${PFSENSE_KEY ? "configured" : "⚠️ NOT SET (set PFSENSE_KEY)"}`);
  console.error(`[pfsense-mcp] SSL: ${PFSENSE_INSECURE ? "insecure" : "strict"}`);
}

main().catch((err) => {
  console.error("[pfsense-mcp] Fatal:", err);
  process.exit(1);
});
