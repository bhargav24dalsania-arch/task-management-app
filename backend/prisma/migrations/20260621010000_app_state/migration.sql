CREATE TABLE "AppState" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "state" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "score" INTEGER NOT NULL DEFAULT 0,
  "clientUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppState_key_key" ON "AppState"("key");
