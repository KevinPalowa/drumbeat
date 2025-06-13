import express from "express";
import { db } from "../lib/db";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();
const JWT_SECRET = "your_jwt_secret";

router.post("/register", (req, res) => {
  const { username, email, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  const id = uuidv4();
  const role = "user";
  try {
    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    ).run(id, username, email, hash, role);
    res.status(201).json({ id, username, email });
  } catch (err) {
    res.status(400).json({ error: "User already exists" });
  }
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
  if (user && bcrypt.compareSync(password, user.password_hash)) {
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
    res.json({ token });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

export default router;
