// Show-up rate (S4): games played / (played + missed). Played = the
// organiser ticked them (or settled a game where nobody was ticked); missed =
// no-show or a late drop-out (<12h). Spots freed for not confirming don't
// count. Same number as profiles.reliability_score.
export function showUp(played: number, missed: number) {
  const total = played + missed;
  if (total === 0) return { pct: null as number | null, label: "New player", detail: "No games yet" };
  const pct = Math.round((100 * played) / total);
  return { pct, label: `${pct}%`, detail: `Showed up ${played} of ${total} game${total === 1 ? "" : "s"}` };
}
