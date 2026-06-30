import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

router.post("/login", async (req, res): Promise<void> => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Identifiant et mot de passe requis" });
    return;
  }

  let user: typeof usersTable.$inferSelect | undefined;
  try {
    [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  } catch (err) {
    const dbError = err as {
      message?: string;
      code?: string;
      detail?: string;
      hint?: string;
      cause?: { message?: string; code?: string; detail?: string; hint?: string };
    };
    logger.error(
      {
        err,
        dbCode: dbError.code ?? dbError.cause?.code,
        dbDetail: dbError.detail ?? dbError.cause?.detail,
        dbHint: dbError.hint ?? dbError.cause?.hint,
        dbCause: dbError.cause?.message,
      },
      "Login database query failed",
    );
    res.status(500).json({ error: "Erreur de connexion à la base de données" });
    return;
  }

  if (!user) {
    res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
    return;
  }
  req.session!.userId = user.id;
  req.session!.role = user.role;

  req.session!.save((err) => {
    if (err) {
      logger.error({ err, userId: user.id }, "Failed to save login session");
      res.status(500).json({ error: "Impossible d'enregistrer la session. Veuillez réessayer." });
      return;
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  });
});

router.post("/logout", (req, res): void => {
  req.session?.destroy(() => {});
  res.json({ success: true });
});

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session!.userId!)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
  });
});

export default router;
