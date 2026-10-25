import type { AuditEvent, Catalogue, Feedback, PilotSummary, Run, User } from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const TOKEN_KEY = "hsp.token";

/** The session token lives in sessionStorage: it ends with the tab and is never a cookie. */
export const session = {
  get(): string | null {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked: the session lasts until reload */
    }
  },
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  const token = session.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError(0, "The workbench API did not answer.");
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (!res.ok) throw new ApiError(res.status, (Array.isArray(body.message) ? body.message.join("; ") : body.message) || `HTTP ${res.status}`);
  return body as T;
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  demoUsers: () => request<{ users: User[] }>("/api/session/demo-users"),
  demoSignIn: (email: string) => post<{ token: string; user: User }>("/api/session/demo", { email }),
  me: () => request<{ user: User }>("/api/session"),
  signOut: () => request<void>("/api/session", { method: "DELETE" }),
  skills: () => request<Catalogue>("/api/skills"),
  runs: () => request<{ runs: Run[] }>("/api/runs"),
  run: (id: string) => request<Run>(`/api/runs/${id}`),
  startRun: (skill: string, input: Record<string, unknown>) => post<Run>("/api/runs", { skill, input }),
  feedback: (id: string, f: Omit<Feedback, "minutesSaved"> & { minutesSaved?: number }) => post<Run>(`/api/runs/${id}/feedback`, f),
  proposeCase: (id: string, expectedStatus: string, note: string) => post<{ id: string; yaml: string }>(`/api/runs/${id}/case-candidate`, { expectedStatus, note }),
  pilot: () => request<PilotSummary>("/api/pilot/summary"),
  audit: () => request<{ events: AuditEvent[] }>("/api/audit"),
};
