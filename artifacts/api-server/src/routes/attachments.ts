import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import multer from "multer";
import path from "path";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const ALLOWED_EXTENSIONS: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

function mimeFromFilename(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS[ext] ?? null;
}

async function getAttachments(productId: number) {
  const rows = await db.execute(sql`
    SELECT id, product_id, type, filename, mime_type, uploaded_by_user_id, created_at
    FROM troc_attachments WHERE product_id = ${productId} ORDER BY created_at ASC
  `);
  return rows.rows;
}

// GET /api/attachments/products/:id — list attachments for a product (uploader or admin only)
router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const productId = parseInt(String(req.params.id));
  const isAdmin = req.session!.role === "admin";
  const userId = req.session!.userId!;

  const rows = await getAttachments(productId);

  if (isAdmin) {
    res.json(rows);
    return;
  }

  const own = rows.filter((r: any) => r.uploaded_by_user_id === userId);
  res.json(own);
});

// POST /api/attachments/products/:id — upload an attachment
router.post("/products/:id", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  const productId = parseInt(String(req.params.id));
  if (!req.file) { res.status(400).json({ error: "Fichier requis" }); return; }

  const { type } = req.body;
  if (!type || !["facture", "declaration", "cni"].includes(type)) {
    res.status(400).json({ error: "Type invalide. Valeurs: facture, declaration, cni" });
    return;
  }

  const safeMime = mimeFromFilename(req.file.originalname);
  if (!safeMime) {
    res.status(400).json({ error: "Type de fichier non autorisé. Formats acceptés: PDF, JPG, PNG" });
    return;
  }

  const base64 = req.file.buffer.toString("base64");

  const result = await db.execute(sql`
    INSERT INTO troc_attachments (product_id, type, filename, mime_type, file_data, uploaded_by_user_id)
    VALUES (${productId}, ${type}, ${req.file.originalname}, ${safeMime}, ${base64}, ${req.session!.userId!})
    RETURNING id, product_id, type, filename, mime_type, uploaded_by_user_id, created_at
  `);

  res.status(201).json(result.rows[0]);
});

// GET /api/attachments/:id/download — download a specific attachment (uploader or admin only)
router.get("/:id/download", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  const isAdmin = req.session!.role === "admin";
  const userId = req.session!.userId!;

  const result = await db.execute(sql`SELECT * FROM troc_attachments WHERE id = ${id}`);
  const row = result.rows[0] as any;
  if (!row) { res.status(404).json({ error: "Pièce jointe non trouvée" }); return; }

  if (!isAdmin && row.uploaded_by_user_id !== userId) {
    res.status(403).json({ error: "Permission refusée" });
    return;
  }

  const safeMime = mimeFromFilename(row.filename) ?? "application/octet-stream";

  const buffer = Buffer.from(row.file_data as string, "base64");

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", safeMime);

  if (req.query.inline) {
    res.setHeader("Content-Disposition", `inline; filename="${row.filename}"`);
    res.setHeader("Content-Security-Policy", "sandbox");
  } else {
    res.setHeader("Content-Disposition", `attachment; filename="${row.filename}"`);
  }

  res.send(buffer);
});

// DELETE /api/attachments/:id — delete an attachment (admin or uploader)
router.delete("/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
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
