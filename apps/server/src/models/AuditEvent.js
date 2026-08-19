import mongoose from 'mongoose';

const auditEventSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  eventType: {
    type: String,
    enum: [
      'note.created', 'note.updated', 'note.deleted', 'note.restored',
      'device.paired', 'device.revoked',
      'note.visibility_changed', 'conflict.created', 'conflict.resolved',
    ],
    required: true,
  },
  noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note' },
  revision: { type: Number },
  details: { type: mongoose.Schema.Types.Mixed },
  serverTimestamp: { type: Date, default: Date.now },
});

auditEventSchema.index({ workspaceId: 1, serverTimestamp: -1 });
auditEventSchema.index({ noteId: 1 });

export default mongoose.model('AuditEvent', auditEventSchema);
