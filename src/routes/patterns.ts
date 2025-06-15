import express from "express";
import { db } from "../lib/db";
import { v4 as uuidv4 } from "uuid";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = express.Router();
router.use(authenticateToken);

router.get("/", (req, res) => {
  const rows = db.prepare(`SELECT * FROM patterns`).all();
  const parsed = rows.map((row) => ({
    ...row,
    metadata: JSON.parse(row.metadata),
    options: JSON.parse(row.options),
    pattern: JSON.parse(row.pattern),
  }));
  res.json(parsed);
});
router.post("/", (req: AuthRequest, res) => {
  const { metadata, options, pattern, genre } = req.body;
  const creator_id = req.user!.id;
  const id = uuidv4();

  db.prepare(
    `
    INSERT INTO patterns (id, creator_id, metadata, options, pattern, genre, status, likes_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `,
  ).run(
    id,
    creator_id,
    JSON.stringify(metadata),
    JSON.stringify(options),
    JSON.stringify(pattern),
    genre,
  );

  res.status(201).json({ id });
});
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { title, tempo, kit, genre, status } = req.body;
  db.prepare(
    `
    UPDATE patterns SET title = ?, tempo = ?, kit = ?, genre = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
  ).run(title, tempo, kit, genre, status, id);
  res.json({ updated: true });
});

router.delete("/:id", (req, res) => {
  const { id } = req.params;
  db.prepare(`DELETE FROM patterns WHERE id = ?`).run(id);
  res.json({ deleted: true });
});

router.post("/:id/like", (req, res) => {
  const { id } = req.params; // pattern_id
  const user_id = req.user!.id; // Use authenticated user's ID

  // Verify pattern exists
  const pattern = db.prepare(`SELECT id FROM patterns WHERE id = ?`).get(id);
  if (!pattern) {
    return res.status(404).json({ error: "Pattern not found" });
  }

  // Check if the like already exists
  const existing = db
    .prepare(`SELECT * FROM likes WHERE user_id = ? AND pattern_id = ?`)
    .get(user_id, id);

  if (existing) {
    // Unlike: Remove the like
    db.prepare(`DELETE FROM likes WHERE user_id = ? AND pattern_id = ?`).run(
      user_id,
      id,
    );
    db.prepare(
      `UPDATE patterns SET likes_count = likes_count - 1 WHERE id = ?`,
    ).run(id);
    return res.json({ liked: false });
  } else {
    // Like: Add the like
    db.prepare(`INSERT INTO likes (user_id, pattern_id) VALUES (?, ?)`).run(
      user_id,
      id,
    );
    db.prepare(
      `UPDATE patterns SET likes_count = likes_count + 1 WHERE id = ?`,
    ).run(id);
    return res.json({ liked: true });
  }
});
router.get("/user/:userId", (req, res) => {
  const { userId } = req.params;
  const patterns = db
    .prepare(`SELECT * FROM patterns WHERE creator_id = ?`)
    .all(userId);
  res.json(patterns);
});

export default router;
