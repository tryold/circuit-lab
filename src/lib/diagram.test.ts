import { describe, expect, it } from "vitest";
import { checkDiagram } from "./diagram";
import { starterDiagram } from "./starters";

describe("checkDiagram", () => {
  it("accepts both starter diagrams", () => {
    expect(checkDiagram(starterDiagram("uno"), "uno").ok).toBe(true);
    expect(checkDiagram(starterDiagram("pico"), "pico").ok).toBe(true);
  });
  it("refuses duplicate ids", () => {
    const diagram = starterDiagram("uno");
    diagram.parts[2]!.id = "r1";
    expect(checkDiagram(diagram, "uno")).toEqual({ ok: false, error: 'Two parts use the id "r1".' });
  });
  it("refuses unknown pins", () => {
    const diagram = starterDiagram("pico");
    diagram.connections[0]!.from = "board:GP40";
    const result = checkDiagram(diagram, "pico");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('"board:GP40"');
  });
  it("refuses another board", () => {
    expect(checkDiagram(starterDiagram("uno"), "pico").ok).toBe(false);
  });
});
