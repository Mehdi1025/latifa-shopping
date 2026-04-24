/**
 * Lit catalogue.xlsx (racine du projet) et génère
 * supabase/migrations/reset_et_import_produits.sql
 *
 * Prérequis : npm install xlsx
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const ROOT = path.join(__dirname, "..");
const EXCEL_PATH = path.join(ROOT, "catalogue.xlsx");
const SQL_OUT = path.join(
  ROOT,
  "supabase",
  "migrations",
  "reset_et_import_produits.sql"
);

const BATCH_SIZE = 200;

/** Ligne d’en-têtes (1-based Excel) : 3 */
const HEADER_ROW_1BASED = 3;
/** Première ligne de données après les en-têtes (1-based Excel) : 4 */
const FIRST_DATA_ROW_1BASED = 4;

function sqlLiteral(str) {
  if (str == null) return "NULL";
  const s = String(str);
  return `'${s.replace(/'/g, "''")}'`;
}

function sqlNullableText(str) {
  if (str == null) return "NULL";
  const t = String(str).trim();
  if (!t) return "NULL";
  return sqlLiteral(t);
}

/**
 * Prix : nombre Excel, ou chaîne avec € / espace / virgule décimale FR.
 */
function parsePrice(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  let s = String(raw)
    .trim()
    .replace(/€/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Stock : entier (chaîne ou nombre), espaces nettoyés.
 */
function parseStock(raw) {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  const s = String(raw)
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "")
    .replace(",", ".");
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

/**
 * EAN-13 depuis la cellule brute de la feuille : préfère le texte affiché (.w) pour garder les zéros initiaux si Excel est en format texte.
 */
function eanFromSheetCell(sheet, row0Based, col0Based) {
  const addr = XLSX.utils.encode_cell({ r: row0Based, c: col0Based });
  const cell = sheet[addr];
  if (!cell) return null;
  let s = null;
  if (cell.w != null && String(cell.w).trim() !== "") {
    s = String(cell.w).trim();
  } else if (cell.t === "s" && cell.v != null) {
    s = String(cell.v).trim();
  } else if (cell.t === "n" && cell.v != null) {
    const str = String(cell.v);
    s = (str.includes("e") || str.includes("E")
      ? String(Math.round(cell.v))
      : str
    ).replace(/\.\d+$/, "");
  } else if (cell.v != null) {
    s = String(cell.v).trim();
  }
  if (s == null || s === "") return null;
  return s;
}

/**
 * Nom - Couleur - Taille : partie 1 → nom, 2 → couleur, 3+ → taille (rejointes par " - ").
 */
function splitNomProduit(cell) {
  const s = String(cell ?? "").trim();
  if (!s) return { nom: "", couleur: null, taille: null };
  const parts = s
    .split(" - ")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return { nom: "", couleur: null, taille: null };
  const nom = parts[0] || "";
  const couleur = parts.length >= 2 ? parts[1] : null;
  const taille =
    parts.length >= 3 ? parts.slice(2).join(" - ") || null : null;
  return { nom, couleur, taille };
}

function normalizeHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findColIndex(headerRow, candidates) {
  const normalized = headerRow.map(normalizeHeader);
  for (const c of candidates) {
    const i = normalized.indexOf(normalizeHeader(c));
    if (i !== -1) return i;
  }
  return -1;
}

/** Colonne « Stock » : nom exact après trim (insensible aux espaces multiples internes non — on trim le libellé). */
function findColIndexExactStock(headerRow) {
  for (let i = 0; i < headerRow.length; i++) {
    if (String(headerRow[i] ?? "").trim() === "Stock") return i;
  }
  return -1;
}

function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error("Fichier introuvable :", EXCEL_PATH);
    process.exit(1);
  }

  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    console.error("Aucune feuille dans le classeur.");
    process.exit(1);
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (rows.length < HEADER_ROW_1BASED) {
    console.error("Feuille trop courte : attendu en-têtes à la ligne 3.");
    process.exit(1);
  }

  const headerRow = rows[HEADER_ROW_1BASED - 1];
  if (!Array.isArray(headerRow)) {
    console.error("Ligne 3 invalide (en-têtes).");
    process.exit(1);
  }

  const idxNom = findColIndex(headerRow, [
    "Nom du produit",
    "nom du produit",
  ]);
  const idxPrix = findColIndex(headerRow, ["Prix", "prix"]);
  const idxCat = findColIndex(headerRow, ["Catégorie", "categorie", "catégorie"]);
  const idxEan = findColIndex(headerRow, [
    "EAN-13 complet",
    "ean-13 complet",
    "EAN13 complet",
  ]);
  const idxStock = findColIndexExactStock(headerRow);

  if (
    idxNom === -1 ||
    idxPrix === -1 ||
    idxCat === -1 ||
    idxEan === -1 ||
    idxStock === -1
  ) {
    console.error(
      "Colonnes manquantes. Trouvées (ligne 3) :",
      headerRow.filter(Boolean).join(" | ")
    );
    console.error(
      "Requis : « Nom du produit », « Prix », « Catégorie », « EAN-13 complet », « Stock » (nom exact)"
    );
    process.exit(1);
  }

  const dataRows = rows.slice(HEADER_ROW_1BASED);
  const valueTuples = [];

  for (let r = 0; r < dataRows.length; r++) {
    const line = dataRows[r];
    if (!Array.isArray(line)) continue;

    const rawNom = line[idxNom];
    const { nom, couleur, taille } = splitNomProduit(rawNom);
    if (!nom) continue;

    const prix = parsePrice(line[idxPrix]);
    if (prix == null) {
      console.warn(
        `Ligne données ${r + FIRST_DATA_ROW_1BASED} : prix invalide pour « ${nom} », ligne ignorée.`
      );
      continue;
    }

    const categorieRaw = line[idxCat];
    const categorie =
      categorieRaw != null && String(categorieRaw).trim()
        ? String(categorieRaw).trim()
        : null;

    const sheetRow0 = HEADER_ROW_1BASED + r;
    const codeBarre = eanFromSheetCell(sheet, sheetRow0, idxEan);
    if (!codeBarre) {
      console.warn(
        `Ligne données ${r + FIRST_DATA_ROW_1BASED} : EAN manquant pour « ${nom} », ligne ignorée.`
      );
      continue;
    }

    const stock = parseStock(line[idxStock]);

    valueTuples.push(
      `(${sqlLiteral(nom)}, ${sqlNullableText(
        couleur
      )}, ${sqlNullableText(taille)}, ${prix}, ${sqlNullableText(
        categorie
      )}, ${sqlLiteral(codeBarre)}, ${stock})`
    );
  }

  const lines = [];
  lines.push(
    "-- Généré par scripts/import_excel_to_sql.js — ne pas éditer à la main sauf besoin."
  );
  lines.push(
    "-- Vide la table produits avant import."
  );
  lines.push(
    "-- Si erreur 23503 (ventes_items_produit_id_fkey) : exécuter avant ce fichier DELETE FROM public.ventes_items; puis DELETE FROM public.ventes;"
  );
  lines.push("DELETE FROM public.produits;");
  lines.push("");

  if (valueTuples.length === 0) {
    lines.push(
      "-- Aucune ligne produit importée (vérifiez le fichier Excel et les filtres)."
    );
  } else {
    for (let i = 0; i < valueTuples.length; i += BATCH_SIZE) {
      const chunk = valueTuples.slice(i, i + BATCH_SIZE);
      lines.push(
        "INSERT INTO public.produits (nom, couleur, taille, prix, categorie, code_barre, stock) VALUES"
      );
      lines.push(chunk.join(",\n") + ";");
      lines.push("");
    }
  }

  fs.mkdirSync(path.dirname(SQL_OUT), { recursive: true });
  fs.writeFileSync(SQL_OUT, lines.join("\n"), "utf8");
  console.log(
    `OK : ${valueTuples.length} produit(s) → ${path.relative(ROOT, SQL_OUT)}`
  );
}

main();
