import { describe, it, expect } from "vitest";
import { registeredTools, toolsFromSchemaHtml, versionFromScoreHtml, findDrift } from "../scripts/glama/check.mjs";

describe("glama drift checker", () => {
  it("reads registered tool names from server source", () => {
    const src = `server.registerTool(\n "get_psc",\n{});server.registerTool("get_compliance", {});`;
    expect(registeredTools(src)).toEqual(["get_compliance", "get_psc"]);
  });

  it("extracts tool names Glama's schema page actually links to", () => {
    const html = `<a href="/mcp/servers/vdmeu/registrum-mcp/tools/get_company">get_company</a>
      <a href="/mcp/servers/vdmeu/registrum-mcp/tools/get_directors">get_directors</a>`;
    expect(toolsFromSchemaHtml(html)).toEqual(["get_company", "get_directors"]);
  });

  it("dedupes repeated tool links on the schema page", () => {
    const html = `<a href="/tools/get_company">x</a><a href="/tools/get_company">y</a>`;
    expect(toolsFromSchemaHtml(html)).toEqual(["get_company"]);
  });

  it("reads the version off the score page's 'Latest release' text", () => {
    const html = `<div class="woN leflXI"><p>Latest release: v<!-- -->1.0.2</p></div>`;
    expect(versionFromScoreHtml(html)).toBe("1.0.2");
  });

  it("returns null when the score page has no release line (layout changed)", () => {
    expect(versionFromScoreHtml("<div>no release info here</div>")).toBeNull();
  });

  it("flags tools we ship that Glama has not scanned yet", () => {
    const live = ["get_company", "get_compliance", "get_psc"];
    const scanned = ["get_company"];
    expect(findDrift(live, scanned)).toEqual({ missing: ["get_compliance", "get_psc"], extra: [] });
  });

  it("flags tools Glama has that we no longer ship", () => {
    const live = ["get_company"];
    const scanned = ["get_company", "get_removed_tool"];
    expect(findDrift(live, scanned)).toEqual({ missing: [], extra: ["get_removed_tool"] });
  });

  it("passes when scanned and live tool sets match", () => {
    const tools = ["get_company", "get_directors"];
    expect(findDrift(tools, tools)).toEqual({ missing: [], extra: [] });
  });
});
