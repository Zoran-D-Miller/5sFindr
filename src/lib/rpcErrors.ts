// Maps Postgres exception codes raised by our SECURITY DEFINER functions
// to player-facing messages. Shared across all RPC server actions.
const MESSAGES: Record<string, string> = {
  // join / cancel / manager
  NOT_AUTHED: "Please log in again.",
  NOT_PREMIUM: "Go Premium to do that.",
  NO_MATCH: "This match no longer exists.",
  OWN_MATCH: "You can’t join your own match.",
  NOT_OPEN: "This match isn’t open for joining.",
  STARTED: "This match has already kicked off.",
  ALREADY_IN: "You’re already in this match.",
  NO_TOKEN: "You need an available token. Top up in your wallet.",
  NOT_IN: "You’re not in this match.",
  NOT_ORGANIZER: "Only the organizer can do that.",
  NO_REQUEST: "That request is no longer pending.",
  MATCH_FULL: "The squad is already full.",
  NOT_CANCELLABLE: "This match can no longer be cancelled.",
  TOO_LATE: "Too close to kickoff to delete — message your players via the WhatsApp group instead.",
  // attendance
  TOO_EARLY: "Check-in opens at kickoff.",
  WINDOW_CLOSED: "Check-in has closed for this match.",
  NOT_CONFIRMED: "You need to be an accepted player to check in.",
  NO_GEO: "This venue has no GPS pin — use the 4-digit match code instead.",
  TOO_FAR: "You’re not at the venue yet (must be within 200m).",
  CODE_NOT_SET: "The organizer hasn’t shared a code yet.",
  CODE_EXPIRED: "That match code has expired.",
  BAD_CODE: "That code doesn’t match. Double-check with the organizer.",
  NOT_ENDED: "This match hasn’t ended yet.",
  // motm
  SELF_VOTE: "You can’t vote for yourself.",
  NOT_COMPLETED: "Voting opens once the match is completed.",
  NOT_ATTENDEE: "Only players who showed up can vote.",
  BAD_VOTEE: "You can only vote for someone who attended.",
  ALREADY_VOTED: "You’ve already voted in this match.",
};

export function friendlyRpcError(message: string | undefined): string {
  const code = message?.match(/[A-Z_]{4,}/)?.[0];
  return (code && MESSAGES[code]) || "Something went wrong — please try again.";
}
