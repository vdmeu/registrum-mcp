#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const API_BASE = "https://api.registrum.co.uk/v1";
const VERSION = "1.0.0";
const apiKey = process.env.REGISTRUM_API_KEY;
if (!apiKey) {
    process.stderr.write("Error: REGISTRUM_API_KEY environment variable is required.\n" +
        "Get a free key at https://registrum.co.uk\n");
    process.exit(1);
}
async function callApi(path) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { "X-API-Key": apiKey },
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`API error ${res.status}: ${body}`);
    }
    return res.json();
}
function text(content) {
    return {
        content: [{ type: "text", text: JSON.stringify(content, null, 2) }],
    };
}
function err(message) {
    return {
        isError: true,
        content: [{ type: "text", text: message }],
    };
}
// ─── Server ──────────────────────────────────────────────────────────────────
const server = new McpServer({ name: "registrum", version: VERSION }, {
    capabilities: { tools: {} },
    instructions: "Use these tools to look up UK companies registered at Companies House. " +
        "Company numbers are zero-padded 8-digit strings (e.g. '00445790' for Tesco PLC). " +
        "When a user gives you a company name, use search_company first to find the number, " +
        "then use get_company, get_financials, get_directors, or get_network as needed.",
});
// ─── Tools ───────────────────────────────────────────────────────────────────
server.registerTool("search_company", {
    title: "Search for companies",
    description: "Search for UK companies by name. Returns a list of matching companies with " +
        "their company number, status, type, and registered address. Use this first " +
        "when you only have a company name and need its company number.",
    inputSchema: {
        query: z.string().min(1).describe("Company name or keywords to search for"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(20)
            .optional()
            .describe("Maximum number of results to return (default 10)"),
    },
}, async ({ query, limit }) => {
    try {
        const params = new URLSearchParams({ q: query });
        if (limit)
            params.set("limit", String(limit));
        const data = await callApi(`/search?${params}`);
        return text(data);
    }
    catch (e) {
        return err(String(e));
    }
});
server.registerTool("get_company", {
    title: "Get company profile",
    description: "Get an enriched profile for a UK company by its Companies House number. " +
        "Returns name, status, type, incorporation date, registered address, SIC codes " +
        "with descriptions, accounts status, confirmation statement status, and derived " +
        "fields like company_age_years and accounts.overdue that are not available from " +
        "the raw Companies House API.",
    inputSchema: {
        company_number: z
            .string()
            .regex(/^[A-Z0-9]{1,8}$/, "Must be 1–8 alphanumeric characters")
            .describe("Companies House company number, e.g. '00445790' for Tesco PLC. " +
            "Numeric-only numbers should be zero-padded to 8 digits."),
    },
}, async ({ company_number }) => {
    try {
        const data = await callApi(`/company/${company_number}`);
        return text(data);
    }
    catch (e) {
        return err(String(e));
    }
});
server.registerTool("get_financials", {
    title: "Get company financials",
    description: "Get structured financial data for a UK company, parsed from its iXBRL accounts " +
        "filed at Companies House. Returns revenue, cost of sales, gross profit, operating " +
        "profit, net profit, fixed assets, current assets, total equity, net assets, " +
        "creditors, and average employees for the current and prior reporting year. " +
        "Also includes accounts type (full/abbreviated/micro/dormant) and a data_quality " +
        "block indicating which fields were extracted and which were absent from the filing. " +
        "Cached for 7 days.",
    inputSchema: {
        company_number: z
            .string()
            .regex(/^[A-Z0-9]{1,8}$/)
            .describe("Companies House company number, e.g. '00445790' for Tesco PLC"),
    },
}, async ({ company_number }) => {
    try {
        const data = await callApi(`/company/${company_number}/financials`);
        return text(data);
    }
    catch (e) {
        return err(String(e));
    }
});
server.registerTool("get_directors", {
    title: "Get company directors",
    description: "Get the current and past directors for a UK company, including each director's " +
        "name, role, appointment date, resignation date (if applicable), nationality, " +
        "country of residence, and a list of other companies they serve or have served as " +
        "director. This gives you a full picture of a director's corporate history in one call.",
    inputSchema: {
        company_number: z
            .string()
            .regex(/^[A-Z0-9]{1,8}$/)
            .describe("Companies House company number, e.g. '00445790' for Tesco PLC"),
    },
}, async ({ company_number }) => {
    try {
        const data = await callApi(`/company/${company_number}/directors`);
        return text(data);
    }
    catch (e) {
        return err(String(e));
    }
});
server.registerTool("get_network", {
    title: "Get director network",
    description: "Map the corporate network connected to a UK company via shared directors. " +
        "Returns all companies connected through shared board members, up to the specified " +
        "depth. Each connected company includes its name, number, status, and the directors " +
        "it shares with the focal company. Useful for identifying corporate group structures, " +
        "related party relationships, and director interlocks.",
    inputSchema: {
        company_number: z
            .string()
            .regex(/^[A-Z0-9]{1,8}$/)
            .describe("Companies House company number, e.g. '00445790' for Tesco PLC"),
        depth: z
            .number()
            .int()
            .min(1)
            .max(2)
            .optional()
            .describe("Traversal depth: 1 = direct connections only, 2 = connections of connections (default 1). " +
            "Depth 2 can return many results for large companies."),
    },
}, async ({ company_number, depth }) => {
    try {
        const params = depth ? `?depth=${depth}` : "";
        const data = await callApi(`/company/${company_number}/network${params}`);
        return text(data);
    }
    catch (e) {
        return err(String(e));
    }
});
// ─── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=index.js.map