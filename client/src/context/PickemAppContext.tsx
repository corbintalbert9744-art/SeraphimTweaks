import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  isPickemAppId,
  PICKEM_APP_STORAGE_KEY,
  pickemAppById,
  type PickemAppId,
  type PickemAppSpec,
} from "@/data/pickemApps";

type PickemAppContextValue = {
  appId: PickemAppId | null;
  app: PickemAppSpec | null;
  ready: boolean;
  setAppId: (id: PickemAppId) => void;
  clearApp: () => void;
};

const PickemAppContext = createContext<PickemAppContextValue | null>(null);

function readStoredApp(): PickemAppId | null {
  try {
    const raw = localStorage.getItem(PICKEM_APP_STORAGE_KEY);
    return isPickemAppId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function PickemAppProvider({ children }: { children: ReactNode }) {
  const [appId, setAppIdState] = useState<PickemAppId | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAppIdState(readStoredApp());
    setReady(true);
  }, []);

  const setAppId = useCallback((id: PickemAppId) => {
    setAppIdState(id);
    try {
      localStorage.setItem(PICKEM_APP_STORAGE_KEY, id);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const clearApp = useCallback(() => {
    setAppIdState(null);
    try {
      localStorage.removeItem(PICKEM_APP_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<PickemAppContextValue>(
    () => ({
      appId,
      app: pickemAppById(appId) ?? null,
      ready,
      setAppId,
      clearApp,
    }),
    [appId, ready, setAppId, clearApp],
  );

  return createElement(PickemAppContext.Provider, { value }, children);
}

export function usePickemApp(): PickemAppContextValue {
  const ctx = useContext(PickemAppContext);
  if (!ctx) {
    throw new Error("usePickemApp must be used within PickemAppProvider");
  }
  return ctx;
}
