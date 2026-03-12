-- AlterTable: add DOFA fields to ContextoItem (enviarADofa, dofaDimension)
ALTER TABLE "ContextoItem" ADD COLUMN IF NOT EXISTS "enviarADofa" BOOLEAN DEFAULT false;
ALTER TABLE "ContextoItem" ADD COLUMN IF NOT EXISTS "dofaDimension" VARCHAR(50);
