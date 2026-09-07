import { Router } from "express";
import { body, validationResult } from "express-validator";
import auth from "../middleware/auth.js";
import Like from "../models/Like.js";
import Match from "../models/Match.js";
import Skip from "../models/Skip.js";
import User from "../models/User.js";

const router = Router();

// Send a like
router.post(
  "/",
  auth,
  [
    body("to").isMongoId(),
    body("targetType").optional().isIn(["photo", "prompt", "profile"]),
    body("targetIndex").optional().isInt({ min: 0 }),
    body("comment").optional().isString().isLength({ max: 300 }),
    body("isDove").optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { to, targetType, targetIndex, comment, isDove } = req.body;

      if (to === req.user._id.toString()) {
        return res.status(400).json({ error: "Cannot like yourself" });
      }

      if (isDove && req.user.doves <= 0) {
        return res.status(400).json({ error: "No doves remaining" });
      }

      const existing = await Like.findOne({ from: req.user._id, to });
      if (existing) {
        return res.status(409).json({ error: "Already liked" });
      }

      const like = await Like.create({
        from: req.user._id,
        to,
        targetType: targetType || "profile",
        targetIndex: targetIndex || 0,
        comment: comment || null,
        isDove: isDove || false,
      });

      if (isDove) {
        req.user.doves -= 1;
        await req.user.save({ validateBeforeSave: false });
      }

      // Check for mutual like → match
      const mutual = await Like.findOne({ from: to, to: req.user._id });
      let match = null;

      if (mutual) {
        match = await Match.create({
          users: [req.user._id, to],
        });

        // Emit match event via socket if available
        const io = req.app.get("io");
        if (io) {
          const matchedUser = await User.findById(to);
          io.to(to.toString()).emit("match", {
            matchId: match._id,
            user: req.user.toProfile(),
          });
          io.to(req.user._id.toString()).emit("match", {
            matchId: match._id,
            user: matchedUser.toProfile(),
          });
        }
      }

      // Emit like event to recipient
      const io = req.app.get("io");
      if (io) {
        io.to(to.toString()).emit("like_received", {
          from: req.user.toProfile(),
          targetType: like.targetType,
          targetIndex: like.targetIndex,
          comment: like.comment,
          isDove: like.isDove,
        });
      }

      res.status(201).json({
        like,
        matched: !!match,
        matchId: match?._id || null,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Get likes received
router.get("/received", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    // Exclude people already matched with
    const matchedUserIds = await Match.find({
      users: req.user._id,
    }).distinct("users");

    const likes = await Like.find({
      to: req.user._id,
      from: { $nin: matchedUserIds },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("from", "-password -email -filters -__v");

    const total = await Like.countDocuments({
      to: req.user._id,
      from: { $nin: matchedUserIds },
    });

    res.json({
      likes,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Skip a profile
router.post(
  "/skip",
  auth,
  [body("to").isMongoId()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      await Skip.findOneAndUpdate(
        { from: req.user._id, to: req.body.to },
        { from: req.user._id, to: req.body.to },
        { upsert: true }
      );
      res.json({ skipped: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Dismiss a like (remove from received)
router.delete("/:likeId", auth, async (req, res) => {
  try {
    const like = await Like.findOneAndDelete({
      _id: req.params.likeId,
      to: req.user._id,
    });
    if (!like) return res.status(404).json({ error: "Like not found" });

    // Also skip them so they don't reappear
    await Skip.findOneAndUpdate(
      { from: req.user._id, to: like.from },
      { from: req.user._id, to: like.from },
      { upsert: true }
    );

    res.json({ dismissed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
