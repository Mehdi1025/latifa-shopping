/** Valeurs par défaut si `shop_settings` absent ou colonnes nulles. */
export const DEFAULT_CHARGES_FIXES_MENSUELLES = 3500;
export const DEFAULT_OBJECTIF_CA_MENSUEL = 15000;
export const DEFAULT_OBJECTIF_COMMANDES_MENSUEL = 400;

/** @deprecated Utiliser les valeurs depuis `shop_settings` ou les DEFAULT_* ci-dessus. */
export const CHARGES_FIXES_MENSUELLES = DEFAULT_CHARGES_FIXES_MENSUELLES;

export const CHARGE_RECRUE_MENSUELLE = 1600;

export type ShopSettingsBusiness = {
  charges_fixes_mensuelles: number;
  objectif_ca_mensuel: number;
  objectif_commandes_mensuel: number;
};

export const DEFAULT_SHOP_SETTINGS_BUSINESS: ShopSettingsBusiness = {
  charges_fixes_mensuelles: DEFAULT_CHARGES_FIXES_MENSUELLES,
  objectif_ca_mensuel: DEFAULT_OBJECTIF_CA_MENSUEL,
  objectif_commandes_mensuel: DEFAULT_OBJECTIF_COMMANDES_MENSUEL,
};

function toPositiveNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 100) / 100;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

/** Normalise une ligne `shop_settings` (id=1). */
export function normalizeShopSettingsBusiness(
  row: Record<string, unknown> | null | undefined
): ShopSettingsBusiness {
  if (!row) return { ...DEFAULT_SHOP_SETTINGS_BUSINESS };

  return {
    charges_fixes_mensuelles: toPositiveNumber(
      row.charges_fixes_mensuelles,
      DEFAULT_CHARGES_FIXES_MENSUELLES
    ),
    objectif_ca_mensuel: toPositiveNumber(
      row.objectif_ca_mensuel,
      DEFAULT_OBJECTIF_CA_MENSUEL
    ),
    objectif_commandes_mensuel: toPositiveInt(
      row.objectif_commandes_mensuel,
      DEFAULT_OBJECTIF_COMMANDES_MENSUEL
    ),
  };
}
