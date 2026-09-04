-- Tolérance : un écart de cette durée ou moins ne compte pas (dans les deux sens)
ALTER TABLE "Parametres" ADD COLUMN "toleranceMinutes" INTEGER NOT NULL DEFAULT 15;
