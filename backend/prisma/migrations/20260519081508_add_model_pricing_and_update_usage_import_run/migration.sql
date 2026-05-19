-- AlterTable
ALTER TABLE "usage_import_runs" ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'api',
ALTER COLUMN "dataPath" DROP NOT NULL;

-- CreateTable
CREATE TABLE "model_pricing" (
    "model" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "unitType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_pricing_pkey" PRIMARY KEY ("model")
);
