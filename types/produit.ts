/**
 * Produit “flat SKU” : chaque variante = une ligne avec un EAN-13 unique.
 * `code_barre` est toujours une chaîne (jamais number) pour conserver les zéros de tête.
 */
export type Produit = {
  id: string;
  nom: string;
  description: string | null;
  prix: number;
  stock: number;
  categorie: string | null;
  /** EAN-13, 13 chiffres en string */
  code_barre: string | null;
  taille: string | null;
  couleur: string | null;
  created_at?: string;
};
