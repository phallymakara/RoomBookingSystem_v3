-- CreateTable
CREATE TABLE "public"."Setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "campusName" VARCHAR(100) NOT NULL,
    "defaultOpenStart" VARCHAR(5) NOT NULL,
    "defaultOpenEnd" VARCHAR(5) NOT NULL,
    "telegramLink" VARCHAR(255),
    "autoCancelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoCancelGraceMinutes" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);
