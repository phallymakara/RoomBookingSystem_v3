-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "decisionAt" TIMESTAMP(3),
ADD COLUMN     "decisionByUserId" TEXT,
ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "reason" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "public"."RoomOpenHour" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startHHMM" TEXT NOT NULL,
    "endHHMM" TEXT NOT NULL,

    CONSTRAINT "RoomOpenHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoomClosure" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "RoomClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminNotification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomClosure_roomId_startDate_endDate_idx" ON "public"."RoomClosure"("roomId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_decisionByUserId_fkey" FOREIGN KEY ("decisionByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomOpenHour" ADD CONSTRAINT "RoomOpenHour_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomClosure" ADD CONSTRAINT "RoomClosure_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminNotification" ADD CONSTRAINT "AdminNotification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
