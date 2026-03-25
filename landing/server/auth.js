import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const SALT_ROUNDS = 10;

export function getJwtSecret() {
  const s = process.env.JWT_SECRET?.trim();
  if (!s || s.length < 16) {
    throw new Error("JWT_SECRET must be set (min 16 characters)");
  }
  return s;
}

/**
 * @param {string} password
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * @param {string} password
 * @param {string} hash
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * @param {{ sub: string, email: string }} payload
 */
export function signToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

/**
 * @param {string} token
 */
export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: "unauthorized" });
    const payload = verifyToken(token);
    if (typeof payload.sub !== "string") return res.status(401).json({ error: "unauthorized" });
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function optionalAuth(req, _res, next) {
  try {
    const token = req.cookies?.token;
    if (token) {
      const payload = verifyToken(token);
      if (typeof payload.sub === "string") {
        req.userId = payload.sub;
        req.userEmail = payload.email;
      }
    }
  } catch {
    /* ignore */
  }
  next();
}
