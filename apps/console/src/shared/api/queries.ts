import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { Feedback } from "./types";

export const keys = {
  me: ["me"] as const,
  skills: ["skills"] as const,
  runs: ["runs"] as const,
  run: (id: string) => ["run", id] as const,
  pilot: ["pilot"] as const,
  audit: ["audit"] as const,
};

export const useSkills = () => useQuery({ queryKey: keys.skills, queryFn: api.skills });
export const useRuns = () => useQuery({ queryKey: keys.runs, queryFn: api.runs });
export const usePilot = () => useQuery({ queryKey: keys.pilot, queryFn: api.pilot });
export const useAudit = () => useQuery({ queryKey: keys.audit, queryFn: api.audit });

/** A run is polled while the worker has it. */
export const useRun = (id: string) =>
  useQuery({
    queryKey: keys.run(id),
    queryFn: () => api.run(id),
    refetchInterval: (q) => (q.state.data && (q.state.data.status === "queued" || q.state.data.status === "running") ? 700 : false),
  });

export function useStartRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ skill, input }: { skill: string; input: Record<string, unknown> }) => api.startRun(skill, input),
    onSuccess: (run) => {
      qc.setQueryData(keys.run(run.id), run);
      void qc.invalidateQueries({ queryKey: keys.runs });
    },
  });
}

export function useFeedback(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: Omit<Feedback, "minutesSaved"> & { minutesSaved?: number }) => api.feedback(id, f),
    onSuccess: (run) => qc.setQueryData(keys.run(id), run),
  });
}

export const useProposeCase = (id: string) => useMutation({ mutationFn: ({ expectedStatus, note }: { expectedStatus: string; note: string }) => api.proposeCase(id, expectedStatus, note) });
