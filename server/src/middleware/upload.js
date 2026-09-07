import multer from "multer";
import path from "path";
import crypto from "crypto";
import config from "../config.js";

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.upload.dir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  cb(null, allowed.includes(file.mimetype));
};

export default multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxSize },
});
