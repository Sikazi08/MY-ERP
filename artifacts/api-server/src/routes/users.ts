import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, pool } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

async function invalidateUserSessions(userId: number): Promise<void> {
  await pool.query("DELETE FROM session WHERE sess->>'userId' = $1", [String(userId)]);
}

router.get("/", requireAdmin, async (req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    fullName: usersTable.fullName,
    role: usersTable.role,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

router.post("/", requireAdmin, async (req, res): Promise<void> => {
  const { username, password, fullName, role } = req.body;
  if (!username || !password || !fullName || !role) {
    res.status(400).json({ error: "Tous les champs sont requis" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ username, passwordHash, fullName, role }).returning();
  res.status(201).json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
  });
});

router.patch("/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { username, password, fullName, role } = req.body;
  const updates: Record<string, unknown> = {};
  if (username) updates.username = username;
  if (fullName) updates.fullName = fullName;
  if (role) updates.role = role;
  if (password) updates.passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Utilisateur non trouvé" }); return; }
  if (updates.role || updates.passwordHash) {
    await invalidateUserSessions(id);
  }
  res.json({ id: user.id, username: user.username, fullName: user.fullName, role: user.role, createdAt: user.createdAt });
});

router.delete("/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (id === req.session!.userId) {
    res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });
    return;
  }
  await invalidateUserSessions(id);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

export default router;
