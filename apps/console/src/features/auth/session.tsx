import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, ApiError, session } from "../../shared/api/client";
import { keys } from "../../shared/api/queries";
import type { User } from "../../shared/api/types";

interface SessionValue {
  user: User | null;
  checking: boolean;
  signIn: (email: string) => Promise<User>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [hasToken, setHasToken] = useState(() => session.get() !== null);
  const me = useQuery({ queryKey: keys.me, queryFn: api.me, enabled: hasToken, retry: false });
  const expired = me.error instanceof ApiError && me.error.status === 401;

  useEffect(() => {
    if (!expired) return;
    session.set(null);
    setHasToken(false);
  }, [expired]);

  const signIn = useCallback(
    async (email: string) => {
      const { token, user } = await api.demoSignIn(email);
      session.set(token);
      qc.setQueryData(keys.me, { user });
      setHasToken(true);
      return user;
    },
    [qc],
  );

  const signOut = useCallback(async () => {
    await api.signOut().catch(() => undefined);
    session.set(null);
    setHasToken(false);
    qc.clear();
  }, [qc]);

  const value = useMemo<SessionValue>(
    () => ({ user: hasToken ? (me.data?.user ?? null) : null, checking: hasToken && me.isPending, signIn, signOut }),
    [hasToken, me.data, me.isPending, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}
