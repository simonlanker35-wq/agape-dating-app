import mongoose from "mongoose";

const skipSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

skipSchema.index({ from: 1, to: 1 }, { unique: true });

export default mongoose.model("Skip", skipSchema);
