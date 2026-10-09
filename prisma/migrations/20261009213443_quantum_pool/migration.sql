-- CreateTable
CREATE TABLE "QuantumSeed" (
    "id" TEXT NOT NULL,
    "hex" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "offset" INTEGER NOT NULL,
    "sourceTime" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "boxNumber" INTEGER,

    CONSTRAINT "QuantumSeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuantumSeed_usedAt_idx" ON "QuantumSeed"("usedAt");
