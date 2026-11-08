import { describe, it, expect } from "vitest";
import {
  describeFailure,
  isOpenmapOrigin,
  readStoredSession,
  safeReturnUrl,
  sessionFromUrl,
  initialMapView,
  LITHUANIA_VIEW,
} from "./openmap";

const STYLE = "https://openmap.lt/api/profile-styles/kauno-renginys";
const RETURN = "https://openmap.lt/paskyra/mano-profiliai/kauno-renginys";

describe("isOpenmapOrigin", () => {
  it("accepts https openmap.lt and its subdomains", () => {
    expect(isOpenmapOrigin("https://openmap.lt/x")).toBe(true);
    expect(isOpenmapOrigin("https://tiles.openmap.lt/x")).toBe(true);
  });

  it("rejects lookalikes, other hosts and plain http", () => {
    expect(isOpenmapOrigin("https://openmap.lt.evil.com/x")).toBe(false);
    expect(isOpenmapOrigin("https://notopenmap.lt/x")).toBe(false);
    expect(isOpenmapOrigin("http://openmap.lt/x")).toBe(false);
    expect(isOpenmapOrigin("https://evil.com/?u=openmap.lt")).toBe(false);
    expect(isOpenmapOrigin("not a url")).toBe(false);
  });

  it("accepts a local http server only when allowed", () => {
    expect(isOpenmapOrigin("http://localhost:3300/x")).toBe(false);
    expect(isOpenmapOrigin("http://localhost:3300/x", true)).toBe(true);
    expect(isOpenmapOrigin("http://evil.com/x", true)).toBe(false);
  });
});

describe("safeReturnUrl", () => {
  it("keeps a link on the style's own origin", () => {
    expect(safeReturnUrl(RETURN, STYLE)).toBe(RETURN);
  });

  it("drops other origins, non-http schemes and empty values", () => {
    expect(safeReturnUrl("https://evil.com/phish", STYLE)).toBeNull();
    expect(safeReturnUrl("javascript:alert(1)", STYLE)).toBeNull();
    expect(safeReturnUrl("//evil.com/x", STYLE)).toBeNull();
    expect(safeReturnUrl("https://openmap.lt.evil.com/x", STYLE)).toBeNull();
    expect(safeReturnUrl(null, STYLE)).toBeNull();
    expect(safeReturnUrl("", STYLE)).toBeNull();
  });
});

describe("sessionFromUrl", () => {
  const url = (query: string) => new URL(`https://editor.openmap.lt/?${query}`);

  it("needs both style and token", () => {
    expect(sessionFromUrl(url(`style=${encodeURIComponent(STYLE)}`))).toBeNull();
    expect(sessionFromUrl(url("token=abc"))).toBeNull();
  });

  it("reads the session, with a safe return link", () => {
    const query = `style=${encodeURIComponent(STYLE)}&token=abc.def&return=${encodeURIComponent(RETURN)}`;
    expect(sessionFromUrl(url(query))).toEqual({ styleUrl: STYLE, token: "abc.def", returnUrl: RETURN });
  });

  it("never sends a token to a style that is not on openmap.lt", () => {
    const query = `style=${encodeURIComponent("https://evil.com/s.json")}&token=abc`;
    expect(sessionFromUrl(url(query))).toBeNull();
  });

  it("ignores an unsafe return link but keeps the session", () => {
    const query = `style=${encodeURIComponent(STYLE)}&token=abc&return=${encodeURIComponent("https://evil.com/")}`;
    expect(sessionFromUrl(url(query))?.returnUrl).toBeNull();
  });
});

describe("readStoredSession", () => {
  const storage = (value: string | null) => ({ getItem: () => value });

  it("returns a stored session", () => {
    const session = { styleUrl: STYLE, token: "t", returnUrl: RETURN };
    expect(readStoredSession(storage(JSON.stringify(session)))).toEqual(session);
  });

  it("rejects missing, broken and tampered values", () => {
    expect(readStoredSession(storage(null))).toBeNull();
    expect(readStoredSession(storage("{broken"))).toBeNull();
    expect(readStoredSession(storage(JSON.stringify({ styleUrl: "https://evil.com/s", token: "t", returnUrl: null })))).toBeNull();
    expect(readStoredSession(storage(JSON.stringify({ styleUrl: STYLE })))).toBeNull();
  });
});

describe("describeFailure", () => {
  it("tells the user to restart from openmap.lt when the token is no good", () => {
    expect(describeFailure(401, null).kind).toBe("auth");
    expect(describeFailure(403, { error: "forbidden" }).kind).toBe("auth");
  });

  it("explains rejected styles using the server's detail", () => {
    const bad = describeFailure(400, { error: "forbidden_url", detail: "https://x.example/a.json" });
    expect(bad.kind).toBe("rejected");
    expect(bad.message).toContain("https://x.example/a.json");
    expect(describeFailure(400, { error: "invalid_style", detail: "layers[1].type" }).message).toContain("layers[1].type");
    expect(describeFailure(413, { error: "too_large" }).kind).toBe("rejected");
    expect(describeFailure(400, { error: "bad_version" }).kind).toBe("rejected");
  });

  it("separates network failures and wording for loading", () => {
    expect(describeFailure(null, null).kind).toBe("network");
    expect(describeFailure(500, null, "load").message).toContain("užkrauti");
    expect(describeFailure(500, null, "save").message).toContain("išsaugoti");
  });
});

describe("initialMapView", () => {
  it("starts over Lithuania when the style has no camera", () => {
    expect(initialMapView({})).toEqual(LITHUANIA_VIEW);
    expect(initialMapView({ zoom: 5 })).toEqual(LITHUANIA_VIEW);
  });

  it("uses the style's own camera when it has one", () => {
    expect(initialMapView({ center: [25.3, 54.7], zoom: 11 })).toEqual({ zoom: 11, center: { lng: 25.3, lat: 54.7 } });
  });
});
