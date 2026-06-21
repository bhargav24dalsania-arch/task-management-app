CREATE TYPE "TimerStatus" AS ENUM ('RUNNING', 'STOPPED');

CREATE TABLE "TimerSession" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stoppedAt" TIMESTAMP(3),
  "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
  "status" "TimerStatus" NOT NULL DEFAULT 'RUNNING',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimerSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimerSession_companyId_userId_status_idx" ON "TimerSession"("companyId", "userId", "status");
CREATE INDEX "TimerSession_taskId_idx" ON "TimerSession"("taskId");

ALTER TABLE "TimerSession" ADD CONSTRAINT "TimerSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimerSession" ADD CONSTRAINT "TimerSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimerSession" ADD CONSTRAINT "TimerSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
