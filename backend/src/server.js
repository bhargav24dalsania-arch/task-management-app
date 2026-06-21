import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma.js";
import {
  adminOrAbove,
  isMasterAdmin,
  requireAuth,
  requireRoles,
  seniorOrAbove,
  serializeUser,
  signUser,
  tenantCompanyId,
  tenantWhere
} from "./auth.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000,http://127.0.0.1:3000")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || corsOrigins.includes("*") || corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));
app.use(express.json({ limit: "25mb" }));

app.use((req, res, next) => {
  if (req.url === "/api") req.url = "/";
  else if (req.url.startsWith("/api/")) req.url = req.url.slice(4);
  next();
});

const userSelect = {
  id: true,
  companyId: true,
  name: true,
  email: true,
  role: true,
  managerId: true,
  designation: true,
  education: true,
  dateOfJoining: true,
  endDate: true
};

const taskInclude = {
  company: { select: { id: true, name: true, code: true, startDate: true, endDate: true } },
  client: { select: { id: true, name: true, type: true, startDate: true, endDate: true } },
  scope: { select: { id: true, title: true, estimateHours: true } },
  project: { select: { id: true, name: true, clientId: true, startDate: true, endDate: true } },
  assignee: { select: userSelect },
  reviewer: { select: userSelect },
  createdBy: { select: userSelect },
  comments: { orderBy: { createdAt: "desc" }, take: 3 },
  statusHistory: { orderBy: { createdAt: "desc" }, take: 5 },
  timeEntries: true
};

const companySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  settings: z.string().optional().nullable()
});

const userSchema = z.object({
  companyId: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(4).optional(),
  dateOfJoining: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  education: z.string().optional().nullable(),
  role: z.enum(["MASTER_ADMIN", "ADMIN", "SENIOR", "REVIEWER", "PREPARER"]),
  managerId: z.string().optional().nullable()
});

const clientSchema = z.object({
  companyId: z.string().optional(),
  name: z.string().min(1),
  type: z.enum(["B2B", "B2C"]),
  managerId: z.string().min(1),
  reviewerId: z.string().min(1),
  preparerId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable()
});

const projectSchema = z.object({
  companyId: z.string().optional(),
  clientId: z.string().min(1),
  name: z.string().min(1),
  status: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable()
});

const scopeSchema = z.object({
  companyId: z.string().optional(),
  clientId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  deliverables: z.string().min(1),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  estimateHours: z.coerce.number().positive()
});

const taskSchema = z.object({
  companyId: z.string().optional(),
  projectId: z.string().optional().nullable(),
  clientId: z.string().min(1),
  scopeId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  deliverables: z.string().min(1),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  dueDate: z.string().min(1),
  estimateHours: z.coerce.number().positive(),
  assigneeId: z.string().min(1),
  reviewerId: z.string().min(1),
  type: z.enum(["STANDARD", "RECURRING"]).default("STANDARD"),
  recurrenceRule: z.string().optional().nullable()
});

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function parseDate(value) {
  return new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
}

function parseOptionalDate(value) {
  return value ? parseDate(value) : null;
}

function dateKey(value) {
  if (!value) return "";
  return (value instanceof Date ? value : parseDate(value)).toISOString().slice(0, 10);
}

function dateRangeError(startDate, endDate, message) {
  return startDate && endDate && dateKey(startDate) > dateKey(endDate) ? message : "";
}

function activeRangeError(startDate, endDate, date, beforeMessage, afterMessage = beforeMessage) {
  const current = dateKey(date);
  if (startDate && current < dateKey(startDate)) return beforeMessage;
  if (endDate && current > dateKey(endDate)) return afterMessage;
  return "";
}

function taskDateRangeError(dueDate, startDate, endDate) {
  return activeRangeError(startDate, endDate, dueDate, "Task date cannot be before Start Date.", "Task date cannot be after End Date.");
}

function userAssignableError(user, dueDate) {
  return user?.endDate && dateKey(dueDate) > dateKey(user.endDate) ? "User is inactive and cannot be assigned." : "";
}

async function validateTaskAccess({ companyId, clientId, projectId, dueDate, assigneeId, reviewerId }) {
  const client = await prisma.client.findFirst({ where: { id: clientId, companyId } });
  if (!client) return "Client not found";
  if (client.type === "B2B" && !projectId) return "Project is required for B2B clients. Create a B2B project first.";
  if (client.type !== "B2B" && projectId) return "Project is allowed only for B2B clients.";
  let startDate = client.startDate;
  let endDate = client.endDate;
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
    if (!project) return "Project not found";
    if (project.clientId && project.clientId !== clientId) return "Project does not belong to selected client";
    startDate = project.startDate;
    endDate = project.endDate;
  }
  const dateError = taskDateRangeError(dueDate, startDate, endDate);
  if (dateError) return dateError;

  const users = await prisma.user.findMany({ where: { id: { in: [assigneeId, reviewerId].filter(Boolean) }, companyId } });
  if ([assigneeId, reviewerId].filter(Boolean).some(id => !users.some(user => user.id === id))) return "User is inactive and cannot be assigned.";
  return users.map(user => userAssignableError(user, dueDate)).find(Boolean) || "";
}

function recurringDueDate(baseDate, rule, index) {
  const date = new Date(baseDate);
  const lower = String(rule || "").toLowerCase();
  const customDays = lower.match(/(\d+)\s*day/);

  if (lower.includes("daily")) date.setDate(date.getDate() + index);
  else if (lower.includes("weekly")) date.setDate(date.getDate() + index * 7);
  else if (lower.includes("monthly")) date.setMonth(date.getMonth() + index);
  else if (lower.includes("quarter")) date.setMonth(date.getMonth() + index * 3);
  else if (lower.includes("year")) date.setFullYear(date.getFullYear() + index);
  else if (customDays) date.setDate(date.getDate() + index * Number(customDays[1]));
  else date.setDate(date.getDate() + index * 7);

  return date;
}

async function audit(req, action, entity, previousValue, newValue, companyId) {
  await prisma.auditLog.create({
    data: {
      companyId,
      userId: req.user?.id,
      action,
      entity,
      previousValue: previousValue == null ? null : String(previousValue),
      newValue: newValue == null ? null : String(newValue)
    }
  });
}

async function notify(companyId, recipientId, category, title, message, entityType, entityId, priority = "Normal") {
  if (!recipientId) return;
  await prisma.notification.create({
    data: { companyId, recipientId, category, title, message, entityType, entityId, priority }
  });
}

const legacyStateKey = "taskflow-enterprise-v1";

function stateResponse(record) {
  return {
    ok: true,
    state: record?.state || null,
    score: record?.score || 0,
    updatedAt: record?.clientUpdatedAt?.toISOString() || record?.updatedAt?.toISOString() || null
  };
}

function elapsedSeconds(startedAt, stoppedAt) {
  return Math.max(0, Math.round((stoppedAt.getTime() - new Date(startedAt).getTime()) / 1000));
}

async function stopTimerSession(session, stoppedAt, note = "Timer stopped") {
  if (!session || session.status !== "RUNNING") return session;
  const seconds = elapsedSeconds(session.startedAt, stoppedAt);
  const stopped = await prisma.timerSession.update({
    where: { id: session.id },
    data: {
      stoppedAt,
      elapsedSeconds: seconds,
      status: "STOPPED",
      note
    },
    include: {
      task: { include: { client: true, project: true, scope: true } },
      user: { select: userSelect }
    }
  });

  if (seconds > 0) {
    await prisma.timeEntry.create({
      data: {
        companyId: stopped.companyId,
        taskId: stopped.taskId,
        userId: stopped.userId,
        date: parseDate(stoppedAt.toISOString()),
        hours: Number((seconds / 3600).toFixed(4)),
        note,
        source: "TIMER"
      }
    });
  }

  return stopped;
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "taskflow-api" });
});

app.get("/state", asyncRoute(async (req, res) => {
  const record = await prisma.appState.findUnique({ where: { key: legacyStateKey } });
  res.json(stateResponse(record));
}));

app.post("/state", asyncRoute(async (req, res) => {
  const body = z.object({
    updatedAt: z.string().optional().nullable(),
    score: z.coerce.number().optional().default(0),
    state: z.record(z.any()).optional().nullable()
  }).parse(req.body);

  const clientUpdatedAt = body.updatedAt ? new Date(body.updatedAt) : new Date();
  const safeScore = Math.max(0, Math.min(2147483647, Math.round(Number(body.score || 0))));
  const record = await prisma.appState.upsert({
    where: { key: legacyStateKey },
    create: {
      key: legacyStateKey,
      state: body.state || {},
      score: safeScore,
      clientUpdatedAt
    },
    update: {
      state: body.state || {},
      score: safeScore,
      clientUpdatedAt
    }
  });

  res.json(stateResponse(record));
}));

app.post("/auth/login", asyncRoute(async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email }, include: { company: true } });
  if (!user) return res.status(401).json({ message: "Invalid email or password" });

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: "Invalid email or password" });
  const today = new Date();
  if (activeRangeError(user.company.startDate, user.company.endDate, today, "Your company access is not active. Please contact administrator.", "Your company access is not active. Please contact administrator.")) {
    return res.status(403).json({ message: "Your company access is not active. Please contact administrator." });
  }
  if (user.endDate && dateKey(today) > dateKey(user.endDate)) {
    return res.status(403).json({ message: "User is inactive and cannot log in." });
  }

  res.json({ token: signUser(user), user: serializeUser(user) });
}));

app.use(requireAuth);

app.get("/auth/me", (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

app.get("/roles", (req, res) => {
  res.json([
    { key: "MASTER_ADMIN", label: "Master Admin", level: 5 },
    { key: "ADMIN", label: "Admin", level: 4 },
    { key: "SENIOR", label: "Manager / Senior", level: 3 },
    { key: "REVIEWER", label: "Reviewer", level: 2 },
    { key: "PREPARER", label: "Preparer", level: 1 }
  ]);
});

app.get("/companies", asyncRoute(async (req, res) => {
  const where = isMasterAdmin(req.user) ? {} : { id: req.user.companyId };
  const companies = await prisma.company.findMany({ where, orderBy: { name: "asc" } });
  res.json(companies);
}));

app.post("/companies", requireRoles("MASTER_ADMIN"), asyncRoute(async (req, res) => {
  const body = companySchema.parse(req.body);
  const rangeError = dateRangeError(body.startDate, body.endDate, "Company end date must be same as or after start date.");
  if (rangeError) return res.status(400).json({ message: rangeError });

  const company = await prisma.company.create({
    data: {
      name: body.name,
      code: body.code.toUpperCase(),
      startDate: parseDate(body.startDate),
      endDate: parseOptionalDate(body.endDate),
      settings: body.settings
    }
  });
  await audit(req, "Company Creation", company.name, "-", company.code, company.id);
  res.status(201).json(company);
}));

app.patch("/companies/:id", requireRoles("MASTER_ADMIN"), asyncRoute(async (req, res) => {
  const body = companySchema.partial().parse(req.body);
  const existing = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Company not found" });
  const startDate = body.startDate ? parseDate(body.startDate) : existing.startDate;
  const endDate = body.endDate === undefined ? existing.endDate : parseOptionalDate(body.endDate);
  const rangeError = dateRangeError(startDate, endDate, "Company end date must be same as or after start date.");
  if (rangeError) return res.status(400).json({ message: rangeError });

  const company = await prisma.company.update({
    where: { id: existing.id },
    data: {
      name: body.name,
      code: body.code ? body.code.toUpperCase() : undefined,
      startDate: body.startDate ? parseDate(body.startDate) : undefined,
      endDate: body.endDate === undefined ? undefined : parseOptionalDate(body.endDate),
      settings: body.settings
    }
  });
  await audit(req, "Company Update", company.name, existing.name, company.name, company.id);
  res.json(company);
}));

app.delete("/companies/:id", requireRoles("MASTER_ADMIN"), asyncRoute(async (req, res) => {
  const existing = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: "Company not found" });

  await prisma.company.delete({ where: { id: existing.id } });
  await audit(req, "Company Deletion", existing.name, existing.code, "Deleted", req.user.companyId);
  res.json({ deleted: true });
}));

app.get("/users", asyncRoute(async (req, res) => {
  const users = await prisma.user.findMany({
    where: tenantWhere(req),
    select: userSelect,
    orderBy: { name: "asc" }
  });
  res.json(users);
}));

app.post("/users", requireRoles("MASTER_ADMIN", "ADMIN"), asyncRoute(async (req, res) => {
  const body = userSchema.parse(req.body);
  if (!body.password) return res.status(400).json({ message: "Password is required" });

  const companyId = tenantCompanyId(req, body.companyId);
  if (!companyId) return res.status(400).json({ message: "Company is required" });
  const joiningDate = body.dateOfJoining ? parseDate(body.dateOfJoining) : null;
  const endDate = parseOptionalDate(body.endDate);
  if (joiningDate && endDate && dateKey(endDate) < dateKey(joiningDate)) return res.status(400).json({ message: "User end date must be same as or after Date of Joining." });

  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await prisma.user.create({
    data: {
      companyId,
      name: body.name,
      email: body.email.toLowerCase(),
      passwordHash,
      dateOfJoining: joiningDate,
      endDate,
      designation: body.designation,
      education: body.education,
      role: body.role,
      managerId: body.managerId || null
    },
    select: userSelect
  });

  await audit(req, "User Creation", user.name, "-", user.role, companyId);
  res.status(201).json(user);
}));

app.patch("/users/:id", requireRoles("MASTER_ADMIN", "ADMIN"), asyncRoute(async (req, res) => {
  const body = userSchema.partial().parse(req.body);
  const existing = await prisma.user.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) return res.status(404).json({ message: "User not found" });
  const joiningDate = body.dateOfJoining ? parseDate(body.dateOfJoining) : existing.dateOfJoining;
  const endDate = body.endDate === undefined ? existing.endDate : parseOptionalDate(body.endDate);
  if (joiningDate && endDate && dateKey(endDate) < dateKey(joiningDate)) return res.status(400).json({ message: "User end date must be same as or after Date of Joining." });

  const data = {
    companyId: body.companyId ? tenantCompanyId(req, body.companyId) : undefined,
    name: body.name,
    email: body.email?.toLowerCase(),
    dateOfJoining: body.dateOfJoining ? parseDate(body.dateOfJoining) : undefined,
    endDate: body.endDate === undefined ? undefined : parseOptionalDate(body.endDate),
    designation: body.designation,
    education: body.education,
    role: body.role,
    managerId: body.managerId === undefined ? undefined : body.managerId || null
  };
  if (body.password) data.passwordHash = await bcrypt.hash(body.password, 12);

  const user = await prisma.user.update({ where: { id: existing.id }, data, select: userSelect });
  await audit(req, "User Update", user.name, existing.role, user.role, user.companyId);
  res.json(user);
}));

app.delete("/users/:id", requireRoles("MASTER_ADMIN", "ADMIN"), asyncRoute(async (req, res) => {
  const existing = await prisma.user.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) return res.status(404).json({ message: "User not found" });
  if (existing.id === req.user.id) return res.status(400).json({ message: "You cannot delete your own login" });

  await prisma.user.delete({ where: { id: existing.id } });
  await audit(req, "User Deletion", existing.name, existing.email, "Deleted", existing.companyId);
  res.json({ deleted: true });
}));

app.get("/clients", asyncRoute(async (req, res) => {
  const clients = await prisma.client.findMany({
    where: tenantWhere(req),
    include: {
      manager: { select: userSelect },
      reviewer: { select: userSelect },
      preparer: { select: userSelect },
      company: true
    },
    orderBy: { name: "asc" }
  });
  res.json(clients);
}));

app.post("/clients", requireRoles("MASTER_ADMIN", "ADMIN", "SENIOR"), asyncRoute(async (req, res) => {
  const body = clientSchema.parse(req.body);
  const rangeError = dateRangeError(body.startDate, body.endDate, "Client end date must be same as or after start date.");
  if (rangeError) return res.status(400).json({ message: rangeError });

  const companyId = tenantCompanyId(req, body.companyId);
  const client = await prisma.client.create({
    data: {
      companyId,
      name: body.name,
      type: body.type,
      managerId: body.managerId,
      reviewerId: body.reviewerId,
      preparerId: body.preparerId,
      startDate: parseDate(body.startDate),
      endDate: parseOptionalDate(body.endDate)
    },
    include: { manager: true, reviewer: true, preparer: true }
  });

  await Promise.all([
    notify(companyId, client.managerId, "Client Assignment", "Client assigned", `${client.name} is assigned to you as manager.`, "client", client.id),
    notify(companyId, client.reviewerId, "Client Assignment", "Client assigned", `${client.name} is assigned to you as reviewer.`, "client", client.id),
    notify(companyId, client.preparerId, "Client Assignment", "Client assigned", `${client.name} is assigned to you as preparer.`, "client", client.id),
    audit(req, "Client Creation", client.name, "-", body.type, companyId)
  ]);

  res.status(201).json(client);
}));

app.patch("/clients/:id", requireRoles("MASTER_ADMIN", "ADMIN", "SENIOR"), asyncRoute(async (req, res) => {
  const body = clientSchema.partial().parse(req.body);
  const existing = await prisma.client.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) return res.status(404).json({ message: "Client not found" });
  const startDate = body.startDate ? parseDate(body.startDate) : existing.startDate;
  const endDate = body.endDate === undefined ? existing.endDate : parseOptionalDate(body.endDate);
  const rangeError = dateRangeError(startDate, endDate, "Client end date must be same as or after start date.");
  if (rangeError) return res.status(400).json({ message: rangeError });

  const client = await prisma.client.update({
    where: { id: existing.id },
    data: {
      companyId: body.companyId ? tenantCompanyId(req, body.companyId) : undefined,
      name: body.name,
      type: body.type,
      managerId: body.managerId,
      reviewerId: body.reviewerId,
      preparerId: body.preparerId,
      startDate: body.startDate ? parseDate(body.startDate) : undefined,
      endDate: body.endDate === undefined ? undefined : parseOptionalDate(body.endDate)
    },
    include: { manager: { select: userSelect }, reviewer: { select: userSelect }, preparer: { select: userSelect }, company: true }
  });
  await audit(req, "Client Update", client.name, existing.name, client.name, client.companyId);
  res.json(client);
}));

app.delete("/clients/:id", requireRoles("MASTER_ADMIN", "ADMIN", "SENIOR"), asyncRoute(async (req, res) => {
  const existing = await prisma.client.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) return res.status(404).json({ message: "Client not found" });

  await prisma.client.delete({ where: { id: existing.id } });
  await audit(req, "Client Deletion", existing.name, existing.type, "Deleted", existing.companyId);
  res.json({ deleted: true });
}));

app.get("/scopes", asyncRoute(async (req, res) => {
  const scopes = await prisma.scopeOfWork.findMany({
    where: tenantWhere(req, req.query.clientId ? { clientId: req.query.clientId } : {}),
    include: { client: true, company: true },
    orderBy: { title: "asc" }
  });
  res.json(scopes);
}));

app.post("/scopes", requireRoles("MASTER_ADMIN", "ADMIN", "SENIOR"), asyncRoute(async (req, res) => {
  const body = scopeSchema.parse(req.body);

  const companyId = tenantCompanyId(req, body.companyId);
  const scope = await prisma.scopeOfWork.create({ data: { ...body, companyId } });
  await audit(req, "Scope Creation", scope.title, "-", `${scope.estimateHours} hours`, companyId);
  res.status(201).json(scope);
}));

app.patch("/scopes/:id", requireRoles("MASTER_ADMIN", "ADMIN", "SENIOR"), asyncRoute(async (req, res) => {
  const body = scopeSchema.partial().parse(req.body);
  const existing = await prisma.scopeOfWork.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) return res.status(404).json({ message: "Scope of work not found" });

  const scope = await prisma.scopeOfWork.update({
    where: { id: existing.id },
    data: { ...body, companyId: body.companyId ? tenantCompanyId(req, body.companyId) : undefined },
    include: { client: true, company: true }
  });
  await audit(req, "Scope Update", scope.title, existing.title, scope.title, scope.companyId);
  res.json(scope);
}));

app.delete("/scopes/:id", requireRoles("MASTER_ADMIN", "ADMIN", "SENIOR"), asyncRoute(async (req, res) => {
  const existing = await prisma.scopeOfWork.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) return res.status(404).json({ message: "Scope of work not found" });

  await prisma.scopeOfWork.delete({ where: { id: existing.id } });
  await audit(req, "Scope Deletion", existing.title, existing.priority, "Deleted", existing.companyId);
  res.json({ deleted: true });
}));

app.get("/projects", asyncRoute(async (req, res) => {
  const projects = await prisma.project.findMany({ where: tenantWhere(req), orderBy: { name: "asc" } });
  res.json(projects);
}));

app.post("/projects", requireRoles("MASTER_ADMIN", "ADMIN", "SENIOR"), asyncRoute(async (req, res) => {
  const body = projectSchema.parse(req.body);
  const client = await prisma.client.findFirst({ where: tenantWhere(req, { id: body.clientId }) });
  if (!client) return res.status(404).json({ message: "Client not found" });
  if (client.type !== "B2B") return res.status(400).json({ message: "Project can be created only under B2B clients." });
  if (client.startDate && dateKey(body.startDate) < dateKey(client.startDate)) return res.status(400).json({ message: "Project Start Date cannot be before Client Start Date." });
  const rangeError = dateRangeError(body.startDate, body.endDate, "Project end date must be same as or after start date.");
  if (rangeError) return res.status(400).json({ message: rangeError });
  const companyId = client.companyId;
  const project = await prisma.project.create({
    data: {
      companyId,
      clientId: client.id,
      name: body.name,
      status: body.status,
      startDate: parseDate(body.startDate),
      endDate: parseOptionalDate(body.endDate),
      dueDate: body.dueDate ? parseDate(body.dueDate) : null
    }
  });
  await audit(req, "Project Creation", project.name, "-", project.status, companyId);
  res.status(201).json(project);
}));

app.patch("/projects/:id", requireRoles("MASTER_ADMIN", "ADMIN", "SENIOR"), asyncRoute(async (req, res) => {
  const body = projectSchema.partial().parse(req.body);
  const existing = await prisma.project.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) return res.status(404).json({ message: "Project not found" });
  const clientId = body.clientId === undefined ? existing.clientId : body.clientId;
  const client = clientId ? await prisma.client.findFirst({ where: tenantWhere(req, { id: clientId }) }) : null;
  if (clientId && !client) return res.status(404).json({ message: "Client not found" });
  if (client && client.type !== "B2B") return res.status(400).json({ message: "Project can be created only under B2B clients." });
  const startDate = body.startDate ? parseDate(body.startDate) : existing.startDate;
  const endDate = body.endDate === undefined ? existing.endDate : parseOptionalDate(body.endDate);
  if (client?.startDate && dateKey(startDate) < dateKey(client.startDate)) return res.status(400).json({ message: "Project Start Date cannot be before Client Start Date." });
  const rangeError = dateRangeError(startDate, endDate, "Project end date must be same as or after start date.");
  if (rangeError) return res.status(400).json({ message: rangeError });

  const project = await prisma.project.update({
    where: { id: existing.id },
    data: {
      companyId: client ? client.companyId : body.companyId ? tenantCompanyId(req, body.companyId) : undefined,
      clientId: body.clientId === undefined ? undefined : body.clientId,
      name: body.name,
      status: body.status,
      startDate: body.startDate ? parseDate(body.startDate) : undefined,
      endDate: body.endDate === undefined ? undefined : parseOptionalDate(body.endDate),
      dueDate: body.dueDate ? parseDate(body.dueDate) : body.dueDate === null ? null : undefined
    }
  });
  await audit(req, "Project Update", project.name, existing.status, project.status, project.companyId);
  res.json(project);
}));

app.delete("/projects/:id", requireRoles("MASTER_ADMIN", "ADMIN", "SENIOR"), asyncRoute(async (req, res) => {
  const existing = await prisma.project.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) return res.status(404).json({ message: "Project not found" });

  await prisma.project.delete({ where: { id: existing.id } });
  await audit(req, "Project Deletion", existing.name, existing.status, "Deleted", existing.companyId);
  res.json({ deleted: true });
}));

app.get("/tasks", asyncRoute(async (req, res) => {
  const where = tenantWhere(req);
  if (req.query.status) where.status = req.query.status;
  if (req.query.clientId) where.clientId = req.query.clientId;
  if (req.query.userId) where.OR = [{ assigneeId: req.query.userId }, { reviewerId: req.query.userId }];

  if (!adminOrAbove(req.user) && !seniorOrAbove(req.user)) {
    where.OR = [
      { assigneeId: req.user.id },
      { reviewerId: req.user.id },
      { createdById: req.user.id }
    ];
  }

  const tasks = await prisma.task.findMany({ where, include: taskInclude, orderBy: { dueDate: "asc" } });
  res.json(tasks);
}));

async function createTask(req, res, forcedType) {
  const body = taskSchema.parse(forcedType ? { ...req.body, type: forcedType } : req.body);
  if (body.type === "RECURRING" && !seniorOrAbove(req.user)) {
    return res.status(403).json({ message: "Recurring tasks can be created by Senior and above only" });
  }

  const companyId = tenantCompanyId(req, body.companyId);
  if (!companyId) return res.status(400).json({ message: "Company is required" });

  const baseDate = parseDate(body.dueDate);
  const baseValidationError = await validateTaskAccess({
    companyId,
    clientId: body.clientId,
    projectId: body.projectId || null,
    dueDate: baseDate,
    assigneeId: body.assigneeId,
    reviewerId: body.reviewerId
  });
  if (baseValidationError) return res.status(400).json({ message: baseValidationError });
  const copyCount = body.type === "RECURRING" ? 6 : 1;
  const created = [];

  for (let index = 0; index < copyCount; index += 1) {
    const dueDate = body.type === "RECURRING" ? recurringDueDate(baseDate, body.recurrenceRule, index) : baseDate;
    const copyValidationError = await validateTaskAccess({
      companyId,
      clientId: body.clientId,
      projectId: body.projectId || null,
      dueDate,
      assigneeId: body.assigneeId,
      reviewerId: body.reviewerId
    });
    if (copyValidationError) break;
    const task = await prisma.task.create({
      data: {
        companyId,
        projectId: body.projectId || null,
        clientId: body.clientId,
        scopeId: body.scopeId,
        title: index === 0 ? body.title : `${body.title} (${index + 1})`,
        description: body.description,
        deliverables: body.deliverables,
        priority: body.priority,
        dueDate,
        estimateHours: body.estimateHours,
        assigneeId: body.assigneeId,
        reviewerId: body.reviewerId,
        createdById: req.user.id,
        type: body.type,
        recurrenceRule: body.recurrenceRule || null
      },
      include: taskInclude
    });
    created.push(task);
    await prisma.statusHistory.create({
      data: {
        companyId,
        taskId: task.id,
        changedById: req.user.id,
        previousStatus: null,
        newStatus: task.status,
        reason: "Task created"
      }
    });
  }

  await Promise.all([
    notify(companyId, body.assigneeId, "Task Assignment", "Task assigned", `${created[0].title} is assigned to you.`, "task", created[0].id, body.priority),
    notify(companyId, body.reviewerId, "Task Assignment", "Review task mapped", `${created[0].title} is mapped to you for review.`, "task", created[0].id, body.priority),
    audit(req, "Task Creation", created[0].title, "-", created[0].status, companyId)
  ]);

  res.status(201).json(body.type === "RECURRING" ? created : created[0]);
}

app.post("/tasks", asyncRoute(async (req, res) => createTask(req, res)));

app.get("/recurring-tasks", asyncRoute(async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: tenantWhere(req, { type: "RECURRING" }),
    include: taskInclude,
    orderBy: { dueDate: "asc" }
  });
  res.json(tasks);
}));

app.post("/recurring-tasks", asyncRoute(async (req, res) => createTask(req, res, "RECURRING")));

app.patch("/tasks/:id", asyncRoute(async (req, res) => {
  const body = taskSchema.partial().parse(req.body);
  const existing = await prisma.task.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) return res.status(404).json({ message: "Task not found" });
  if ((existing.type === "RECURRING" || body.type === "RECURRING") && !seniorOrAbove(req.user)) {
    return res.status(403).json({ message: "Recurring tasks can be edited by Senior and above only" });
  }
  const companyId = body.companyId ? tenantCompanyId(req, body.companyId) : existing.companyId;
  const dueDate = body.dueDate ? parseDate(body.dueDate) : existing.dueDate;
  const patchValidationError = await validateTaskAccess({
    companyId,
    clientId: body.clientId || existing.clientId,
    projectId: body.projectId === undefined ? existing.projectId : body.projectId || null,
    dueDate,
    assigneeId: body.assigneeId || existing.assigneeId,
    reviewerId: body.reviewerId || existing.reviewerId
  });
  if (patchValidationError) return res.status(400).json({ message: patchValidationError });

  const updated = await prisma.task.update({
    where: { id: existing.id },
    data: {
      companyId: body.companyId ? tenantCompanyId(req, body.companyId) : undefined,
      projectId: body.projectId === undefined ? undefined : body.projectId || null,
      clientId: body.clientId,
      scopeId: body.scopeId,
      title: body.title,
      description: body.description,
      deliverables: body.deliverables,
      priority: body.priority,
      dueDate: body.dueDate ? parseDate(body.dueDate) : undefined,
      estimateHours: body.estimateHours,
      assigneeId: body.assigneeId,
      reviewerId: body.reviewerId,
      type: body.type,
      recurrenceRule: body.recurrenceRule === undefined ? undefined : body.recurrenceRule || null
    },
    include: taskInclude
  });

  await audit(req, "Task Update", updated.title, existing.title, updated.title, updated.companyId);
  if (body.dueDate && existing.dueDate.toISOString().slice(0, 10) !== body.dueDate.slice(0, 10)) {
    await audit(req, "Due Date Change", updated.title, existing.dueDate.toISOString().slice(0, 10), body.dueDate, updated.companyId);
  }
  res.json(updated);
}));

app.delete("/tasks/:id", asyncRoute(async (req, res) => {
  const existing = await prisma.task.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) return res.status(404).json({ message: "Task not found" });
  if (!seniorOrAbove(req.user) && req.user.id !== existing.createdById) {
    return res.status(403).json({ message: "Permission denied" });
  }

  await prisma.task.delete({ where: { id: existing.id } });
  await audit(req, "Task Deletion", existing.title, existing.status, "Deleted", existing.companyId);
  res.json({ deleted: true });
}));

app.patch("/tasks/:id/status", asyncRoute(async (req, res) => {
  const body = z.object({
    status: z.enum(["NOT_STARTED", "IN_PROCESS", "ON_HOLD", "SENT_TO_REVIEWER", "COMPLETED"]),
    reason: z.string().optional(),
    comment: z.string().optional(),
    requiredCorrections: z.string().optional(),
    expectedResubmissionDate: z.string().optional()
  }).parse(req.body);

  const task = await prisma.task.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!task) return res.status(404).json({ message: "Task not found" });
  if (body.status === "COMPLETED" && req.user.id !== task.reviewerId && !seniorOrAbove(req.user)) {
    return res.status(403).json({ message: "Only reviewer or senior level can complete a task" });
  }

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { status: body.status },
    include: taskInclude
  });

  await prisma.statusHistory.create({
    data: {
      companyId: task.companyId,
      taskId: task.id,
      changedById: req.user.id,
      previousStatus: task.status,
      newStatus: body.status,
      reason: body.reason || body.comment || "Status update"
    }
  });

  if (body.comment || body.reason) {
    await prisma.taskComment.create({
      data: {
        taskId: task.id,
        userId: req.user.id,
        action: body.status,
        reason: body.reason || "Status update",
        text: body.comment || body.reason || "Status updated",
        requiredCorrections: body.requiredCorrections,
        expectedResubmissionDate: body.expectedResubmissionDate ? parseDate(body.expectedResubmissionDate) : null
      }
    });
  }

  if (body.status === "SENT_TO_REVIEWER") {
    await notify(task.companyId, task.reviewerId, "Review Request", "Task sent to reviewer", `${task.title} is ready for review.`, "task", task.id, "High");
  }

  await audit(req, "Status Change", task.title, task.status, body.status, task.companyId);
  res.json(updated);
}));

app.get("/tasks/:id/status-history", asyncRoute(async (req, res) => {
  const task = await prisma.task.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!task) return res.status(404).json({ message: "Task not found" });

  const history = await prisma.statusHistory.findMany({
    where: { taskId: task.id },
    include: { changedBy: { select: userSelect } },
    orderBy: { createdAt: "desc" }
  });
  res.json(history);
}));

app.post("/tasks/:id/comments", asyncRoute(async (req, res) => {
  const body = z.object({
    action: z.string().min(1).default("Comment"),
    reason: z.string().min(1),
    text: z.string().min(1),
    requiredCorrections: z.string().optional(),
    expectedResubmissionDate: z.string().optional()
  }).parse(req.body);

  const task = await prisma.task.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!task) return res.status(404).json({ message: "Task not found" });

  const comment = await prisma.taskComment.create({
    data: {
      taskId: task.id,
      userId: req.user.id,
      action: body.action,
      reason: body.reason,
      text: body.text,
      requiredCorrections: body.requiredCorrections,
      expectedResubmissionDate: body.expectedResubmissionDate ? parseDate(body.expectedResubmissionDate) : null
    }
  });
  await audit(req, "Task Comment", task.title, "-", body.reason, task.companyId);
  res.status(201).json(comment);
}));

app.get("/comments", asyncRoute(async (req, res) => {
  const comments = await prisma.taskComment.findMany({
    where: { task: { is: tenantWhere(req) } },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          client: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          scope: { select: { id: true, title: true } }
        }
      },
      user: { select: userSelect }
    },
    orderBy: { createdAt: "desc" }
  });
  res.json(comments);
}));

app.post("/tasks/:id/time", asyncRoute(async (req, res) => {
  const body = z.object({
    date: z.string().min(1),
    hours: z.coerce.number().positive(),
    note: z.string().min(1),
    source: z.enum(["TIMER", "MANUAL", "EOD"])
  }).parse(req.body);

  const task = await prisma.task.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!task) return res.status(404).json({ message: "Task not found" });

  const entry = await prisma.timeEntry.create({
    data: {
      companyId: task.companyId,
      taskId: task.id,
      userId: req.user.id,
      date: parseDate(body.date),
      hours: body.hours,
      note: body.note,
      source: body.source
    }
  });

  await audit(req, "Time Log", task.title, "-", `${body.hours} hours via ${body.source}`, task.companyId);
  res.status(201).json(entry);
}));

app.get("/timers/active", asyncRoute(async (req, res) => {
  const timer = await prisma.timerSession.findFirst({
    where: tenantWhere(req, { userId: req.user.id, status: "RUNNING" }),
    include: {
      task: {
        include: {
          client: { select: { id: true, name: true, type: true } },
          project: { select: { id: true, name: true } },
          scope: { select: { id: true, title: true } }
        }
      },
      user: { select: userSelect }
    },
    orderBy: { startedAt: "desc" }
  });
  res.json(timer || null);
}));

app.post("/timers/start", asyncRoute(async (req, res) => {
  const body = z.object({
    taskId: z.string().min(1),
    note: z.string().optional()
  }).parse(req.body);

  const task = await prisma.task.findFirst({ where: tenantWhere(req, { id: body.taskId }), include: taskInclude });
  if (!task) return res.status(404).json({ message: "Task not found" });
  if (!seniorOrAbove(req.user) && ![task.assigneeId, task.reviewerId, task.createdById].includes(req.user.id)) {
    return res.status(403).json({ message: "You can log time only on tasks assigned to you." });
  }

  const now = new Date();
  const runningTimers = await prisma.timerSession.findMany({
    where: { companyId: task.companyId, userId: req.user.id, status: "RUNNING" }
  });
  for (const timer of runningTimers) {
    await stopTimerSession(timer, now, "Stopped automatically when another task timer started");
  }

  const timer = await prisma.timerSession.create({
    data: {
      companyId: task.companyId,
      taskId: task.id,
      userId: req.user.id,
      note: body.note
    },
    include: {
      task: {
        include: {
          client: { select: { id: true, name: true, type: true } },
          project: { select: { id: true, name: true } },
          scope: { select: { id: true, title: true } }
        }
      },
      user: { select: userSelect }
    }
  });

  await audit(req, "Timer Started", task.title, "-", "RUNNING", task.companyId);
  res.status(201).json(timer);
}));

app.post("/timers/:id/stop", asyncRoute(async (req, res) => {
  const body = z.object({ note: z.string().optional() }).parse(req.body || {});
  const timer = await prisma.timerSession.findFirst({
    where: tenantWhere(req, { id: req.params.id, userId: req.user.id }),
    include: { task: true }
  });
  if (!timer) return res.status(404).json({ message: "Timer not found" });
  if (timer.status !== "RUNNING") return res.status(400).json({ message: "Timer is already stopped" });

  const stopped = await stopTimerSession(timer, new Date(), body.note || "Timer stopped");
  await audit(req, "Timer Stopped", stopped.task.title, "RUNNING", `${stopped.elapsedSeconds} seconds`, stopped.companyId);
  res.json(stopped);
}));

async function listTimeEntries(req, res) {
  const entries = await prisma.timeEntry.findMany({
    where: tenantWhere(req),
    include: {
      task: { select: { id: true, title: true, clientId: true } },
      user: { select: userSelect }
    },
    orderBy: { date: "desc" }
  });
  res.json(entries);
}

app.get("/time-entries", asyncRoute(listTimeEntries));
app.get("/time-logs", asyncRoute(listTimeEntries));

app.patch("/time-entries/:id", asyncRoute(async (req, res) => {
  const body = z.object({
    date: z.string().optional(),
    hours: z.coerce.number().positive().optional(),
    note: z.string().min(1).optional(),
    source: z.enum(["TIMER", "MANUAL", "EOD"]).optional()
  }).parse(req.body);

  const existing = await prisma.timeEntry.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) return res.status(404).json({ message: "Time entry not found" });

  const entry = await prisma.timeEntry.update({
    where: { id: existing.id },
    data: {
      date: body.date ? parseDate(body.date) : undefined,
      hours: body.hours,
      note: body.note,
      source: body.source
    }
  });
  await audit(req, "Time Log Update", existing.id, existing.hours, entry.hours, existing.companyId);
  res.json(entry);
}));

app.delete("/time-entries/:id", asyncRoute(async (req, res) => {
  const existing = await prisma.timeEntry.findFirst({ where: tenantWhere(req, { id: req.params.id }) });
  if (!existing) return res.status(404).json({ message: "Time entry not found" });

  await prisma.timeEntry.delete({ where: { id: existing.id } });
  await audit(req, "Time Log Deletion", existing.id, `${existing.hours} hours`, "Deleted", existing.companyId);
  res.json({ deleted: true });
}));

app.get("/day-plans", asyncRoute(async (req, res) => {
  const plans = await prisma.dayPlan.findMany({
    where: tenantWhere(req),
    include: { user: { select: userSelect }, items: true },
    orderBy: { date: "desc" }
  });
  res.json(plans);
}));

app.post("/day-plans", asyncRoute(async (req, res) => {
  const body = z.object({
    date: z.string().min(1),
    remarks: z.string().optional(),
    items: z.array(z.object({
      clientId: z.string().min(1),
      scopeId: z.string().min(1),
      priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
      expectedHours: z.coerce.number().positive(),
      remarks: z.string().optional()
    })).min(1)
  }).parse(req.body);

  const plan = await prisma.dayPlan.create({
    data: {
      companyId: req.user.companyId,
      userId: req.user.id,
      managerId: req.user.managerId,
      date: parseDate(body.date),
      remarks: body.remarks,
      items: { create: body.items }
    },
    include: { items: true }
  });

  await notify(req.user.companyId, req.user.managerId, "Day Plan", "Day plan submitted", `${req.user.name} submitted a day plan.`, "dayPlan", plan.id);
  await audit(req, "Day Plan Submission", req.user.name, "-", `${body.items.length} items`, req.user.companyId);
  res.status(201).json(plan);
}));

app.get("/eod-reports", asyncRoute(async (req, res) => {
  const reports = await prisma.eodReport.findMany({
    where: tenantWhere(req),
    include: { user: { select: userSelect } },
    orderBy: { date: "desc" }
  });
  res.json(reports);
}));

app.post("/eod-reports", asyncRoute(async (req, res) => {
  const body = z.object({
    taskId: z.string().min(1),
    date: z.string().min(1),
    actualHours: z.coerce.number().positive(),
    completed: z.string().min(1),
    inProgress: z.string().optional(),
    blockers: z.string().optional(),
    pendingWork: z.string().optional(),
    reason: z.string().optional(),
    comments: z.string().min(1)
  }).parse(req.body);

  const task = await prisma.task.findFirst({ where: tenantWhere(req, { id: body.taskId }) });
  if (!task) return res.status(404).json({ message: "Task not found" });

  const report = await prisma.eodReport.create({
    data: {
      companyId: task.companyId,
      userId: req.user.id,
      managerId: req.user.managerId,
      taskId: task.id,
      date: parseDate(body.date),
      actualHours: body.actualHours,
      completed: body.completed,
      inProgress: body.inProgress,
      blockers: body.blockers,
      pendingWork: body.pendingWork,
      reason: body.reason,
      comments: body.comments
    }
  });

  await prisma.timeEntry.create({
    data: {
      companyId: task.companyId,
      taskId: task.id,
      userId: req.user.id,
      date: parseDate(body.date),
      hours: body.actualHours,
      note: "EOD reported actual time",
      source: "EOD"
    }
  });

  await notify(task.companyId, req.user.managerId, "Day End", "EOD submitted", `${req.user.name} submitted an EOD report.`, "eodReport", report.id);
  await audit(req, "EOD Submission", task.title, "-", `${body.actualHours} hours`, task.companyId);
  res.status(201).json(report);
}));

app.get("/status-history", asyncRoute(async (req, res) => {
  const history = await prisma.statusHistory.findMany({
    where: tenantWhere(req),
    include: { task: { select: { id: true, title: true } }, changedBy: { select: userSelect } },
    orderBy: { createdAt: "desc" }
  });
  res.json(history);
}));

app.get("/audit-logs", requireRoles("MASTER_ADMIN", "ADMIN"), asyncRoute(async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    where: tenantWhere(req),
    include: { user: { select: userSelect } },
    orderBy: { createdAt: "desc" }
  });
  res.json(logs);
}));

app.get("/permissions", asyncRoute(async (req, res) => {
  const permissions = await prisma.rolePermission.findMany({ orderBy: [{ role: "asc" }, { permission: "asc" }] });
  res.json(permissions);
}));

app.put("/roles/:role/permissions", requireRoles("MASTER_ADMIN"), asyncRoute(async (req, res) => {
  const body = z.object({ permissions: z.array(z.string().min(1)) }).parse(req.body);
  const role = z.enum(["MASTER_ADMIN", "ADMIN", "SENIOR", "REVIEWER", "PREPARER"]).parse(req.params.role);

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { role } }),
    ...body.permissions.map(permission => prisma.rolePermission.create({ data: { role, permission } }))
  ]);
  await audit(req, "Permission Update", role, "-", body.permissions.join(", "), req.user.companyId);
  const permissions = await prisma.rolePermission.findMany({ where: { role }, orderBy: { permission: "asc" } });
  res.json(permissions);
}));

app.get("/notifications", asyncRoute(async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { companyId: isMasterAdmin(req.user) && req.query.companyId ? req.query.companyId : req.user.companyId, recipientId: req.user.id },
    orderBy: { createdAt: "desc" }
  });
  res.json(notifications);
}));

app.patch("/notifications/:id/read", asyncRoute(async (req, res) => {
  const notification = await prisma.notification.update({
    where: { id: req.params.id },
    data: { readAt: new Date() }
  });
  res.json(notification);
}));

app.get("/reports/summary", asyncRoute(async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: tenantWhere(req),
    include: { timeEntries: true }
  });

  const status = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});

  const totals = tasks.reduce((acc, task) => {
    const actual = task.timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    acc.estimated += task.estimateHours;
    acc.actual += actual;
    acc.variance += actual - task.estimateHours;
    return acc;
  }, { estimated: 0, actual: 0, variance: 0 });

  res.json({
    taskCount: tasks.length,
    status,
    totals,
    efficiencyPercent: totals.actual ? (totals.estimated / totals.actual) * 100 : 0
  });
}));

app.use((error, req, res, next) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: "Validation failed", details: error.flatten() });
  }
  if (error?.code === "P2002") {
    return res.status(409).json({ message: "A record with the same unique value already exists" });
  }
  if (error?.code === "P2003") {
    return res.status(409).json({ message: "This record is linked to other data and cannot be deleted until those links are removed" });
  }
  if (error?.code === "P2025") {
    return res.status(404).json({ message: "Record not found" });
  }
  console.error(error);
  return res.status(500).json({ message: "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`TaskFlow API running on http://localhost:${port}`);
});
