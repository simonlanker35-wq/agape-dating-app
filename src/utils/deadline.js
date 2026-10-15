// The planning clock of a chat. After the first real message he has five days to plan a date.
// A rose adds 36 hours. A planned video call pauses the clock until two hours after the call and
// then gives five fresh days. An open or confirmed plan pauses it. A declined plan restarts it
// after a 48-hour cooling-off period; a cancelled plan restarts it right away.
import { isCancelledInvite } from "../services/api";

export const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
export const NUDGE_BONUS = 36 * 60 * 60 * 1000;
export const COOLDOWN_48H = 48 * 60 * 60 * 1000;
export const CALL_GRACE = 2 * 60 * 60 * 1000;

export function computeDeadline({ messages, match, dateInvitations, confirmedDate, openInvite, videoCallStarted = false, nudgeSent = false, now = Date.now() }) {
  // The clock starts with the first real message, not with a like comment sent before the match
  const firstMessageTime = (messages || []).find((msg) => !msg.isComment)?.timestamp ?? null;
  const deadlinePaused = !!match?.deadlinePaused;
  const callAt = match?.videoCallAt || null;
  const hasVideoCall = videoCallStarted || (!!callAt && now < callAt + CALL_GRACE);
  const timerStopped = deadlinePaused || hasVideoCall || !!confirmedDate || !!openInvite;

  const lastClosed = (dateInvitations || [])
    .filter((inv) => inv.status === "declined")
    .sort((x, y) => new Date(y.created_at) - new Date(x.created_at))[0] || null;
  const lastClosedAt = lastClosed ? new Date(lastClosed.created_at).getTime() : null;
  const lastClosedCooldown = lastClosed && !isCancelledInvite(lastClosed) ? COOLDOWN_48H : 0;

  let deadlineMs = null;
  if (!timerStopped && firstMessageTime) {
    deadlineMs = firstMessageTime + FIVE_DAYS;
    if (lastClosedAt) deadlineMs = Math.max(deadlineMs, lastClosedAt + lastClosedCooldown + FIVE_DAYS);
    if (callAt && !hasVideoCall) deadlineMs = Math.max(deadlineMs, callAt + CALL_GRACE + FIVE_DAYS);
    if (nudgeSent || match?.nudgeAt) deadlineMs += NUDGE_BONUS;
  }
  const timeLeftMs = deadlineMs ? deadlineMs - now : null;
  const chatLocked = !timerStopped && timeLeftMs !== null && timeLeftMs <= 0;

  return { firstMessageTime, deadlinePaused, callAt, hasVideoCall, timerStopped, deadlineMs, timeLeftMs, chatLocked };
}
