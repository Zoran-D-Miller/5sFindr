// Pre-launch: signed-out visitors only get the waitlist. On unless
// PRELAUNCH=false, so a missing env var can't expose the app by accident.
export const PRELAUNCH = process.env.PRELAUNCH !== "false";
