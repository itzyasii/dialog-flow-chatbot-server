import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

export const accessToken = (userId, userRole) => {
  //   const payload = { id: user._id, email: user.email, name: user.name };

  // After (minimal claims)
  const payload = {
    sub: userId, // Standard "subject" claim
    role: userRole, // Custom claim for user role
    iss: "Linkup", // Issuer
    iat: Math.floor(Date.now() / 1000), // Issued at
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

export const refreshToken = (userId, userRole, req) => {
  const deviceFingerprint = crypto
    .createHash("sha256")
    .update(req.get("User-Agent") + req.ip)
    .digest("hex");

  const payload = {
    sub: userId, // Standard "subject" claim
    role: userRole, // Custom claim for user role
    iss: "Linkup", // Issuer
    iat: Math.floor(Date.now() / 1000), // Issued at
    jti: uuidv4(), // Unique identifier for the token
    device: deviceFingerprint, // Bind to device
  };

  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
  });
};

export const resetToken = (userId) => {
  const payload = {
    sub: userId, // Standard "subject" claim
    iss: "Linkup", // Issuer
    aud: "reset-password",
    iat: Math.floor(Date.now() / 1000), // Issued at
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};
