import { describe, expect, it } from "vitest";
import { readFurBuffer } from "../parser/fur/index.js";
import { BinaryWriter } from "../writer/fur/binaryWriter.js";

describe("Furnace 0.6.8.x parser", () => {
  it("rejects the newer INF2 header used by master-era files", () => {
    const w = new BinaryWriter();
    w.ascii("-Furnace module-", 16);
    w.u16(249);
    w.u16(0);
    w.i32(32);
    w.i32(0);
    w.i32(0);
    w.ascii("INF2", 4);
    w.i32(0);

    expect(() => readFurBuffer(w.toBuffer())).toThrow("expected INFO, got INF2");
  });
});
