-- CreateTable
CREATE TABLE "public"."RoomSlotNote" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startHHMM" TEXT NOT NULL,
    "endHHMM" TEXT NOT NULL,
    "professor" TEXT NOT NULL DEFAULT '',
    "course" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RoomSlotNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomSlotNote_roomId_weekday_startHHMM_endHHMM_key" ON "public"."RoomSlotNote"("roomId", "weekday", "startHHMM", "endHHMM");

-- AddForeignKey
ALTER TABLE "public"."RoomSlotNote" ADD CONSTRAINT "RoomSlotNote_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
