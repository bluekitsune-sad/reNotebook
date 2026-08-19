import { SYNC_STATE } from '@synced-notepad/shared';

const TRANSITIONS = {
  [SYNC_STATE.IDLE]: [SYNC_STATE.CHECKING],
  [SYNC_STATE.CHECKING]: [SYNC_STATE.PULLING, SYNC_STATE.COMPLETED, SYNC_STATE.ERROR],
  [SYNC_STATE.PULLING]: [SYNC_STATE.APPLYING, SYNC_STATE.ERROR],
  [SYNC_STATE.APPLYING]: [SYNC_STATE.PUSHING, SYNC_STATE.COMPLETED, SYNC_STATE.ERROR],
  [SYNC_STATE.PUSHING]: [SYNC_STATE.COMPLETED, SYNC_STATE.ERROR],
  [SYNC_STATE.COMPLETED]: [SYNC_STATE.IDLE],
  [SYNC_STATE.ERROR]: [SYNC_STATE.IDLE, SYNC_STATE.CHECKING],
};

export function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextState(current) {
  const order = [
    SYNC_STATE.IDLE,
    SYNC_STATE.CHECKING,
    SYNC_STATE.PULLING,
    SYNC_STATE.APPLYING,
    SYNC_STATE.PUSHING,
    SYNC_STATE.COMPLETED,
  ];
  const idx = order.indexOf(current);
  if (idx === -1 || idx >= order.length - 1) return SYNC_STATE.IDLE;
  return order[idx + 1];
}
