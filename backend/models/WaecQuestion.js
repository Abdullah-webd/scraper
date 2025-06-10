import mongoose from "mongoose";

const waecQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  options: [{
    type: String,
    trim: true
  }],
  answer: {
    type: String,
    default: "N/A",
    trim: true
  },
  explanation: {
    type: String,
    default: "No explanation available",
    trim: true
  },
  examType: {
    type: String,
    enum: ["WAEC", "NECO", "JAMB"],
    default: "WAEC"
  },
  year: {
    type: String,
    default: "Unknown"
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  questionType: {
    type: String,
    enum: ["objective", "theory", "practical"],
    required: true
  },
  detailLink: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
waecQuestionSchema.index({ subject: 1, examType: 1, year: 1 });
waecQuestionSchema.index({ questionType: 1 });

export const WaecQuestion = mongoose.model("WaecQuestion", waecQuestionSchema);