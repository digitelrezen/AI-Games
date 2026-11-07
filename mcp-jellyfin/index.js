#!/usr/bin/env node
/**
 * Jellyfin MCP Server
 * Connects to a Jellyfin media server and exposes libraries, items, sessions, and user info.
 *
 * Environment variables:
 *   JELLYFIN_HOST   - host (default: 192.168.1.9)
 *   JELLYFIN_PORT   - port (default: 8096)
 *   JELLYFIN_TOKEN  - pre-authenticated access token (preferred)
 *   JELLYFIN_USER   - username (for auth if no token provided)
 *   JELLYFIN_PASS   - password (for auth if no token provided)
 *   JELLYFIN_APP    - app/client name (default: local-ai)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import http from "http";
import https from "https";

const HOST = process.env.JELLYFIN_HOST || "192.168.1.9";
const PORT = parseInt(process.env.JELLYFIN_PORT || "8096", 10);
const TOKEN = process.env.JELLYFIN_TOKEN || "";
const USER = process.env.JELLYFIN_USER || "";
const PASS = process.env.JELLYFIN_PASS || "";
const APP = process.env.JELLYFIN_APP || "local-ai";
const USE_SSL = (process.env.JELLYFIN_SSL || "plain").toLowerCase() === "ssl";

const lib = USE_SSL ? https : http;
let activeToken = TOKEN;

// ─── HTTP Client ─────────────────────────────────────────────────────────────

function authHeader(token) {
  return `MediaBrowser Client="${APP}", Device="${APP}", DeviceId="${APP}", Version="1.0.0.0", Token="${token}"`;
}

function api(path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: HOST,
      port: PORT,
      path,
      method,
      headers: {
        "authorization": authHeader(activeToken),
        "accept": "application/json",
        "Content-Type": "application/json",
      },
      timeout: 30000,
    };
    if (bodyStr) opts.headers["Content-Length"] = Buffer.byteLength(bodyStr);

    const req = lib.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode === 401 && !TOKEN && USER && PASS) {
          // Token expired - re-authenticate
          reauth().then(() => api(path, method, body)).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Jellyfin API ${path} → HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          return;
        }
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error(`Timeout: ${HOST}:${PORT}${path}`)); });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function reauth() {
  const r = await new Promise((resolve, reject) => {
    const body = JSON.stringify({ UserName: USER, Pw: PASS });
    const req = lib.request({
      hostname: HOST, port: PORT, path: "/Users/AuthenticateByName", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error("Re-auth failed")); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
  if (!r.AccessToken) throw new Error("Re-authentication failed: no token returned");
  activeToken = r.AccessToken;
  console.error("[mcp-jellyfin] Re-authenticated, new token acquired");
}

// ─── MCP Tools ───────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "jellyfin_status",
    description: "Get Jellyfin server status: version, name, OS, and health.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "jellyfin_libraries",
    description: "List all media libraries (TV shows, movies, music, etc.) with item counts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "jellyfin_search",
    description: "Search the media library by name/keyword.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term" },
        type: { type: "string", description: "Filter by type: Movie, Series, Episode, Song, Album, Artist, etc." },
        limit: { type: "integer", description: "Max results (default: 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "jellyfin_now_playing",
    description: "Get currently active playback sessions.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "jellyfin_users",
    description: "List all Jellyfin users.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ─── Tool Handlers ───────────────────────────────────────────────────────────

async function handleToolCall(name, args) {
  const text = (t) => ({ content: [{ type: "text", text: t }] });

  if (name === "jellyfin_status") {
    const [info, health] = await Promise.all([
      api("/System/Info"),
      api("/System/HealthReport").catch(() => null),
    ]);
    let out = `# Jellyfin Status\n\n`;
    out += `**Server:** ${info.ServerName}\n`;
    out += `**Version:** ${info.Version}\n`;
    out += `**OS:** ${info.OperatingSystem}\n`;
    out += `**WebSocket Port:** ${info.WebSocketPortNumber}\n`;
    if (info.OperatingSystemDisplayName) out += `**Display:** ${info.OperatingSystemDisplayName}\n`;
    if (health) {
      const errors = health.Errors || [];
      const warnings = health.Warnings || [];
      out += `\n**Health:** ${errors.length === 0 ? "🟢 OK" : "🔴 " + errors.length + " errors"}\n`;
      if (warnings.length) out += `⚠️ Warnings: ${warnings.length}\n`;
    }
    return text(out);
  }

  if (name === "jellyfin_libraries") {
    const result = await api("/Library/MediaFolders?fields=PrimaryImageAspectRatio");
    const items = result.Items || [];
    if (!items.length) return text("# Libraries\n\n  (none)");
    return text(`# Media Libraries (${items.length})\n\n` + items.map((l) => {
      return `  **${l.Name}** — ${l.Type || "?"} — ${l.Path || ""}`;
    }).join("\n"));
  }

  if (name === "jellyfin_search") {
    const limit = Math.min(args.limit || 10, 50);
    let path = `/Search/Hints?searchTerm=${encodeURIComponent(args.query)}&limit=${limit}`;
    if (args.type) path += `&item_type=${args.type}`;
    const result = await api(path);
    const items = result.Items || [];
    if (!items.length) return text(`# Search: "${args.query}"\n\n  No results found.`);
    return text(`# Search: "${args.query}" (${items.length} results)\n\n` + items.map((i) => {
      const primary = i.PrimaryImageAspectRatio ? ` [${i.PrimaryImageAspectRatio}]` : "";
      return `  **${i.Name}** (${i.Type || i.SeriesType || "?"})${primary}`;
    }).join("\n"));
  }

  if (name === "jellyfin_now_playing") {
    const result = await api("/Sessions");
    const active = (result || []).filter((s) => s.NowPlayingItem);
    if (!active.length) return text("# Now Playing\n\n  No active sessions.");
    return text(`# Now Playing (${active.length} sessions)\n\n` + active.map((s) => {
      const item = s.NowPlayingItem;
      const pct = s.PlaybackPositionTicks && item.RunTimeTicks
        ? ` (${Math.round((s.PlaybackPositionTicks / item.RunTimeTicks) * 100)}%)`
        : "";
      return `  **${item.Name}** — ${s.Client || s.DeviceName} — ${s.UserName || "?"}${pct}`;
    }).join("\n"));
  }

  if (name === "jellyfin_users") {
    const result = await api("/Users");
    const users = result || [];
    return text(`# Users (${users.length})\n\n` + users.map((u) => {
      const admin = u.HasIsAdministrator || (u.Policy && u.Policy.IsAdministrator) ? " 👑" : "";
      return `  **${u.Name}**${admin} — ID: ${u.Id}`;
    }).join("\n"));
  }

  return text(`❌ Unknown tool: ${name}`);
}

// ─── Server Setup ────────────────────────────────────────────────────────────

const server = new Server({ name: "mcp-jellyfin", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try { return await handleToolCall(name, args || {}); }
  catch (err) { return { content: [{ type: "text", text: `❌ Error: ${err.message}` }], isError: true }; }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp-jellyfin] Started. Target: ${USE_SSL ? "https" : "http"}://${HOST}:${PORT}`);
  console.error(`[mcp-jellyfin] Auth: ${TOKEN ? "static token" : USER ? `user/pass (${USER})` : "⚠️ NO CREDENTIALS"}`);

  // Test connection
  try {
    const info = await api("/System/Info");
    console.error(`[mcp-jellyfin] ✅ Connected to ${info.ServerName} v${info.Version}`);
  } catch (err) {
    console.error(`[mcp-jellyfin] ⚠️ Initial connection failed: ${err.message}`);
    console.error("[mcp-jellyfin] Will retry on first tool call.");
  }
}

main().catch((err) => { console.error("[mcp-jellyfin] Fatal:", err); process.exit(1); });
