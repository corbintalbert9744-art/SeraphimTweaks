/** No-vig great picks + in-app notification helpers (OddsIQ-style). */

const SEEN_KEY = "seraphim.novig.seen";
const PREFS_KEY = "seraphim.notifications.enabled";

export type NoVigPick = {
  id: string;
  player: string;
  market: string;
  side: string;
  line: number;
  league?: string;
  team?: string;
  opponent?: string;
  noVigProb?: number;
  noVigPct?: number;
  noVigEdgePct?: number;
  evPercent?: number;
  researchScore?: number;
  confidence?: number;
};

export type AppNotification = {
  id: string;
  kind?: string;
  tone?: "line" | "injury" | "research" | "system";
  title: string;
  detail: string;
  propId?: string | null;
  league?: string;
  noVigEdgePct?: number;
  createdAt?: string;
};

export function leanNoVigPct(pick: NoVigPick): number {
  if (pick.noVigPct != null && Number.isFinite(pick.noVigPct)) return pick.noVigPct;
  const p = Number(pick.noVigProb ?? 0);
  return Math.round(p * 100);
}

export function noVigEdgePct(pick: NoVigPick): number {
  if (pick.noVigEdgePct != null && Number.isFinite(pick.noVigEdgePct)) return pick.noVigEdgePct;
  return Math.max(0, leanNoVigPct(pick) - 50);
}

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(ids).slice(-80)));
  } catch {
    /* ignore */
  }
}

export function notificationsEnabled(): boolean {
  try {
    const v = localStorage.getItem(PREFS_KEY);
    return v !== "0";
  } catch {
    return true;
  }
}

export function setNotificationsEnabled(on: boolean) {
  try {
    localStorage.setItem(PREFS_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Return newly seen strong no-vig notifications and mark them seen. */
export function takeNewNotifications(items: AppNotification[]): AppNotification[] {
  if (!notificationsEnabled()) return [];
  const seen = readSeen();
  const fresh = items.filter((n) => n.id && !seen.has(n.id));
  for (const n of fresh) seen.add(n.id);
  if (fresh.length) writeSeen(seen);
  return fresh;
}

export function markNotificationsSeen(items: AppNotification[]) {
  const seen = readSeen();
  for (const n of items) if (n.id) seen.add(n.id);
  writeSeen(seen);
}

export function loadSeenIds(): Set<string> {
  return readSeen();
}

export function isAlertUnread(id: string, seen?: Set<string>): boolean {
  const s = seen ?? readSeen();
  return Boolean(id) && !s.has(id);
}

export function markAlertSeen(id: string) {
  if (!id) return;
  const seen = readSeen();
  seen.add(id);
  writeSeen(seen);
}

export async function maybeDesktopNotify(n: AppNotification) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (!notificationsEnabled()) return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      return;
    }
  }
  if (Notification.permission !== "granted") return;
  try {
    new Notification(n.title, {
      body: n.detail,
      tag: n.id,
    });
  } catch {
    /* ignore */
  }
}
