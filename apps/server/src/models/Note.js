import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  folder: { type: String, default: '' },
  status: { type: String, enum: ['active', 'deleted'], default: 'active' },
  currentRevision: { type: Number, default: 0 },
  createdByDevice: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date },
});

noteSchema.index({ workspaceId: 1, updatedAt: 1 });
noteSchema.index({ workspaceId: 1, id: 1 });

noteSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Note', noteSchema);
