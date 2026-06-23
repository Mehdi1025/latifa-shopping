/** Charge fixe mensuelle simulée pour une nouvelle recrue (simulateur KPI). */
export const CHARGE_RECRUE_MENSUELLE = 1600;

export {
  DEFAULT_CHARGES_FIXES_MENSUELLES,
  DEFAULT_OBJECTIF_CA_MENSUEL,
  DEFAULT_OBJECTIF_COMMANDES_MENSUEL,
  DEFAULT_SHOP_SETTINGS_BUSINESS,
  normalizeShopSettingsBusiness,
  type ShopSettingsBusiness,
} from "@/lib/shop-settings";

/** @deprecated Préférer `DEFAULT_CHARGES_FIXES_MENSUELLES` ou les valeurs `shop_settings`. */
export { DEFAULT_CHARGES_FIXES_MENSUELLES as CHARGES_FIXES_MENSUELLES } from "@/lib/shop-settings";
