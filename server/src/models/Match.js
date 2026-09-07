import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
  {
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    lastActivity: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

matchSchema.index({ users: 1 });
matchSchema.index({ lastActivity: -1 });

export default mongoose.model("Match", matchSchema);
