import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function loadAndVerifyUser(req: Request, res: Response): Promise<boolean> {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Non autorisé" });
    return false;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId))
    .limit(1);
  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Non autorisé" });
    return false;
  }
  req.session.role = user.role;
  return true;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ok = await loadAndVerifyUser(req, res);
  if (ok) next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ok = await loadAndVerifyUser(req, res);
  if (!ok) return;
  if (req.session!.role !== "admin") {
    res.status(403).json({ error: "Accès réservé à l'administrateur" });
    return;
  }
  next();
}
