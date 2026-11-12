-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pourashavaId" TEXT,
ADD COLUMN     "unionId" TEXT;

-- CreateIndex
CREATE INDEX "User_unionId_idx" ON "User"("unionId");

-- CreateIndex
CREATE INDEX "User_pourashavaId_idx" ON "User"("pourashavaId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_unionId_fkey" FOREIGN KEY ("unionId") REFERENCES "Union"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_pourashavaId_fkey" FOREIGN KEY ("pourashavaId") REFERENCES "Pourashava"("id") ON DELETE SET NULL ON UPDATE CASCADE;
