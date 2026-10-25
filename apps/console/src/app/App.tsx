import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { AuditPage } from "../features/audit/AuditPage";
import { RequireSession } from "../features/auth/RequireSession";
import { SessionProvider } from "../features/auth/session";
import { SignInPage } from "../features/auth/SignInPage";
import { PilotPage } from "../features/pilot/PilotPage";
import { RunPage } from "../features/run/RunPage";
import { RunDetailPage } from "../features/runs/RunDetailPage";
import { SkillsPage } from "../features/skills/SkillsPage";
import { ApiError } from "../shared/api/client";
import { Shell } from "./Shell";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 10_000, retry: (n, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && n < 2 },
    },
  });
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route element={<RequireSession><Shell /></RequireSession>}>
        <Route index element={<RunPage />} />
        <Route path="runs/:id" element={<RunDetailPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="pilot" element={<RequireSession roles={["people_analytics", "comp_partner", "hr_leadership"]}><PilotPage /></RequireSession>} />
        <Route path="audit" element={<RequireSession roles={["people_analytics"]}><AuditPage /></RequireSession>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App({ client = makeQueryClient() }: { client?: QueryClient }) {
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <SessionProvider>
            <AppRoutes />
          </SessionProvider>
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  );
}
