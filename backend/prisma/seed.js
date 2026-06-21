import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo", 12);

  await prisma.auditLog.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.eodReport.deleteMany();
  await prisma.dayPlanItem.deleteMany();
  await prisma.dayPlan.deleteMany();
  await prisma.timerSession.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.task.deleteMany();
  await prisma.scopeOfWork.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const global = await prisma.company.create({ data: { name: "Global Control", code: "GLOBAL", settings: "Master platform administration" } });
  const acme = await prisma.company.create({ data: { name: "Acme Services Pvt Ltd", code: "ACME", settings: "Standard approval workflow" } });
  const nova = await prisma.company.create({ data: { name: "Nova Retail LLP", code: "NOVA", settings: "Retail client support workflow" } });

  const master = await prisma.user.create({
    data: { companyId: global.id, name: "Maya Iyer", email: "master.admin@taskflow.local", passwordHash, dateOfJoining: new Date("2022-01-03"), designation: "Platform Director", education: "MBA", role: "MASTER_ADMIN" }
  });

  const acmeAdmin = await prisma.user.create({
    data: { companyId: acme.id, name: "Anil Desai", email: "anil.desai@acme.local", passwordHash, dateOfJoining: new Date("2022-06-15"), designation: "Operations Admin", education: "B.Com", role: "ADMIN", managerId: master.id }
  });
  const acmeSenior = await prisma.user.create({
    data: { companyId: acme.id, name: "Raj Malhotra", email: "raj.malhotra@acme.local", passwordHash, dateOfJoining: new Date("2023-02-01"), designation: "Senior Manager", education: "MBA", role: "SENIOR", managerId: acmeAdmin.id }
  });
  const acmeReviewer = await prisma.user.create({
    data: { companyId: acme.id, name: "Anita Sharma", email: "anita.sharma@acme.local", passwordHash, dateOfJoining: new Date("2023-07-10"), designation: "Reviewer Lead", education: "B.Com", role: "REVIEWER", managerId: acmeSenior.id }
  });
  const acmePreparer = await prisma.user.create({
    data: { companyId: acme.id, name: "Neha Verma", email: "neha.verma@acme.local", passwordHash, dateOfJoining: new Date("2024-01-16"), designation: "Process Associate", education: "BBA", role: "PREPARER", managerId: acmeReviewer.id }
  });

  const novaAdmin = await prisma.user.create({
    data: { companyId: nova.id, name: "Ritesh Shah", email: "ritesh.shah@nova.local", passwordHash, dateOfJoining: new Date("2022-08-22"), designation: "Company Admin", education: "MBA", role: "ADMIN", managerId: master.id }
  });
  const novaSenior = await prisma.user.create({
    data: { companyId: nova.id, name: "Priya Menon", email: "priya.menon@nova.local", passwordHash, dateOfJoining: new Date("2023-03-06"), designation: "Senior Operations Manager", education: "M.Com", role: "SENIOR", managerId: novaAdmin.id }
  });
  const novaReviewer = await prisma.user.create({
    data: { companyId: nova.id, name: "Dev Patel", email: "dev.patel@nova.local", passwordHash, dateOfJoining: new Date("2023-09-18"), designation: "Review Specialist", education: "B.Tech", role: "REVIEWER", managerId: novaSenior.id }
  });
  const novaPreparer = await prisma.user.create({
    data: { companyId: nova.id, name: "Sara Khan", email: "sara.khan@nova.local", passwordHash, dateOfJoining: new Date("2024-02-12"), designation: "Support Executive", education: "B.Com", role: "PREPARER", managerId: novaReviewer.id }
  });

  const northstar = await prisma.client.create({
    data: { companyId: acme.id, name: "Northstar Distribution", type: "B2B", managerId: acmeSenior.id, reviewerId: acmeReviewer.id, preparerId: acmePreparer.id }
  });
  const apex = await prisma.client.create({
    data: { companyId: acme.id, name: "Apex Manufacturing Pvt Ltd", type: "B2B", managerId: acmeSenior.id, reviewerId: acmeReviewer.id, preparerId: acmePreparer.id }
  });
  const metro = await prisma.client.create({
    data: { companyId: nova.id, name: "Metro Retail Walk-in Desk", type: "B2C", managerId: novaSenior.id, reviewerId: novaReviewer.id, preparerId: novaPreparer.id }
  });

  const acmeOps = await prisma.project.create({ data: { companyId: acme.id, clientId: northstar.id, name: "Operations Compliance", status: "Active", dueDate: new Date("2026-06-30") } });
  const acmeTax = await prisma.project.create({ data: { companyId: acme.id, clientId: apex.id, name: "Tax Filing Support", status: "Active", dueDate: new Date("2026-06-20") } });

  const kyc = await prisma.scopeOfWork.create({
    data: { companyId: acme.id, clientId: northstar.id, title: "Client onboarding KYC pack", description: "Collect missing address proof, validate PAN details, and attach the verification summary.", deliverables: "Verified KYC pack and validation summary", priority: "HIGH", estimateHours: 4 }
  });
  const gst = await prisma.scopeOfWork.create({
    data: { companyId: acme.id, clientId: apex.id, title: "GST filing support tracker", description: "Reconcile pending invoices and send variance sheet to tax team for confirmation.", deliverables: "Invoice variance sheet and confirmation tracker", priority: "HIGH", estimateHours: 5 }
  });
  const retail = await prisma.scopeOfWork.create({
    data: { companyId: nova.id, clientId: metro.id, title: "Customer support case audit", description: "Audit open consumer cases and mark SLA risk items.", deliverables: "Case audit list and SLA exception report", priority: "MEDIUM", estimateHours: 3 }
  });

  const task1 = await prisma.task.create({
    data: { companyId: acme.id, projectId: acmeOps.id, clientId: northstar.id, scopeId: kyc.id, title: "KYC pack validation", description: "Validate KYC pack for Northstar.", deliverables: "Approved KYC checklist", priority: "HIGH", dueDate: new Date("2026-06-11"), estimateHours: 4, assigneeId: acmePreparer.id, reviewerId: acmeReviewer.id, createdById: acmeSenior.id, status: "IN_PROCESS" }
  });
  const task2 = await prisma.task.create({
    data: { companyId: acme.id, projectId: acmeTax.id, clientId: apex.id, scopeId: gst.id, title: "GST invoice reconciliation", description: "Prepare GST variance sheet.", deliverables: "Variance sheet", priority: "HIGH", dueDate: new Date("2026-06-12"), estimateHours: 5, assigneeId: acmePreparer.id, reviewerId: acmeReviewer.id, createdById: acmeSenior.id, status: "SENT_TO_REVIEWER", type: "RECURRING", recurrenceRule: "Weekly" }
  });
  const task3 = await prisma.task.create({
    data: { companyId: nova.id, projectId: null, clientId: metro.id, scopeId: retail.id, title: "Retail support SLA audit", description: "Audit consumer support cases.", deliverables: "SLA exception report", priority: "MEDIUM", dueDate: new Date("2026-06-13"), estimateHours: 3, assigneeId: novaPreparer.id, reviewerId: novaReviewer.id, createdById: novaSenior.id }
  });

  await prisma.timeEntry.createMany({
    data: [
      { companyId: acme.id, taskId: task1.id, userId: acmePreparer.id, date: new Date("2026-06-11"), hours: 2.5, note: "Document validation", source: "MANUAL" },
      { companyId: acme.id, taskId: task2.id, userId: acmeReviewer.id, date: new Date("2026-06-11"), hours: 1.25, note: "Reviewer check", source: "MANUAL" },
      { companyId: nova.id, taskId: task3.id, userId: novaPreparer.id, date: new Date("2026-06-11"), hours: 1.75, note: "Case review", source: "MANUAL" }
    ]
  });

  const permissions = {
    MASTER_ADMIN: ["company.manage", "master.manage", "task.manage", "task.recurring", "time.view", "reports.view", "audit.view"],
    ADMIN: ["master.view", "client.manage", "scope.manage", "user.manage", "task.manage", "task.recurring", "time.view", "reports.view", "audit.view"],
    SENIOR: ["client.manage", "scope.manage", "task.manage", "task.recurring", "time.view", "reports.view"],
    REVIEWER: ["task.create", "task.review", "time.log", "planning.submit"],
    PREPARER: ["task.create", "task.update", "time.log", "planning.submit"]
  };
  await prisma.rolePermission.createMany({
    data: Object.entries(permissions).flatMap(([role, values]) => values.map(permission => ({ role, permission })))
  });

  await prisma.statusHistory.createMany({
    data: [
      { companyId: acme.id, taskId: task1.id, changedById: acmeSenior.id, previousStatus: "NOT_STARTED", newStatus: "IN_PROCESS", reason: "Seeded in-process task" },
      { companyId: acme.id, taskId: task2.id, changedById: acmePreparer.id, previousStatus: "IN_PROCESS", newStatus: "SENT_TO_REVIEWER", reason: "Seeded review request" },
      { companyId: nova.id, taskId: task3.id, changedById: novaSenior.id, previousStatus: null, newStatus: "NOT_STARTED", reason: "Seeded task creation" }
    ]
  });

  await prisma.notification.createMany({
    data: [
      { companyId: acme.id, recipientId: acmePreparer.id, category: "Task Assignment", title: "Task assigned", message: "KYC pack validation is assigned to you.", entityType: "task", entityId: task1.id, priority: "HIGH" },
      { companyId: acme.id, recipientId: acmeReviewer.id, category: "Review Request", title: "Task sent to reviewer", message: "GST invoice reconciliation is waiting for your review.", entityType: "task", entityId: task2.id, priority: "HIGH" },
      { companyId: nova.id, recipientId: novaPreparer.id, category: "Task Assignment", title: "Task assigned", message: "Retail support SLA audit is assigned to you.", entityType: "task", entityId: task3.id, priority: "MEDIUM" }
    ]
  });

  await prisma.auditLog.create({
    data: { companyId: acme.id, userId: acmeSenior.id, action: "Task Creation", entity: "KYC pack validation", previousValue: "-", newValue: "IN_PROCESS" }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Demo data created.");
  })
  .catch(async error => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
