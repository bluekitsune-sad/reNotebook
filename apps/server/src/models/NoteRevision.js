import mongoose from 'mongoose';

const noteRevisionSchema = new mongoose.Schema({
  noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  revision: { type: Number, required: true },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  folder: { type: String, default: '' },
  createdByDevice: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
  createdAt: { type: Date, default: Date.now },
});

noteRevisionSchema.index({ noteId: 1, revision: 1 });
noteRevisionSchema.index({ workspaceId: 1 });

export default mongoose.model('NoteRevision', noteRevisionSchema);
