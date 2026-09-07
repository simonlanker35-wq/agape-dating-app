import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "fs";
import config from "./config.js";
import { setupSocket } from "./socket.js";

import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import discoverRoutes from "./routes/discover.js";
import likesRoutes from "./routes/likes.js";
import matchesRoutes from "./routes/matches.js";

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.clientUrl,
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: "10mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Ensure upload directory exists
if (!fs.existsSync(config.upload.dir)) {
  fs.mkdirSync(config.upload.dir, { recursive: true });
}
app.use("/uploads", express.static(config.upload.dir));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/discover", discoverRoutes);
app.use("/api/likes", likesRoutes);
app.use("/api/matches", matchesRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Socket.io
setupSocket(io);

// Error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Server error" : err.message,
  });
});

// Connect & start
mongoose
  .connect(config.mongoUri)
  .then(() => {
    console.log("MongoDB connected");
    server.listen(config.port, () => {
      console.log(`Agape API running on port ${config.port}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });
