-- Add remise column to ventes for discount tracking
ALTER TABLE ventes ADD COLUMN IF NOT EXISTS remise numeric DEFAULT 0;
