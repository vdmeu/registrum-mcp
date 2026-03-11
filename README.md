# Registrum MCP Server

**No Companies House API key needed.** One Registrum API key gives your AI agent enriched, cached UK company data — structured financials, director networks, and company profiles — directly inside Claude, Cursor, and any MCP-compatible client.

Unlike raw Companies House API wrappers that require you to register at the CH developer portal and manage your own rate limits, Registrum handles all of that for you: iXBRL filings parsed into clean JSON, 24h/7d caching, and circuit-breaker resilience on CH outages.

**5 tools, zero boilerplate.** Search companies, pull structured financials, list directors, and map corporate networks.

---

## Installation

### Claude Desktop

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "registrum": {
      "command": "npx",
      "args": ["-y", "@registrum/mcp"],
      "env": {
        "REGISTRUM_API_KEY": "reg_live_..."
      }
    }
  }
}
```

Get a free API key at [registrum.co.uk](https://registrum.co.uk) (50 calls/month free).

### Cursor

Add to `.cursor/mcp.json` in your project, or to `~/.cursor/mcp.json` globally — same format as above.

---

## Tools

| Tool | Description |
|------|-------------|
| `search_company` | Search for UK companies by name |
| `get_company` | Enriched company profile (age, overdue flags, SIC descriptions) |
| `get_financials` | Structured P&L + balance sheet from iXBRL filings |
| `get_directors` | Directors with full appointment history across all companies |
| `get_network` | Corporate network via shared director connections |

---

## Example prompts

> "Who are the directors of Tesco PLC and what other companies are they associated with?"

> "Get the latest financials for company 00445790"

> "Search for companies named 'Rolls-Royce' and show me their status"

> "Map the director network for Barratt Developments to depth 2"

---

## Plans

| Plan | Price | Calls/month |
|------|-------|------------|
| Free | £0 | 50 |
| Pro | £49/mo | 2,000 |
| Enterprise | £149/mo | 10,000 |

[See pricing →](https://registrum.co.uk/#pricing)

---

## API reference

Full API docs at [api.registrum.co.uk/docs](https://api.registrum.co.uk/docs)

## Support

[support@registrum.co.uk](mailto:support@registrum.co.uk)
