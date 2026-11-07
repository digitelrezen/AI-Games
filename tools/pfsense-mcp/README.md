# pfSense MCP Server

MCP server that gives AI assistants direct access to your pfSense firewall via the REST API v2 (pfrest).

**Target:** `192.168.1.1:10443` (pfSense 2.9.0-RELEASE)

## Available Tools

| Tool | Description |
|------|-------------|
| `pfsense_logs` | Retrieve logs: firewall, system, auth, dhcp, openvpn |
| `pfsense_status` | Overall system status (uptime, interfaces, gateways) |
| `pfsense_interfaces` | Network interface status and IPs |
| `pfsense_gateways` | Gateway status (online/offline, latency) |
| `pfsense_version` | pfSense version and build info |
| `pfsense_dhcp_leases` | Active DHCP lease table |
| `pfsense_rules` | List firewall rules (filter by interface/type) |
| `pfsense_add_rule` | Add a firewall rule |
| `pfsense_delete_rule` | Delete a firewall rule by ID |
| `pfsense_ping` | Ping a host from pfSense |
| `pfsense_aliases` | List firewall aliases |
| `pfsense_port_forwards` | List NAT port forward rules |
| `pfsense_services` | Service status |
| `pfsense_states` | Active firewall connection states |

## Configuration

### Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `PFSENSE_HOST` | `192.168.1.1` | pfSense IP |
| `PFSENSE_PORT` | `10443` | Web UI / API port |
| `PFSENSE_KEY` | *(your API key)* | Used as `x-api-key` header |
| `PFSENSE_SSL` | `insecure` | Skip TLS cert verification |

### MCP Config Entry

```json
"pfsense": {
  "command": "node",
  "args": ["C:\\Dev\\AI-GAMES\\tools\\pfsense-mcp\\index.js"],
  "env": {
    "PFSENSE_HOST": "192.168.1.1",
    "PFSENSE_PORT": "10443",
    "PFSENSE_KEY": "<your-pfsense-api-key>",
    "PFSENSE_SSL": "insecure"
  },
  "timeout": 30
}
```

## Requirements

- Node.js >= 18
- pfSense REST API package (`pfSense-pkg-RESTAPI`) installed
- API key created in pfSense web UI (System → API Access → Keys)

## Files

```
pfsense-mcp/
├── index.js         # MCP server (single file)
├── package.json     # Dependencies
└── README.md        # This file
```
