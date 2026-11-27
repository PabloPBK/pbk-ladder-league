export function isFrontDesk(user: { app_metadata: Record<string, unknown> } | null | undefined) {
  return user?.app_metadata.operations_role === "front_desk";
}

export function isFrontDeskWorkspace(path: string) {
  return [
    "/", "/leagues", "/admin", "/admin/scores", "/admin/tv-manager/rosters",
    "/walking", "/history", "/live", "/tv", "/display",
  ].includes(path) || path.startsWith("/history/");
}

const eventRead = /^\/api\/events\/[^/]+\/(?:current-round|match-center|prize-money|rounds\/\d+)$/;
const eventWrite = /^\/api\/events\/[^/]+\/(?:complete|tv|courts\/\d+\/(?:pairing|score)|rounds\/(?:next|regenerate-after|1\/swap-players))$/;
const rosterApi = /^\/api\/roster-(?:events|import|logo|players|teams)$/;

export function isFrontDeskApi(path: string, method: string) {
  if (method === "GET" || method === "HEAD") {
    return [
      "/api/league-directory", "/api/league-events", "/api/league-events/active", "/api/league-events/schedule",
      "/api/seasons", "/api/players", "/api/history", "/api/standings",
      "/api/facility-branding", "/api/tv-player", "/api/tv-refresh", "/api/tv-screens",
    ].includes(path) || eventRead.test(path) || rosterApi.test(path)
      || /^\/api\/history\/[^/]+(?:\/dupr-export)?$/.test(path);
  }

  if (method === "POST" && [
    "/api/league-events", "/api/rounds/first", "/api/players/import",
  ].includes(path)) return true;

  if (method === "DELETE") {
    return /^\/api\/events\/[^/]+\/courts\/\d+\/pairing$/.test(path)
      || path === "/api/roster-players" || path === "/api/roster-teams";
  }

  return (method === "POST" || method === "PATCH") && (eventWrite.test(path) || rosterApi.test(path));
}
