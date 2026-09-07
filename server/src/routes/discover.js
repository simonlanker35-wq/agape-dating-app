import { Router } from "express";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import Like from "../models/Like.js";
import Skip from "../models/Skip.js";

const router = Router();

router.get("/", auth, async (req, res) => {
  try {
    const user = req.user;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    const [likedIds, skippedIds] = await Promise.all([
      Like.find({ from: user._id }).distinct("to"),
      Skip.find({ from: user._id }).distinct("to"),
    ]);

    const excludeIds = [...likedIds, ...skippedIds, user._id];

    const targetGender = user.gender === "male" ? "female" : "male";

    const query = {
      _id: { $nin: excludeIds },
      gender: targetGender,
      isActive: true,
      age: {
        $gte: user.filters.minAge || 18,
        $lte: user.filters.maxAge || 50,
      },
    };

    if (
      user.location?.coordinates?.[0] &&
      user.location?.coordinates?.[1] &&
      user.filters.maxDistance
    ) {
      query.location = {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: user.location.coordinates,
          },
          $maxDistance: user.filters.maxDistance * 1000,
        },
      };
    }

    let profiles = await User.find(query).limit(limit).lean();

    profiles = rankProfiles(profiles, user);

    res.json({
      profiles: profiles.map((p) => {
        delete p.password;
        delete p.email;
        delete p.filters;
        delete p.__v;
        return p;
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function rankProfiles(profiles, currentUser) {
  return profiles
    .map((p) => {
      let score = 0;

      // Denomination match
      if (p.denomination === currentUser.denomination) score += 30;

      // Shared interests
      const shared = (p.interests || []).filter((i) =>
        (currentUser.interests || []).includes(i)
      );
      score += shared.length * 8;

      // Age proximity (prefer closer ages)
      const ageDiff = Math.abs(p.age - currentUser.age);
      score += Math.max(0, 20 - ageDiff * 2);

      // Has prompts filled out
      const filledPrompts = (p.prompts || []).filter(
        (pr) => pr.prompt && pr.answer
      );
      score += filledPrompts.length * 5;

      // Photo count bonus
      score += Math.min((p.photos || []).length, 6) * 3;

      // Recency bonus
      const hoursSinceActive =
        (Date.now() - new Date(p.lastActive).getTime()) / 3600000;
      if (hoursSinceActive < 1) score += 15;
      else if (hoursSinceActive < 24) score += 8;
      else if (hoursSinceActive < 72) score += 3;

      return { ...p, _score: score };
    })
    .sort((a, b) => b._score - a._score);
}

export default router;
