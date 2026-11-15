import { afterEach, describe, expect, it, vi } from "vitest";
import { backendWatchpointId, createAlertService, fetchBackendWatchpoints, parseBackendWatchpoints } from "./alerts";
import { assessWatchpoint } from "./risk";

// shape from the backend docs: GET /api/watchpoint
const BODY = {
  success: true,
  data: [
    { name: "South Sudan, Warrap State และ Lakes State", country: "South Sudan", region: "Africa", lat: 7.62637, lon: 29.4172 },
    { name: "Western Equatoria, South Sudan", country: "South Sudan", region: "Africa", lat: 9.11851, lon: 23.80993 },
    { name: "Bié plateau", country: "Angola", region: "Africa", lat: -12.4, lon: 17.5 },
    { name: "Gran Chaco", country: "Argentina", region: "South America", lat: -24.5, lon: -62.1 },
    { name: "dup", country: "Angola", region: "Africa", lat: -12.4, lon: 17.5 },
    { name: "bad", country: "X", region: "Asia", lat: 123, lon: 0 },
  ],
};

describe("GET /api/watchpoint adapter", () => {
  it("maps rows to watchpoints with stable ids and the configured radius", () => {
    const wps = parseBackendWatchpoints(BODY, 30);
    expect(wps).toHaveLength(4); // duplicate + out-of-range dropped
    expect(wps[0]).toMatchObject({ id: backendWatchpointId(7.62637, 29.4172), country: "South Sudan", radiusKm: 30, area: "South Sudan · Africa" });
    expect(parseBackendWatchpoints(BODY, 30).map((w) => w.id)).toEqual(wps.map((w) => w.id));
  });

  it("uses season statistics only for the countries the calendar covers", () => {
    const [ss, , angola, arg] = parseBackendWatchpoints(BODY, 25);
    expect(ss!.region).toBeNull(); // Africa ≠ Angola's season
    expect(angola!.region).toBe("africa");
    expect(arg!.region).toBe("south_america");
  });

  it("out-of-coverage points say so instead of 'outside the fire season'", () => {
    const s = assessWatchpoint({ month: 1, season: undefined, near: [], outsideCoverage: true });
    expect(s.level).toBe("normal");
    expect(s.reasons.join(" ")).toContain("outside the 6 countries");
    expect(s.reasons.join(" ")).not.toContain("Outside the regional fire season");
  });

  it("rejects a body without success: true", () => {
    expect(() => parseBackendWatchpoints({ success: false, error: "db down" }, 25)).toThrow("db down");
    expect(() => parseBackendWatchpoints([], 25)).toThrow();
  });
});

describe("fetch + service wiring", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls {base}/watchpoint and parses the body", async () => {
    const f = vi.fn(async (_url: string) => new Response(JSON.stringify(BODY), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const wps = await fetchBackendWatchpoints("http://localhost:3000/api", 25);
    expect(f.mock.calls[0]![0]).toBe("http://localhost:3000/api/watchpoint");
    expect(wps).toHaveLength(4);
  });

  it("network failure → network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("failed"))));
    await expect(fetchBackendWatchpoints("http://x/api", 25)).rejects.toMatchObject({ kind: "network" });
  });

  it("backend set → watchpoints from it; subscriptions still local without an alerts API", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(BODY))));
    const svc = createAlertService("", "http://localhost:3000/api", 20);
    expect(svc.kind).toBe("local");
    expect(svc.watchpointSource).toBe("backend");
    expect((await svc.listWatchpoints())[0]!.radiusKm).toBe(20);
    expect(createAlertService("", "").watchpointSource).toBe("file");
    expect(createAlertService("http://alerts", "").watchpointSource).toBe("alerts");
  });
});
