import express, { Router, Request, Response } from "express";
import { db } from "../lib/db";
import { v4 as uuidv4 } from "uuid";
import { authenticateToken, AuthRequest } from "../middleware/auth";

interface Track {
  vol: number;
  steps: number[];
}

interface PatternData {
  [trackName: string]: Track;
}
interface PatternMetadata {
  author: string;
  title: string;
}

interface PatternOptions {
  tempo: number; // BPM
  kit: string; // e.g. "808", "909"
}

interface Pattern {
  id: string;
  creator_id: string;
  metadata: string;
  options: string;
  pattern: string;
  genre: string;
  status: "pending" | "approved" | "deleted";
  likes_count: number;
  created_at: string;
  updated_at: string;
}

interface Like {
  user_id: string;
  pattern_id: string;
  created_at: string;
}

const router: Router = express.Router();
router.use(authenticateToken);

// GET all patterns
router.get("/", (req: Request, res: Response) => {
  const rows = db.prepare(`SELECT * FROM patterns`).all() as Pattern[];
  const parsed = rows.map((row) => ({
    ...row,
    metadata: JSON.parse(row.metadata) as PatternMetadata,
    options: JSON.parse(row.options) as PatternOptions,
    pattern: JSON.parse(row.pattern) as PatternData,
  }));
  res.json(parsed);
});

// POST new pattern
router.post("/", (req: AuthRequest, res: Response) => {
  const { metadata, options, pattern, genre } = req.body as {
    metadata: { author: string; title: string };
    options: { tempo: number; kit: string };
    pattern: PatternData;
    genre: string;
  };
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

// PUT update pattern
router.put("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, tempo, kit, genre, status } = req.body as {
    title: string;
    tempo: number;
    kit: string;
    genre: string;
    status: "pending" | "approved" | "deleted";
  };

  db.prepare(
    `
    UPDATE patterns SET title = ?, tempo = ?, kit = ?, genre = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
  ).run(title, tempo, kit, genre, status, id);
  res.json({ updated: true });
});

// DELETE pattern
router.delete("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  db.prepare(`DELETE FROM patterns WHERE id = ?`).run(id);
  res.json({ deleted: true });
});

// POST like/unlike pattern
router.post("/:id/like", (req: Request, res: Response) => {
  const { id } = req.params;
  const user_id = req.user!.id;

  const pattern = db.prepare(`SELECT id FROM patterns WHERE id = ?`).get(id) as
    | Pattern
    | undefined;
  if (!pattern) {
    res.status(404).json({ error: "Pattern not found" });
  }

  const existing = db
    .prepare(`SELECT * FROM likes WHERE user_id = ? AND pattern_id = ?`)
    .get(user_id, id) as Like | undefined;

  if (existing) {
    db.prepare(`DELETE FROM likes WHERE user_id = ? AND pattern_id = ?`).run(
      user_id,
      id,
    );
    db.prepare(
      `UPDATE patterns SET likes_count = likes_count - 1 WHERE id = ?`,
    ).run(id);
    res.json({ liked: false });
  } else {
    db.prepare(`INSERT INTO likes (user_id, pattern_id) VALUES (?, ?)`).run(
      user_id,
      id,
    );
    db.prepare(
      `UPDATE patterns SET likes_count = likes_count + 1 WHERE id = ?`,
    ).run(id);
    res.json({ liked: true });
  }
});
// GET patterns by user
router.get("/user/:userId", (req: Request, res: Response) => {
  const { userId } = req.params;
  const patterns = db
    .prepare(`SELECT * FROM patterns WHERE creator_id = ?`)
    .all(userId) as Pattern[];
  res.json(patterns);
});

export default router;
