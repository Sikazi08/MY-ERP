import { Router } from "express";
import { db } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import multer from "multer";
import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// Direct SQL table access since we don't have a Drizzle schema for this table yet
async function getAttachments(productId: number) {
  const rows = await db.execute(sql`
    SELECT id, product_id, type, filename, mime_type, uploaded_by_user_id, created_at
    FROM troc_attachments WHERE product_id = ${productId} ORDER BY created_at ASC
  `);
  return rows.rows;
}

// GET /api/attachments/products/:id — list attachments for a product
router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const productId = parseInt(req.params.id);
  const rows = await getAttachments(productId);
  res.json(rows);
});

// POST /api/attachments/products/:id — upload an attachment
router.post("/products/:id", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  const productId = parseInt(req.params.id);
  if (!req.file) { res.status(400).json({ error: "Fichier requis" }); return; }

  const { type } = req.body;
  if (!type || !["facture", "declaration", "cni"].includes(type)) {
    res.status(400).json({ error: "Type invalide. Valeurs: facture, declaration, cni" });
    return;
  }

  const base64 = req.file.buffer.toString("base64");

  const result = await db.execute(sql`
    INSERT INTO troc_attachments (product_id, type, filename, mime_type, file_data, uploaded_by_user_id)
    VALUES (${productId}, ${type}, ${req.file.originalname}, ${req.file.mimetype}, ${base64}, ${req.session!.userId!})
    RETURNING id, product_id, type, filename, mime_type, uploaded_by_user_id, created_at
  `);

  res.status(201).json(result.rows[0]);
});

// GET /api/attachments/:id/download — download a specific attachment
router.get("/:id/download", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const result = await db.execute(sql`SELECT * FROM troc_attachments WHERE id = ${id}`);
  const row = result.rows[0] as any;
  if (!row) { res.status(404).json({ error: "Pièce jointe non trouvée" }); return; }

  const buffer = Buffer.from(row.file_data as string, "base64");
  res.setHeader("Content-Type", row.mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${row.filename}"`);
  res.send(buffer);
});

// DELETE /api/attachments/:id — delete an attachment (admin or uploader)
router.delete("/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const isAdmin = req.session!.role === "admin";
  const userId = req.session!.userId!;

  const result = await db.execute(sql`SELECT id, uploaded_by_user_id FROM troc_attachments WHERE id = ${id}`);
  const row = result.rows[0] as any;
  if (!row) { res.status(404).json({ error: "Pièce jointe non trouvée" }); return; }

  if (!isAdmin && row.uploaded_by_user_id !== userId) {
    res.status(403).json({ error: "Permission refusée" });
    return;
  }

  await db.execute(sql`DELETE FROM troc_attachments WHERE id = ${id}`);
  res.status(204).send();
});

export default router;
