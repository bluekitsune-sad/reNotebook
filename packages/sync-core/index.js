export { SyncEngine } from './engine.js';
export {
  validateNotesRepository,
  validateChangesRepository,
  validateRevisionsRepository,
  validateSyncStateRepository,
  validateRepositories,
} from './repository-interface.js';
export { withRetry, isRetryableError, computeDelay } from './retry.js';
export { createChange, isDuplicateChange } from './changes/index.js';
export { detectConflict, classifyConflict } from './conflicts/index.js';
export { threeWayMerge, mergeTextContent } from './merge/index.js';
export { parseCursor, encodeCursor } from './cursor/index.js';
export { canTransition, nextState } from './state-machine/index.js';
