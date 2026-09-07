import { Router } from "express";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import auth from "../middleware/auth.js";
import upload from "../middleware/upload.js";
import config from "../config.js";

const router = Router();

router.get("/", auth, (req, res) => {
  res.json({ profile: req.user.toProfile() });
});

router.patch("/", auth, async (req, res) => {
  const allowed = [
    "name",
    "age",
    "height",
    "denomination",
    "job",
    "school",
    "location",
    "prompts",
    "interests",
    "bio",
    "filters",
  ];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  try {
    Object.assign(req.user, updates);
    await req.user.save();
    res.json({ profile: req.user.toProfile() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post(
  "/photos",
  auth,
  upload.single("photo"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No valid image file" });
    }
    if (req.user.photos.length >= 6) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: "Maximum 6 photos" });
    }

    try {
      const filename = `opt_${req.file.filename}`;
      const outputPath = path.join(config.upload.dir, filename);

      await sharp(req.file.path)
        .resize(1080, 1440, { fit: "cover" })
        .jpeg({ quality: 85 })
        .toFile(outputPath);

      await fs.unlink(req.file.path);

      const photoUrl = `/uploads/${filename}`;
      req.user.photos.push(photoUrl);
      await req.user.save();

      res.json({ photo: photoUrl, photos: req.user.photos });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.delete("/photos/:index", auth, async (req, res) => {
  const idx = parseInt(req.params.index);
  if (idx < 0 || idx >= req.user.photos.length) {
    return res.status(400).json({ error: "Invalid photo index" });
  }

  const photoPath = path.join(".", req.user.photos[idx]);
  req.user.photos.splice(idx, 1);
  await req.user.save();

  try {
    await fs.unlink(photoPath);
  } catch {
    // file already gone
  }

  res.json({ photos: req.user.photos });
});

export default router;
