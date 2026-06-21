import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";

export const roleRank = {
  PREPARER: 1,
  REVIEWER: 2,
  SENIOR: 3,
  ADMIN: 4,
  MASTER_ADMIN: 5
};

function dateKey(value) {
  if (!value) return "";
  return (value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`)).toISOString().slice(0, 10);
}

function companyActive(company, date = new Date()) {
  const current = dateKey(date);
  return !!company && (!company.startDate || current >= dateKey(company.startDate)) && (!company.endDate || current <= dateKey(company.endDate));
}

export function signUser(user) {
  return jwt.sign(
    { sub: user.id, companyId: user.companyId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "Login required" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { company: true }
    });

    if (!user) return res.status(401).json({ message: "Invalid login" });
    if (!companyActive(user.company)) return res.status(403).json({ message: "Company access is not active." });
    if (user.endDate && dateKey(new Date()) > dateKey(user.endDate)) return res.status(403).json({ message: "User is inactive and cannot log in." });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired login" });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Login required" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: "Permission denied" });
    next();
  };
}

export function seniorOrAbove(user) {
  return roleRank[user.role] >= roleRank.SENIOR;
}

export function adminOrAbove(user) {
  return roleRank[user.role] >= roleRank.ADMIN;
}

export function isMasterAdmin(user) {
  return user.role === "MASTER_ADMIN";
}

export function tenantCompanyId(req, requestedCompanyId) {
  if (isMasterAdmin(req.user)) return requestedCompanyId || undefined;
  return req.user.companyId;
}

export function tenantWhere(req, extra = {}) {
  if (isMasterAdmin(req.user)) {
    return req.query.companyId ? { ...extra, companyId: req.query.companyId } : extra;
  }
  return { ...extra, companyId: req.user.companyId };
}

export function serializeUser(user) {
  return {
    id: user.id,
    companyId: user.companyId,
    companyName: user.company?.name,
    name: user.name,
    email: user.email,
    role: user.role,
    managerId: user.managerId,
    designation: user.designation,
    education: user.education,
    dateOfJoining: user.dateOfJoining,
    endDate: user.endDate
  };
}
