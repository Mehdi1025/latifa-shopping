"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, FileUp, Loader2, Package, Users } from "lucide-react";
import { createSupabaseBrowserClient } from "@/utils/supabase/client";
import { buildProduitImportRow, parseCsv, type ProduitImportRow } from "@/lib/csv";

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
}

function mapHeaders(headers: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  headers.forEach((h, i) => {
    m[normalizeHeader(h)] = i;
  });
  return m;
}

export default function ImportPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<"produits" | "clients">("produits");
  const [fileName, setFileName] = useState<string | null>(null);
  const [raw, setRaw] = useState<string>("");
  const [preview, setPreview] = useState<string[][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const rows = useMemo(() => {
    if (!raw.trim()) return [];
    try {
      return parseCsv(raw);
    } catch {
      return [];
    }
  }, [raw]);

  const onFile = async (f: File | null) => {
    setError(null);
    setOkMsg(null);
    if (!f) return;
    setFileName(f.name);
    const text = await f.text();
    setRaw(text);
    const parsed = parseCsv(text);
    setPreview(parsed.slice(0, 8));
  };

  const importProduits = async () => {
    if (rows.length < 2) {
      setError("Fichier vide ou sans en-tête.");
      return;
    }
    const headers = rows[0]!.map((h) => normalizeHeader(h));
    const idx = mapHeaders(rows[0]!);
    const need = ["nom", "prix", "stock"];
    for (const k of need) {
      if (idx[k] === undefined) {
        setError(`Colonne requise manquante : « ${k} » (en-têtes : ${headers.join(", ")})`);
        return;
      }
    }
    const hasEan =
      idx.code_barre !== undefined ||
      idx.ean13 !== undefined ||
      idx.ean !== undefined;
    if (!hasEan) {
      setError(
        "Colonne EAN requise : « code_barre » (ou ean / ean13) — 13 chiffres par variante."
      );
      return;
    }
    const payload: ProduitImportRow[] = [];
    const lineErrors: string[] = [];
    rows.slice(1).forEach((r, i) => {
      const res = buildProduitImportRow(r, idx);
      if (res.ok) payload.push(res.row);
      else lineErrors.push(`Ligne ${i + 2} : ${res.error}`);
    });
    if (payload.length === 0) {
      setError(
        lineErrors.length > 0
          ? lineErrors.slice(0, 5).join(" · ")
          : "Aucune ligne valide."
      );
      return;
    }
    setLoading(true);
    setError(null);
    setOkMsg(null);
    const chunkSize = 40;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      const { error: err } = await supabase
        .from("produits")
        .upsert(chunk, { onConflict: "code_barre" });
      if (err) {
        setError(`${err.message} (lot ~${i + 2})`);
        setLoading(false);
        return;
      }
    }
    const skipped = lineErrors.length;
    setOkMsg(
      `${payload.length} variante(s) enregistrée(s) (upsert par EAN).${
        skipped > 0 ? ` ${skipped} ligne(s) ignorée(s).` : ""
      }${skipped > 0 && lineErrors[0] ? ` Ex. : ${lineErrors[0]}` : ""}`
    );
    setLoading(false);
  };

  const importClients = async () => {
    if (rows.length < 2) {
      setError("Fichier vide ou sans en-tête.");
      return;
    }
    const idx = mapHeaders(rows[0]!);
    if (idx.nom === undefined) {
      setError('Colonne « nom » obligatoire (première ligne = en-têtes).');
      return;
    }
    const payload = rows.slice(1).map((r) => {
      const nom = String(r[idx.nom] ?? "").trim();
      const telephone =
        idx.telephone !== undefined
          ? String(r[idx.telephone] ?? "").replace(/\D/g, "") || null
          : null;
      return { nom: nom || "Client", telephone };
    });
    const valid = payload.filter((p) => p.nom.trim().length > 0);
    if (valid.length === 0) {
      setError("Aucune ligne valide.");
      return;
    }
    setLoading(true);
    setError(null);
    setOkMsg(null);
    const chunkSize = 50;
    for (let i = 0; i < valid.length; i += chunkSize) {
      const chunk = valid.slice(i, i + chunkSize);
      const { error: err } = await supabase.from("clients").insert(chunk);
      if (err) {
        setError(`${err.message} (lot ~${i})`);
        setLoading(false);
        return;
      }
    }
    setOkMsg(`${valid.length} client(s) importé(s).`);
    setLoading(false);
  };

  return (
    <div className="admin-container min-h-dvh bg-gray-50/50 p-4 md:p-6 lg:p-10">
      <div className="mb-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
          Import CSV
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Produits et clients — fichier UTF-8, séparateur virgule, première ligne
          = en-têtes.
        </p>
      </div>

      <div className="mb-6 inline-flex h-11 items-center gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setMode("produits")}
          className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium transition ${
            mode === "produits"
              ? "bg-gray-900 text-white shadow"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Package className="h-4 w-4" />
          Produits
        </button>
        <button
          type="button"
          onClick={() => setMode("clients")}
          className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium transition ${
            mode === "clients"
              ? "bg-gray-900 text-white shadow"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Users className="h-4 w-4" />
          Clients
        </button>
      </div>

      {mode === "produits" ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="mb-3 text-sm text-gray-600">
            Colonnes :{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
              nom, prix, stock, code_barre (ou ean), taille, couleur, description, categorie
            </code>
            . L&apos;EAN-13 (texte) est obligatoire. Si{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">taille</code> /{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">couleur</code>{" "}
            sont absents, le nom est parsé (ex. « Qamis 1 - Blanc - T.60 » → modèle + variantes). Import = upsert par code-barres.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80 px-6 py-10 transition hover:border-indigo-300 hover:bg-indigo-50/30">
            <FileUp className="mb-2 h-10 w-10 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">
              Choisir un fichier .csv
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {fileName && (
            <p className="mt-3 text-center text-xs text-gray-500">{fileName}</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="mb-3 text-sm text-gray-600">
            Colonnes :{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
              nom, telephone
            </code>{" "}
            (téléphone optionnel, chiffres uniquement en base)
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80 px-6 py-10 transition hover:border-indigo-300 hover:bg-indigo-50/30">
            <FileUp className="mb-2 h-10 w-10 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">
              Choisir un fichier .csv
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {fileName && (
            <p className="mt-3 text-center text-xs text-gray-500">{fileName}</p>
          )}
        </div>
      )}

      {preview.length > 0 && (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-gray-900">Aperçu (8 premières lignes)</p>
          <div className="max-h-64 overflow-auto rounded-lg border border-gray-100">
            <table className="w-full min-w-[480px] text-left text-xs">
              <tbody>
                {preview.map((line, i) => (
                  <tr key={i} className={i === 0 ? "bg-gray-50 font-semibold" : ""}>
                    {line.map((c, j) => (
                      <td key={j} className="border-b border-gray-50 px-2 py-1.5">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {okMsg && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {okMsg}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={loading || rows.length < 2}
              onClick={() => void (mode === "produits" ? importProduits() : importClients())}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              Importer {mode === "produits" ? "les produits" : "les clients"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
