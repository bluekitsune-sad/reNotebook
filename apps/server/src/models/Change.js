import mongoose from 'mongoose';

const changeSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true },
  type: {
    type: String,
    enum: ['note.created', 'note.updated', 'note.deleted', 'note.restored', 'note.visibility_changed'],
    required: true,
  },
  baseRevision: { type: Number, required: true },
  serverSequence: { type: Number },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['pending', 'accepted', 'conflict', 'rejected'], default: 'pending' },
  conflictId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conflict' },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
});

changeSchema.index({ workspaceId: 1, serverSequence: 1 });
changeSchema.index({ deviceId: 1, status: 1 });
changeSchema.index({ noteId: 1 });

export default mongoose.model('Change', changeSchema);
