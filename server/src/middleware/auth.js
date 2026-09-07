import jwt from "jsonwebtoken";
import config from "../config.js";
import User from "../models/User.js";

export default async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(header.split(" ")[1], config.jwt.secret);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found" });
    }
    user.lastActive = new Date();
    await user.save({ validateBeforeSave: false });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
