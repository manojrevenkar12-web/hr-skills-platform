import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MotionConfig } from "framer-motion";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";

import { AppRoutes } from "../app/App";
import { session } from "../shared/api/client";
import { SessionProvider } from "../features/auth/session";

type Handler = (body: unknown) => [number, unknown];

/** A fake API: "METHOD /path" → [status, json]; anything else answers 404 and is recorded. */
export function fakeApi(routes: Record<string, Handler | [number, unknown]>) {
  const calls: { key: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://localhost");
    const key = `${(init.method ?? "GET").toUpperCase()} ${url.pathname}`;
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ key, body });
    const r = routes[key];
    const [status, json] = r === undefined ? [404, { message: `no fake for ${key}` }] : typeof r === "function" ? r(body) : r;
    return new Response(status === 204 ? null : JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  }));
  return calls;
}

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });

export function renderApp(route: string, token: string | null = "t") {
  session.set(token);
  return render(
    <QueryClientProvider client={client()}>
      <MotionConfig reducedMotion="always">
        <MemoryRouter initialEntries={[route]}>
          <SessionProvider>
            <AppRoutes />
          </SessionProvider>
        </MemoryRouter>
      </MotionConfig>
    </QueryClientProvider>,
  );
}

export function renderUi(ui: ReactElement) {
  return render(
    <QueryClientProvider client={client()}>
      <MotionConfig reducedMotion="always">
        <MemoryRouter>{ui}</MemoryRouter>
      </MotionConfig>
    </QueryClientProvider>,
  );
}
