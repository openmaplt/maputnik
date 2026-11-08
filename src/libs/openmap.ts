// openmap.lt integration (fork-only; keep this file and its call sites small so
// syncing with upstream stays easy).
//
// openmap.lt opens the editor as
//   <editor>/?style=<profile style URL>&token=<edit token>&return=<profile page>
// The style URL is `https://openmap.lt/api/profile-styles/<slug>`: GET reads
// the style, PUT saves it, both with `Authorization: Bearer <token>`. The token
// is short-lived and valid for exactly one profile.
import type { StyleSpecification } from "maplibre-gl";
import { ensureStyleValidity } from "./style";
import type { StyleSpecificationWithId } from "./definitions";

export type OpenmapSession = {
  styleUrl: string
  token: string
  // Where "back to openmap.lt" leads; null when it is not safe to link to.
  returnUrl: string | null
};

// What the app tracks while the editor is opened from openmap.lt.
export type OpenmapUiState = {
  session: OpenmapSession
  // The profile's style could not be read: nothing may be saved over it.
  loadError: OpenmapFailure | null
  status: "idle" | "saving" | "saved" | "error"
  // Why the last save failed.
  error: OpenmapFailure | null
  // Edits since the last load or successful save.
  dirty: boolean
};

const SESSION_STORAGE_KEY = "openmap:session";

// The token must only ever be sent to openmap.lt, whatever the URL of the
// editor says. (A local dev server may talk to a local openmap.lt.)
export function isOpenmapOrigin(url: string, allowLocal = false): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === "https:") {
    return parsed.hostname === "openmap.lt" || parsed.hostname.endsWith(".openmap.lt");
  }
  return allowLocal && parsed.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(parsed.hostname);
}

// The back link is only offered when it stays on the same origin as the
// profile's style, so a crafted `return` can't turn the editor into an open
// redirect.
export function safeReturnUrl(returnUrl: string | null, styleUrl: string): string | null {
  if (!returnUrl) {
    return null;
  }
  try {
    const target = new URL(returnUrl);
    const style = new URL(styleUrl);
    if ((target.protocol === "https:" || target.protocol === "http:") && target.origin === style.origin) {
      return target.toString();
    }
  } catch {
    // fall through
  }
  return null;
}

// A session needs both `style` and `token` in the URL, and the style must live
// on openmap.lt. Anything else is a plain Maputnik URL.
export function sessionFromUrl(url: URL, allowLocal = false): OpenmapSession | null {
  const styleUrl = url.searchParams.get("style");
  const token = url.searchParams.get("token");
  if (!styleUrl || !token || !isOpenmapOrigin(styleUrl, allowLocal)) {
    return null;
  }
  return {
    styleUrl,
    token,
    returnUrl: safeReturnUrl(url.searchParams.get("return"), styleUrl),
  };
}

function isSession(value: unknown, allowLocal: boolean): value is OpenmapSession {
  if (!value || typeof value !== "object") {
    return false;
  }
  const session = value as Partial<OpenmapSession>;
  return (
    typeof session.styleUrl === "string" &&
    typeof session.token === "string" &&
    isOpenmapOrigin(session.styleUrl, allowLocal) &&
    (session.returnUrl === null || typeof session.returnUrl === "string")
  );
}

export function readStoredSession(storage: Pick<Storage, "getItem">, allowLocal = false): OpenmapSession | null {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(SESSION_STORAGE_KEY) ?? "null");
    return isSession(parsed, allowLocal) ? parsed : null;
  } catch {
    return null;
  }
}

function storeSession(storage: Pick<Storage, "setItem">, session: OpenmapSession) {
  try {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage may be unavailable; the session then lasts until the tab reloads.
  }
}

// Called once at startup. A URL from openmap.lt starts a session: it is kept in
// sessionStorage (so a reload of the tab still works until the token expires)
// and `token`, `return` and `style` are removed from the address bar so the
// token does not linger in history. With no `style` in the URL a stored session
// from this tab is resumed. A plain `?style=` URL (no token) is left to the
// regular Maputnik flow.
export function startOpenmapSession(): OpenmapSession | null {
  const allowLocal = import.meta.env.DEV;
  const url = new URL(window.location.href);
  const fromUrl = sessionFromUrl(url, allowLocal);
  if (fromUrl) {
    storeSession(window.sessionStorage, fromUrl);
    for (const name of ["style", "token", "return"]) {
      url.searchParams.delete(name);
    }
    window.history.replaceState({}, document.title, url.toString());
    return fromUrl;
  }
  if (!url.searchParams.get("style")) {
    return readStoredSession(window.sessionStorage, allowLocal);
  }
  return null;
}

type FailureBody = { error?: string, detail?: string };

export type OpenmapFailure = {
  // `auth` means the token is no longer good: the user has to start again from
  // openmap.lt.
  kind: "auth" | "network" | "rejected" | "other"
  message: string
};

// Turns the API's `{error, detail}` answers into text for the user.
export function describeFailure(
  status: number | null,
  body: FailureBody | null,
  action: "save" | "load" = "save",
): OpenmapFailure {
  if (status === null) {
    return { kind: "network", message: "Nepavyko susisiekti su openmap.lt. Patikrinkite ryšį ir bandykite dar kartą." };
  }
  if (status === 401 || status === 403) {
    return {
      kind: "auth",
      message: "Redagavimo sesija baigėsi arba netinka šiam profiliui. Grįžkite į openmap.lt ir dar kartą spauskite „Keisti stilių“.",
    };
  }
  if (status === 404) {
    return { kind: "other", message: "Profilis nerastas (galbūt ištrintas)." };
  }
  if (status === 413 || body?.error === "too_large") {
    return { kind: "rejected", message: "Stilius per didelis: ribojama iki 1 MB." };
  }
  if (status === 429) {
    return { kind: "other", message: "Per daug bandymų, palaukite kelias sekundes ir bandykite dar kartą." };
  }
  if (body?.error === "forbidden_url") {
    return {
      kind: "rejected",
      message: `Stilius naudoja neleidžiamą adresą${body.detail ? ` (${body.detail})` : ""}. Leidžiami tik openmap.lt adresai.`,
    };
  }
  if (body?.error === "invalid_style") {
    return { kind: "rejected", message: `Stilius neteisingas${body.detail ? `: ${body.detail}` : ""}.` };
  }
  if (body?.error === "bad_version") {
    return { kind: "rejected", message: "Stiliaus „version“ turi būti 8." };
  }
  return {
    kind: "other",
    message: `Nepavyko ${action === "save" ? "išsaugoti stiliaus" : "užkrauti stiliaus"} (klaida ${status}).`,
  };
}

async function readBody(response: Response): Promise<FailureBody | null> {
  try {
    return (await response.json()) as FailureBody;
  } catch {
    return null;
  }
}

function authHeaders(session: OpenmapSession): Record<string, string> {
  return { Authorization: `Bearer ${session.token}` };
}

export class OpenmapLoadError extends Error {
  failure: OpenmapFailure;
  constructor(failure: OpenmapFailure) {
    super(failure.message);
    this.failure = failure;
  }
}

// Reads the profile's current style from the server. Never falls back to an
// empty style: saving that over the profile would wipe it.
export async function loadOpenmapStyle(session: OpenmapSession): Promise<StyleSpecificationWithId> {
  let response: Response;
  try {
    response = await fetch(session.styleUrl, {
      mode: "cors",
      // The server caches visible profiles briefly; the editor needs the latest.
      cache: "no-store",
      headers: authHeaders(session),
    });
  } catch {
    throw new OpenmapLoadError(describeFailure(null, null));
  }
  if (!response.ok) {
    throw new OpenmapLoadError(describeFailure(response.status, await readBody(response), "load"));
  }
  const body = (await response.json()) as StyleSpecification;
  return ensureStyleValidity(body);
}

export type SaveResult = { ok: true } | ({ ok: false } & OpenmapFailure);

// Saves the style to openmap.lt. Only ever called for an explicit save.
export async function saveOpenmapStyle(session: OpenmapSession, style: StyleSpecification): Promise<SaveResult> {
  let response: Response;
  try {
    response = await fetch(session.styleUrl, {
      method: "PUT",
      mode: "cors",
      headers: { ...authHeaders(session), "Content-Type": "application/json" },
      body: JSON.stringify(style),
    });
  } catch {
    return { ok: false, ...describeFailure(null, null) };
  }
  if (response.ok) {
    return { ok: true };
  }
  return { ok: false, ...describeFailure(response.status, await readBody(response)) };
}
