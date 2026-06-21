import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "Accès réservé à l'administrateur" });
    return;
  }
  next();
}
