/*
  Warnings:

  - You are about to drop the column `cancelReason` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `cancelledAt` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `decisionAt` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `decisionByUserId` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `decisionNote` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `Booking` table. All the data in the column will be lost.
  - You are about to drop the column `building` on the `Floor` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Floor` table. All the data in the column will be lost.
  - You are about to drop the column `level` on the `Floor` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Floor` table. All the data in the column will be lost.
  - You are about to drop the column `building` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `floor` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Room` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Floor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[floorId,name]` on the table `Room` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `floorId` to the `Room` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Booking" DROP CONSTRAINT "Booking_decisionByUserId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Booking" DROP CONSTRAINT "Booking_roomId_fkey";

-- DropIndex
DROP INDEX "public"."Floor_building_level_key";

-- DropIndex
DROP INDEX "public"."Room_name_key";

-- AlterTable
ALTER TABLE "public"."Booking" DROP COLUMN "cancelReason",
DROP COLUMN "cancelledAt",
DROP COLUMN "decisionAt",
DROP COLUMN "decisionByUserId",
DROP COLUMN "decisionNote",
DROP COLUMN "reason",
ADD COLUMN     "decidedById" TEXT,
ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';

-- AlterTable
ALTER TABLE "public"."Floor" DROP COLUMN "building",
DROP COLUMN "isActive",
DROP COLUMN "level",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "public"."Room" DROP COLUMN "building",
DROP COLUMN "floor",
DROP COLUMN "isActive",
ADD COLUMN     "floorId" TEXT NOT NULL,
ALTER COLUMN "capacity" SET DEFAULT 4,
ALTER COLUMN "equipment" SET DEFAULT '{}';

-- CreateIndex
CREATE UNIQUE INDEX "Floor_name_key" ON "public"."Floor"("name");

-- CreateIndex
CREATE INDEX "Room_floorId_idx" ON "public"."Room"("floorId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_floorId_name_key" ON "public"."Room"("floorId", "name");

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "public"."Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
