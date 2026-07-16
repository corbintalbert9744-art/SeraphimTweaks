/** Stable hrefs for player research pages (IDs may contain `:`). */

export function playerProfilePath(playerId: string | null | undefined): string {
  const id = String(playerId || "").trim();
  if (!id) return "/players";
  return `/player/${encodeURIComponent(id)}`;
}

export function decodePlayerRouteId(raw: string | null | undefined): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Prefer a short provider id over warehouse stub keys for URLs. */
export function preferredPlayerLinkId(row: {
  playerId?: string | null;
  playerExternalId?: string | null;
  playerWarehouseId?: string | null;
  id?: string | null;
}): string {
  const ext = String(row.playerExternalId || "").trim();
  if (ext && !ext.startsWith("pickem:")) return ext;
  const pid = String(row.playerId || "").trim();
  if (pid && !pid.startsWith("pickem:") && !pid.includes(":pickem:")) return pid;
  return (
    String(row.playerWarehouseId || "").trim() ||
    pid ||
    String(row.id || "").trim()
  );
}
