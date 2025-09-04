/*
  Warnings:

  - A unique constraint covering the columns `[buildingId,name]` on the table `Floor` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `buildingId` to the `Floor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Floor` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."RoomClosure" DROP CONSTRAINT "RoomClosure_roomId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RoomOpenHour" DROP CONSTRAINT "RoomOpenHour_roomId_fkey";

-- DropIndex
DROP INDEX "public"."Floor_name_key";

-- AlterTable
ALTER TABLE "public"."Floor" ADD COLUMN     "buildingId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "public"."Building" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Building_name_key" ON "public"."Building"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_buildingId_name_key" ON "public"."Floor"("buildingId", "name");

-- AddForeignKey
ALTER TABLE "public"."Floor" ADD CONSTRAINT "Floor_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "public"."Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomOpenHour" ADD CONSTRAINT "RoomOpenHour_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomClosure" ADD CONSTRAINT "RoomClosure_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
