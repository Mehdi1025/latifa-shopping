/** Champs CRM optionnels sur `public.clients` (migration segment_rfm) */
export type ClientCrmRow = {
  id: string;
  nom: string;
  telephone: string | null;
  segment_rfm?: string | null;
  total_depense?: number | null;
  created_at?: string;
};

export type SegmentRfmAffiche = "VIP" | "Endormi";
