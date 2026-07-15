import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { BuilderLeg } from "@/data/builderTypes";

interface ParlayDraftContextValue {
  legs: BuilderLeg[];
  addLeg: (prop: BuilderLeg) => void;
  removeLeg: (id: string) => void;
  hasLeg: (id: string) => boolean;
  clear: () => void;
}

const ParlayDraftContext = createContext<ParlayDraftContextValue | null>(null);

export function ParlayDraftProvider({ children }: { children: ReactNode }) {
  const [legs, setLegs] = useState<BuilderLeg[]>([]);

  const value = useMemo<ParlayDraftContextValue>(
    () => ({
      legs,
      addLeg: (prop) => {
        setLegs((prev) => (prev.some((l) => l.id === prop.id) ? prev : [...prev, prop]));
      },
      removeLeg: (id) => setLegs((prev) => prev.filter((l) => l.id !== id)),
      hasLeg: (id) => legs.some((l) => l.id === id),
      clear: () => setLegs([]),
    }),
    [legs],
  );

  return <ParlayDraftContext.Provider value={value}>{children}</ParlayDraftContext.Provider>;
}

export function useParlayDraft() {
  const ctx = useContext(ParlayDraftContext);
  if (!ctx) {
    throw new Error("useParlayDraft must be used within ParlayDraftProvider");
  }
  return ctx;
}
