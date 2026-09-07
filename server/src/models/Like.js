import mongoose from "mongoose";

const likeSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetType: {
      type: String,
      enum: ["photo", "prompt", "profile"],
      default: "profile",
    },
    targetIndex: { type: Number, default: 0 },
    comment: { type: String, default: null },
    isDove: { type: Boolean, default: false },
  },
  { timestamps: true }
);

likeSchema.index({ from: 1, to: 1 }, { unique: true });
likeSchema.index({ to: 1, createdAt: -1 });

export default mongoose.model("Like", likeSchema);
