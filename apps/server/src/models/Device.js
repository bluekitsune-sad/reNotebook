import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['web', 'mobile', 'desktop'], required: true },
  status: { type: String, enum: ['pending', 'active', 'revoked'], default: 'pending' },
  deviceFingerprint: { type: String, required: true },
  sessionToken: { type: String },
  lastSyncAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

deviceSchema.index({ workspaceId: 1, status: 1 });

deviceSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Device', deviceSchema);
