import mongoose from 'mongoose';
const caseSchema = new mongoose.Schema({
 userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, scenario: { type: String, required: true, select: false }, difficulty: { type: String, enum: ['easy','medium','hard'], required: true }, status: { type: String, enum: ['generating','ready','resolved','failed'], default: 'generating' }, progress: { stage: String, percent: Number }, title: String, setting: String, briefing: String,
 suspects: [{ id: String, name: String, age: Number, role: String, relationship: String, appearance: String, bio: String, avatarUrl: String }], evidence: { type: [mongoose.Schema.Types.Mixed], default: [] }, solution: { type: mongoose.Schema.Types.Mixed, select: false }, attempts: [{ suspectId: String, reasoning: String, correct: Boolean, at: Date }], generationMeta: mongoose.Schema.Types.Mixed, resolvedAt: Date
}, { timestamps: true });
caseSchema.index({ userId: 1, createdAt: -1 }); caseSchema.index({ userId: 1, status: 1 });
export const CaseModel = mongoose.model('Case', caseSchema);
