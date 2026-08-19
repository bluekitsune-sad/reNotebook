import mongoose from 'mongoose';

const pairingSessionSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  ownerDeviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
  pairingToken: { type: String, required: true, unique: true },
  verificationCode: { type: String },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired', 'used'], default: 'pending' },
  newDeviceName: { type: String },
  newDeviceType: { type: String, enum: ['web', 'mobile', 'desktop'] },
  newDeviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

pairingSessionSchema.index({ pairingToken: 1, expiresAt: 1 });
pairingSessionSchema.index({ workspaceId: 1, status: 1 });

export default mongoose.model('PairingSession', pairingSessionSchema);
