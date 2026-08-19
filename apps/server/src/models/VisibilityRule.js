import mongoose from 'mongoose';

const visibilityRuleSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  visible: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

visibilityRuleSchema.index({ noteId: 1, deviceId: 1 }, { unique: true });
visibilityRuleSchema.index({ workspaceId: 1 });

export default mongoose.model('VisibilityRule', visibilityRuleSchema);
