import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const promptSchema = new mongoose.Schema(
  { prompt: String, answer: String },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 18, max: 99 },
    height: { type: Number, min: 100, max: 250 },
    gender: { type: String, enum: ["male", "female"], required: true },
    denomination: { type: String, required: true },
    job: { type: String, default: "" },
    school: { type: String, default: "" },
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
      city: { type: String, default: "" },
    },
    photos: [String],
    prompts: [promptSchema],
    interests: [String],
    bio: { type: String, default: "" },
    filters: {
      maxAge: { type: Number, default: 35 },
      minAge: { type: Number, default: 18 },
      maxDistance: { type: Number, default: 80 },
      denomination: { type: String, default: "" },
    },
    doves: { type: Number, default: 3 },
    lastActive: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ location: "2dsphere" });
userSchema.index({ gender: 1, age: 1 });
userSchema.index({ isActive: 1, lastActive: -1 });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toProfile = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.email;
  delete obj.filters;
  delete obj.__v;
  return obj;
};

export default mongoose.model("User", userSchema);
