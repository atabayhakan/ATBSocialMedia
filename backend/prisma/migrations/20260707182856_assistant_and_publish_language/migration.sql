-- AlterTable
ALTER TABLE "CanvaConfig" ADD COLUMN     "defaultTemplateId" TEXT;

-- AlterTable
ALTER TABLE "NewsSource" ADD COLUMN     "targetLanguage" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "publishLanguage" TEXT NOT NULL DEFAULT 'tr';

-- CreateTable
CREATE TABLE "AssistantConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "apiKey" TEXT,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://openrouter.ai/api/v1',
    "model" TEXT NOT NULL DEFAULT 'qwen/qwen3-next-80b-a3b-instruct:free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistantConfig_userId_key" ON "AssistantConfig"("userId");

-- CreateIndex
CREATE INDEX "AssistantMessage_userId_createdAt_idx" ON "AssistantMessage"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssistantConfig" ADD CONSTRAINT "AssistantConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
