import "dotenv/config";

export default {
  port: parseInt(process.env.PORT || "3001"),
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/agape",
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  },
  upload: {
    dir: process.env.UPLOAD_DIR || "uploads",
    maxSize: parseInt(process.env.MAX_FILE_SIZE || "5242880"),
  },
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
};
