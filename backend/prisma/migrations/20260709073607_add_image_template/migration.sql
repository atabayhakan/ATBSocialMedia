-- CreateEnum
CREATE TYPE "PanelPosition" AS ENUM ('TOP', 'CENTER', 'BOTTOM');

-- CreateEnum
CREATE TYPE "TextColor" AS ENUM ('LIGHT', 'DARK');

-- CreateTable
CREATE TABLE "ImageTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "backgroundPath" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 1080,
    "height" INTEGER NOT NULL DEFAULT 1350,
    "panelPosition" "PanelPosition" NOT NULL DEFAULT 'BOTTOM',
    "textColor" "TextColor" NOT NULL DEFAULT 'LIGHT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageTemplate_userId_idx" ON "ImageTemplate"("userId");

-- AddForeignKey
ALTER TABLE "ImageTemplate" ADD CONSTRAINT "ImageTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
