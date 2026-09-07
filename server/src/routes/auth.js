import { Router } from "express";
import jwt from "jsonwebtoken";
import { body, validationResult } from "express-validator";
import User from "../models/User.js";
import config from "../config.js";
import auth from "../middleware/auth.js";

const router = Router();

function signToken(id) {
  return jwt.sign({ id }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
    body("name").trim().notEmpty(),
    body("age").isInt({ min: 18, max: 99 }),
    body("gender").isIn(["male", "female"]),
    body("denomination").trim().notEmpty(),
  ],
  validate,
  async (req, res) => {
    try {
      const existing = await User.findOne({ email: req.body.email });
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const user = await User.create({
        email: req.body.email,
        password: req.body.password,
        name: req.body.name,
        age: req.body.age,
        height: req.body.height,
        gender: req.body.gender,
        denomination: req.body.denomination,
        job: req.body.job || "",
        school: req.body.school || "",
        location: req.body.location || {},
        photos: req.body.photos || [],
        prompts: req.body.prompts || [],
        interests: req.body.interests || [],
        filters: req.body.filters || {},
      });

      const token = signToken(user._id);
      res.status(201).json({ token, user: user.toProfile() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post(
  "/login",
  [body("email").isEmail().normalizeEmail(), body("password").notEmpty()],
  validate,
  async (req, res) => {
    try {
      const user = await User.findOne({ email: req.body.email }).select(
        "+password"
      );
      if (!user || !(await user.comparePassword(req.body.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = signToken(user._id);
      res.json({ token, user: user.toProfile() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.get("/me", auth, (req, res) => {
  res.json({ user: req.user.toProfile() });
});

export default router;
