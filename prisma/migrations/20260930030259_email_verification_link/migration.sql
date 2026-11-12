/*
  Warnings:

  - You are about to drop the column `attemptCount` on the `EmailVerification` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `EmailVerification` table. All the data in the column will be lost.
  - You are about to drop the column `otpHash` on the `EmailVerification` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tokenHash]` on the table `EmailVerification` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tokenHash` to the `EmailVerification` table without a default value. This is not possible if the table is not empty.
  - Made the column `userId` on table `EmailVerification` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "EmailVerification_email_purpose_idx";

-- AlterTable
ALTER TABLE "EmailVerification" DROP COLUMN "attemptCount",
DROP COLUMN "email",
DROP COLUMN "otpHash",
ADD COLUMN     "tokenHash" TEXT NOT NULL,
ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_tokenHash_key" ON "EmailVerification"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerification_tokenHash_idx" ON "EmailVerification"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerification_purpose_idx" ON "EmailVerification"("purpose");
