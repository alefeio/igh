export function isDirectorDashboardV2Enabled(): boolean {
  return process.env.DIRECTOR_DASHBOARD_V2_ENABLED === "true";
}
