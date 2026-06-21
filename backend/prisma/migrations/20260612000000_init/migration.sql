CREATE TYPE "Role" AS ENUM ('MASTER_ADMIN', 'ADMIN', 'SENIOR', 'REVIEWER', 'PREPARER');
CREATE TYPE "ClientType" AS ENUM ('B2B', 'B2C');
CREATE TYPE "Priority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROCESS', 'ON_HOLD', 'SENT_TO_REVIEWER', 'COMPLETED');
CREATE TYPE "TaskType" AS ENUM ('STANDARD', 'RECURRING');
CREATE TYPE "TimeSource" AS ENUM ('TIMER', 'MANUAL', 'EOD');
CREATE TYPE "PlanStatus" AS ENUM ('SUBMITTED', 'REVIEWED', 'CLARIFICATION_REQUESTED');

CREATE TABLE "Company" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "settings" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "dateOfJoining" TIMESTAMP(3),
  "designation" TEXT,
  "education" TEXT,
  "role" "Role" NOT NULL,
  "managerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ClientType" NOT NULL,
  "managerId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "preparerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3),
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScopeOfWork" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "deliverables" TEXT NOT NULL,
  "priority" "Priority" NOT NULL,
  "estimateHours" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScopeOfWork_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Task" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT,
  "clientId" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "deliverables" TEXT NOT NULL,
  "priority" "Priority" NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "estimateHours" DOUBLE PRECISION NOT NULL,
  "assigneeId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "type" "TaskType" NOT NULL DEFAULT 'STANDARD',
  "recurrenceRule" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StatusHistory" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "changedById" TEXT,
  "previousStatus" "TaskStatus",
  "newStatus" "TaskStatus" NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskComment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "requiredCorrections" TEXT,
  "expectedResubmissionDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimeEntry" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "hours" DOUBLE PRECISION NOT NULL,
  "note" TEXT NOT NULL,
  "source" "TimeSource" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DayPlan" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "managerId" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "status" "PlanStatus" NOT NULL DEFAULT 'SUBMITTED',
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DayPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DayPlanItem" (
  "id" TEXT NOT NULL,
  "dayPlanId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL,
  "priority" "Priority" NOT NULL,
  "expectedHours" DOUBLE PRECISION NOT NULL,
  "remarks" TEXT,
  CONSTRAINT "DayPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EodReport" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "managerId" TEXT,
  "taskId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "actualHours" DOUBLE PRECISION NOT NULL,
  "completed" TEXT NOT NULL,
  "inProgress" TEXT,
  "blockers" TEXT,
  "pendingWork" TEXT,
  "reason" TEXT,
  "comments" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EodReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'Normal',
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "previousValue" TEXT,
  "newValue" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
  "id" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "permission" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Client_companyId_name_key" ON "Client"("companyId", "name");
CREATE UNIQUE INDEX "Project_companyId_name_key" ON "Project"("companyId", "name");
CREATE UNIQUE INDEX "ScopeOfWork_clientId_title_key" ON "ScopeOfWork"("clientId", "title");
CREATE UNIQUE INDEX "RolePermission_role_permission_key" ON "RolePermission"("role", "permission");

CREATE INDEX "Task_companyId_status_idx" ON "Task"("companyId", "status");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_reviewerId_idx" ON "Task"("reviewerId");
CREATE INDEX "TimeEntry_companyId_date_idx" ON "TimeEntry"("companyId", "date");
CREATE INDEX "StatusHistory_taskId_createdAt_idx" ON "StatusHistory"("taskId", "createdAt");

ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_preparerId_fkey" FOREIGN KEY ("preparerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScopeOfWork" ADD CONSTRAINT "ScopeOfWork_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScopeOfWork" ADD CONSTRAINT "ScopeOfWork_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "ScopeOfWork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DayPlan" ADD CONSTRAINT "DayPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DayPlan" ADD CONSTRAINT "DayPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DayPlanItem" ADD CONSTRAINT "DayPlanItem_dayPlanId_fkey" FOREIGN KEY ("dayPlanId") REFERENCES "DayPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EodReport" ADD CONSTRAINT "EodReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EodReport" ADD CONSTRAINT "EodReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
