-- CreateTable
CREATE TABLE "Union" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "upazilaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Union_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Union_upazilaId_idx" ON "Union"("upazilaId");

-- CreateIndex
CREATE UNIQUE INDEX "Union_upazilaId_name_key" ON "Union"("upazilaId", "name");

-- AddForeignKey
ALTER TABLE "Union" ADD CONSTRAINT "Union_upazilaId_fkey" FOREIGN KEY ("upazilaId") REFERENCES "Upazila"("id") ON DELETE CASCADE ON UPDATE CASCADE;
