/**
 * Script d'import du stock depuis le fichier Excel.
 * Usage: node scripts/import-stock.mjs
 */
import { readFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const XLSX_PATH = resolve(__dirname, "../attached_assets/stock_homies_erp_1782154785056.xlsx");
const API_BASE = process.env.API_URL || "http://localhost:8080";
const USERNAME = process.env.ADMIN_USER || "admin";
const PASSWORD = process.env.ADMIN_PASS || "admin123";

async function main() {
  // Dynamically import xlsx (installed at workspace root)
  const XLSX = await import("xlsx");

  console.log("📂 Lecture du fichier Excel...");
  const buf = await readFile(XLSX_PATH);
  const wb = XLSX.read(buf, { type: "buffer" });

  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  console.log(`📊 ${rows.length} lignes trouvées dans "${sheetName}"`);
  if (rows.length > 0) {
    console.log("Colonnes détectées:", Object.keys(rows[0]).join(", "));
    console.log("Exemple (première ligne):", JSON.stringify(rows[0]));
  }

  // Login
  console.log("\n🔐 Connexion...");
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });

  if (!loginRes.ok) {
    const err = await loginRes.text();
    console.error("❌ Échec connexion:", err);
    process.exit(1);
  }

  const setCookie = loginRes.headers.get("set-cookie");
  const sessionCookie = setCookie?.split(";")[0] || "";
  console.log("✅ Connecté. Cookie:", sessionCookie ? "OK" : "MANQUANT");

  // Map columns - flexible detection
  function normalize(s) {
    return String(s || "").toLowerCase().trim().replace(/\s+/g, "_");
  }

  let imported = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const keys = Object.keys(row);

    // Try to map columns flexibly
    const get = (...names) => {
      for (const name of names) {
        const key = keys.find(k => normalize(k).includes(normalize(name)));
        if (key && row[key] !== "") return String(row[key]).trim();
      }
      return "";
    };

    const product = get("produit", "product", "nom", "name", "modele", "modèle", "appareil");
    if (!product) continue; // skip empty rows

    const brand = get("marque", "brand", "fabricant");
    const imei = get("imei");
    const capacity = get("capacite", "capacité", "capacity", "stockage", "memoire");
    const color = get("couleur", "color");
    const supplier = get("fournisseur", "supplier");
    const entryDate = get("date", "entree", "entrée", "entry") || new Date().toISOString().split("T")[0];
    const sellingPriceRaw = get("prix_vente", "vente", "selling", "prix", "price");
    const purchasePriceRaw = get("prix_achat", "achat", "purchase", "cout", "coût");
    const status = get("statut", "status", "etat", "état") || "en_stock";

    // Parse prices
    const parsePrice = (v) => {
      if (!v) return undefined;
      const n = parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
      return isNaN(n) ? undefined : n;
    };

    // Parse date (Excel serial or string)
    const parseDate = (v) => {
      if (!v) return new Date().toISOString().split("T")[0];
      if (typeof v === "number") {
        // Excel serial date
        const d = XLSX.SSF.parse_date_code(v);
        if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
      }
      // Try to parse string date
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
      return new Date().toISOString().split("T")[0];
    };

    const payload = {
      product,
      brand: brand || undefined,
      imei: imei || undefined,
      capacity: capacity || undefined,
      color: color || undefined,
      supplier: supplier || undefined,
      sellingPrice: parsePrice(sellingPriceRaw),
      purchasePrice: parsePrice(purchasePriceRaw),
      status: ["en_stock", "chez_partenaire", "vendu"].includes(status) ? status : "en_stock",
      entryDate: parseDate(entryDate),
    };

    const res = await fetch(`${API_BASE}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const p = await res.json();
      console.log(`  ✅ [${i + 1}/${rows.length}] ${p.productId} — ${product}${brand ? " " + brand : ""}${capacity ? " " + capacity : ""}`);
      imported++;
    } else {
      const err = await res.json();
      console.log(`  ⚠️  [${i + 1}/${rows.length}] ${product} — ${err.error || res.status}`);
      errors++;
    }
  }

  console.log(`\n✅ Import terminé: ${imported} ajoutés, ${errors} erreurs.`);
}

main().catch(err => { console.error("Erreur fatale:", err); process.exit(1); });
