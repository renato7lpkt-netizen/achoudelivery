import { describe, expect, it } from "vitest";
import { isLinkActive, linkMinutes, linkResult, timeLeft } from "./affiliation";

const now = new Date(2026, 9, 22, 12, 0);
const at = (min: number) => new Date(now.getTime() + min * 60000).toISOString();

describe("linkMinutes", () => {
  it("converts and clamps to 1 hour .. 8 weeks", () => {
    expect(linkMinutes(3, "horas")).toBe(180);
    expect(linkMinutes(2, "dias")).toBe(2880);
    expect(linkMinutes(1, "semanas")).toBe(10080);
    expect(linkMinutes(0, "horas")).toBe(60);
    expect(linkMinutes(99, "semanas")).toBe(80640);
  });
});

describe("timeLeft", () => {
  it("formats days, hours and minutes", () => {
    expect(timeLeft(at(2 * 1440 + 5 * 60), now)).toBe("2 d 5 h");
    expect(timeLeft(at(190), now)).toBe("3 h 10 min");
    expect(timeLeft(at(8), now)).toBe("8 min");
    expect(timeLeft(at(-5), now)).toBe("0 min");
  });
});

describe("isLinkActive / linkResult", () => {
  it("is active until it ends or is ended early", () => {
    expect(isLinkActive({ ends_at: at(10), ended_at: null }, now)).toBe(true);
    expect(isLinkActive({ ends_at: at(-1), ended_at: null }, now)).toBe(false);
    expect(isLinkActive({ ends_at: at(10), ended_at: at(-1) }, now)).toBe(false);
  });
  it("splits server refusals from results", () => {
    expect(linkResult({ error: "Código inválido" })).toEqual({ error: "Código inválido" });
    expect(linkResult<{ name: string }>({ name: "Ana" })).toEqual({ name: "Ana" });
  });
});
