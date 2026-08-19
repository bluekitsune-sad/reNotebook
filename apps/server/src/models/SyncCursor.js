import mongoose from 'mongoose';

const syncCursorSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  lastServerSequence: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
});

syncCursorSchema.index({ workspaceId: 1, deviceId: 1 }, { unique: true });

export default mongoose.model('SyncCursor', syncCursorSchema);
