import mongoose from 'mongoose';

const conflictSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true },
  changeIdA: { type: mongoose.Schema.Types.ObjectId, ref: 'Change', required: true },
  changeIdB: { type: mongoose.Schema.Types.ObjectId, ref: 'Change', required: true },
  deviceA: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  deviceB: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  status: { type: String, enum: ['pending', 'resolved'], default: 'pending' },
  resolution: { type: String, enum: ['keep_version', 'merge', 'keep_both'] },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  resolvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

conflictSchema.index({ workspaceId: 1, status: 1 });

export default mongoose.model('Conflict', conflictSchema);
