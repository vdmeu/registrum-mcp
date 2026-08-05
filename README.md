# Registrum MCP Server

**UK company data in your AI agent — without building Companies House plumbing.**

One API key. No Companies House developer account, no rate-limit handling, no
iXBRL parsing. Works in Claude Desktop, Claude Code, Cursor, and any
MCP-compatible client.

```bash
npx -y @registrum/mcp
```

---

## Why this instead of the Companies House API directly

Companies House publishes the raw register for free, and you can absolutely
call it yourself. What you then own is the plumbing:

| Doing it yourself | With Registrum |
|---|---|
| Register for a CH developer key, manage OAuth | One `REGISTRUM_API_KEY` |
| 600 requests/5min, and you handle the 429s | Server-side throttling on a higher negotiated budget |
| Accounts arrive as iXBRL documents you must parse | `get_financials` returns turnover, net assets, profit/loss as numbers |
| PSC control types are raw codes | Decoded to plain English |
| Ownership chains: recurse yourself, handle cycles | `get_psc_chain` returns the resolved tree with termination reasons |
| Director networks: N+1 queries across appointments | `get_network` traverses to depth 2 |
| Retry, cache, and survive CH outages yourself | 24h/7d caching, circuit breaker, stale-while-revalidate |

Other Companies House MCP servers make you bring your own CH key and hand back
the raw response. This one does the enrichment.

---

## Install

**Claude Desktop** — `~/.claude/claude_desktop_config.json`
**Cursor** — `.cursor/mcp.json` (per project) or `~/.cursor/mcp.json` (global)

```json
{
  "mcpServers": {
    "registrum": {
      "command": "npx",
      "args": ["-y", "@registrum/mcp"],
      "env": { "REGISTRUM_API_KEY": "reg_live_..." }
    }
  }
}
```

[Get a free key](https://registrum.co.uk/?utm_source=mcp&utm_campaign=readme) — 50 calls/month, no card.

---

## Tools

| Tool | What you get |
|---|---|
| `search_company` | Find a company by name → company number |
| `get_company` | Profile: status, age, SIC descriptions, overdue flags |
| `get_financials` | Turnover, net assets, profit/loss, employees — parsed from iXBRL, in GBP |
| `get_directors` | Current board with appointment history across all their companies |
| `get_psc` | Persons with Significant Control, control types in plain English |
| `get_psc_chain` | Ownership traversed to ultimate beneficial owners, with termination reasons |
| `get_compliance` | **ECCTA identity-verification status** — who has verified, who is pending, who is overdue |
| `get_network` | Companies connected by shared directors, to depth 2 |

### On `get_compliance`

The Economic Crime and Corporate Transparency Act requires every UK director
and PSC to verify their identity with Companies House. **Enforcement begins
18 November 2026**, after which unverified officers can block filings.

The tool returns verified / pending / overdue counts plus each unverified
person and their individual deadline. It deliberately distinguishes **pending**
(deadline not yet reached — not a failure) from **overdue** (missed). Treating
those as the same thing is the single easiest way to report a compliant company
as non-compliant.

---

## Example prompts

> "Is Tesco PLC compliant with ECCTA director verification, and who still needs to verify?"

> "Pull the last filed financials for 00445790 and tell me if turnover grew."

> "Who ultimately owns Rolls-Royce Holdings? Trace the ownership chain."

> "Which companies share directors with Barratt Developments?"

> "Search for 'Monzo' and show me status, incorporation date and directors."

---

## Plans

Free tier is 50 calls/month with every core endpoint. Paid tiers add volume,
PSC chain traversal and the ECCTA compliance endpoint.

Prices and quotas are served live from [`GET /v1/plans`](https://api.registrum.co.uk/v1/plans) —
that endpoint is the source of truth, so this README does not duplicate the
numbers and cannot go stale against them. Human-readable version at
[registrum.co.uk](https://registrum.co.uk/?utm_source=mcp&utm_campaign=readme#pricing).

---

## Notes

- Company numbers are zero-padded 8-character strings: `00445790`, `SC000268`.
- Responses are JSON, cached server-side (24h profiles/directors, 7d financials).
- Every call sends `User-Agent: @registrum/mcp/<version>` so we can see which
  features developers actually use. No telemetry runs on your machine.

[API reference](https://api.registrum.co.uk/docs) · [Issues](https://github.com/vdmeu/registrum-mcp/issues) · [support@registrum.co.uk](mailto:support@registrum.co.uk)
