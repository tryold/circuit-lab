import { describe, expect, it } from "vitest";
import { parseIntelHex } from "./intelHex";
import { BLINK_HEX } from "./starters";

describe("parseIntelHex", () => {
  it("reads the blink firmware", () => {
    const { size, bytes } = parseIntelHex(BLINK_HEX);
    expect(size).toBe(132);
    expect(bytes[0]).toBe(0x07);
  });
  it("refuses text that is not HEX", () => {
    expect(() => parseIntelHex("hello")).toThrow("not an Intel HEX record");
  });
  it("refuses a bad checksum", () => {
    expect(() => parseIntelHex(":0400000001C0FFCF00\n:00000001FF")).toThrow("checksum");
  });
  it("needs an end-of-file record", () => {
    expect(() => parseIntelHex(":0400000001C0FFCF6D")).toThrow("end-of-file");
  });
});
