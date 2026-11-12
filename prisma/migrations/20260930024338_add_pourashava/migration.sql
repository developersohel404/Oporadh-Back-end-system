-- CreateTable
CREATE TABLE "Pourashava" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "upazilaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pourashava_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pourashava_upazilaId_idx" ON "Pourashava"("upazilaId");

-- CreateIndex
CREATE UNIQUE INDEX "Pourashava_upazilaId_name_key" ON "Pourashava"("upazilaId", "name");

-- AddForeignKey
ALTER TABLE "Pourashava" ADD CONSTRAINT "Pourashava_upazilaId_fkey" FOREIGN KEY ("upazilaId") REFERENCES "Upazila"("id") ON DELETE CASCADE ON UPDATE CASCADE;
