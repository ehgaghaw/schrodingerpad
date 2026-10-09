-- CreateEnum
CREATE TYPE "BoxState" AS ENUM ('LAUNCHING', 'SEALED', 'COLLAPSING', 'COLLAPSED', 'FAILED');

-- CreateEnum
CREATE TYPE "SeedSource" AS ENUM ('QUANTUM', 'CLASSICAL');

-- CreateEnum
CREATE TYPE "Fate" AS ENUM ('ALIVE', 'DEAD');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'ULTRA_RARE');

-- CreateEnum
CREATE TYPE "CollapseReason" AS ENUM ('FIRST_BUY', 'DECOHERENCE');

-- CreateEnum
CREATE TYPE "IntentStatus" AS ENUM ('PENDING', 'PAID', 'LAUNCHING', 'LAUNCHED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutKind" AS ENUM ('HOLDER', 'CREATOR');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'SENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "BurnStatus" AS ENUM ('PENDING', 'BOUGHT', 'BURNED', 'FAILED');

-- CreateTable
CREATE TABLE "Box" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "mint" TEXT,
    "ticker" TEXT NOT NULL,
    "state" "BoxState" NOT NULL DEFAULT 'LAUNCHING',
    "test" BOOLEAN NOT NULL DEFAULT false,
    "creatorWallet" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "commitment" TEXT NOT NULL,
    "seedSource" "SeedSource" NOT NULL,
    "seedProvider" TEXT NOT NULL,
    "seedRequestId" TEXT NOT NULL,
    "seedSourceTime" TEXT,
    "seedFetchedAt" TIMESTAMP(3) NOT NULL,
    "seedNote" TEXT,
    "commitSig" TEXT,
    "commitCluster" TEXT NOT NULL,
    "verifiedOnChain" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "launchSig" TEXT,
    "metadataUri" TEXT,
    "launchedAt" TIMESTAMP(3),
    "decoheresAt" TIMESTAMP(3),
    "launchError" TEXT,
    "observerWallet" TEXT,
    "observeSig" TEXT,
    "observedAt" TIMESTAMP(3),
    "collapseReason" "CollapseReason",
    "collapsedAt" TIMESTAMP(3),
    "name" TEXT,
    "rarity" "Rarity",
    "rarityRoll" INTEGER,
    "fate" "Fate",
    "lore" TEXT,
    "traits" JSONB,
    "art" BYTEA,
    "postedAt" TIMESTAMP(3),
    "postId" TEXT,
    "priceSol" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marketCapSol" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bondingProgress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "lastTradeAt" TIMESTAMP(3),
    "lastSig" TEXT,
    "feesAccrued" BIGINT NOT NULL DEFAULT 0,
    "feesAllocated" BIGINT NOT NULL DEFAULT 0,
    "pendingCreator" BIGINT NOT NULL DEFAULT 0,
    "pendingPool" BIGINT NOT NULL DEFAULT 0,
    "creatorPaid" BIGINT NOT NULL DEFAULT 0,
    "holdersPaid" BIGINT NOT NULL DEFAULT 0,
    "buybackSpent" BIGINT NOT NULL DEFAULT 0,
    "tokensBurned" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Box_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "sig" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "wallet" TEXT NOT NULL,
    "isBuy" BOOLEAN NOT NULL,
    "solAmount" BIGINT NOT NULL,
    "tokenAmount" BIGINT NOT NULL,
    "creatorFee" BIGINT NOT NULL DEFAULT 0,
    "priceSol" DOUBLE PRECISION NOT NULL,
    "marketCapSol" DOUBLE PRECISION NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchIntent" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "lamports" BIGINT NOT NULL,
    "status" "IntentStatus" NOT NULL DEFAULT 'PENDING',
    "paySig" TEXT,
    "boxId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeCollection" (
    "id" TEXT NOT NULL,
    "sig" TEXT NOT NULL,
    "lamports" BIGINT NOT NULL,
    "unattributed" BIGINT NOT NULL DEFAULT 0,
    "test" BOOLEAN NOT NULL DEFAULT false,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeAllocation" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "lamports" BIGINT NOT NULL,
    "creatorShare" BIGINT NOT NULL,
    "poolShare" BIGINT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutBatch" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "kind" "PayoutKind" NOT NULL,
    "total" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "kind" "PayoutKind" NOT NULL,
    "wallet" TEXT NOT NULL,
    "lamports" BIGINT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "sig" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Burn" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "lamports" BIGINT NOT NULL,
    "tokens" BIGINT NOT NULL DEFAULT 0,
    "buySig" TEXT,
    "burnSig" TEXT,
    "status" "BurnStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "Burn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolderSnapshot" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolderSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KV" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KV_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LogEntry" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "msg" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Box_number_key" ON "Box"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Box_mint_key" ON "Box"("mint");

-- CreateIndex
CREATE INDEX "Box_state_createdAt_idx" ON "Box"("state", "createdAt");

-- CreateIndex
CREATE INDEX "Box_fate_idx" ON "Box"("fate");

-- CreateIndex
CREATE INDEX "Box_rarity_rarityRoll_idx" ON "Box"("rarity", "rarityRoll");

-- CreateIndex
CREATE INDEX "Trade_boxId_at_idx" ON "Trade"("boxId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_sig_idx_key" ON "Trade"("sig", "idx");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchIntent_paySig_key" ON "LaunchIntent"("paySig");

-- CreateIndex
CREATE INDEX "LaunchIntent_wallet_createdAt_idx" ON "LaunchIntent"("wallet", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeeCollection_sig_key" ON "FeeCollection"("sig");

-- CreateIndex
CREATE UNIQUE INDEX "FeeAllocation_collectionId_boxId_key" ON "FeeAllocation"("collectionId", "boxId");

-- CreateIndex
CREATE INDEX "Payout_boxId_createdAt_idx" ON "Payout"("boxId", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_batchId_wallet_key" ON "Payout"("batchId", "wallet");

-- CreateIndex
CREATE INDEX "Burn_boxId_createdAt_idx" ON "Burn"("boxId", "createdAt");

-- CreateIndex
CREATE INDEX "HolderSnapshot_boxId_at_idx" ON "HolderSnapshot"("boxId", "at");

-- CreateIndex
CREATE INDEX "LogEntry_at_idx" ON "LogEntry"("at");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAllocation" ADD CONSTRAINT "FeeAllocation_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FeeCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAllocation" ADD CONSTRAINT "FeeAllocation_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutBatch" ADD CONSTRAINT "PayoutBatch_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayoutBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Burn" ADD CONSTRAINT "Burn_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolderSnapshot" ADD CONSTRAINT "HolderSnapshot_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
