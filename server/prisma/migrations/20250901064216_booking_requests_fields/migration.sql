-- AlterTable
ALTER TABLE "public"."Booking" ADD COLUMN     "reason" TEXT,
ADD COLUMN     "studentId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING';
