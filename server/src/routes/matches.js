import { Router } from "express";
import auth from "../middleware/auth.js";
import Match from "../models/Match.js";
import Message from "../models/Message.js";

const router = Router();

// Get all matches
router.get("/", auth, async (req, res) => {
  try {
    const matches = await Match.find({ users: req.user._id })
      .sort({ lastActivity: -1 })
      .populate("users", "-password -email -filters -__v")
      .populate("lastMessage");

    const formatted = matches.map((m) => {
      const other = m.users.find(
        (u) => u._id.toString() !== req.user._id.toString()
      );
      return {
        _id: m._id,
        user: other,
        lastMessage: m.lastMessage,
        lastActivity: m.lastActivity,
        createdAt: m.createdAt,
      };
    });

    res.json({ matches: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get messages for a match
router.get("/:matchId/messages", auth, async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
    });
    if (!match) return res.status(404).json({ error: "Match not found" });

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = (page - 1) * limit;

    const messages = await Message.find({ match: match._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Mark unread messages as read
    await Message.updateMany(
      { match: match._id, sender: { $ne: req.user._id }, read: false },
      { read: true }
    );

    res.json({ messages: messages.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a message (REST fallback — prefer Socket.io)
router.post("/:matchId/messages", auth, async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
    });
    if (!match) return res.status(404).json({ error: "Match not found" });

    const text = req.body.text?.trim();
    if (!text) return res.status(400).json({ error: "Message text required" });

    const message = await Message.create({
      match: match._id,
      sender: req.user._id,
      text,
    });

    match.lastMessage = message._id;
    match.lastActivity = new Date();
    await match.save();

    const io = req.app.get("io");
    if (io) {
      const recipientId = match.users.find(
        (u) => u.toString() !== req.user._id.toString()
      );
      io.to(recipientId.toString()).emit("message", {
        matchId: match._id,
        message: {
          ...message.toObject(),
          sender: req.user.toProfile(),
        },
      });
    }

    res.status(201).json({ message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unmatch
router.delete("/:matchId", auth, async (req, res) => {
  try {
    const match = await Match.findOneAndDelete({
      _id: req.params.matchId,
      users: req.user._id,
    });
    if (!match) return res.status(404).json({ error: "Match not found" });

    await Message.deleteMany({ match: match._id });

    res.json({ unmatched: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
