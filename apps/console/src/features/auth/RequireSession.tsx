import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import type { Role } from "../../shared/api/types";
import { Skeleton } from "../../shared/ui/states";
import { useSession } from "./session";

export function RequireSession({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, checking } = useSession();
  const location = useLocation();
  if (checking) return <Skeleton lines={4} label="Checking your session" />;
  if (!user) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
