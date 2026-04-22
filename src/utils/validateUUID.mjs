import mongoose from "mongoose";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUIDv4(uuid) {
  if (!uuid || typeof uuid !== "string") {
    return false;
  }
  return UUID_V4_REGEX.test(uuid);
}

export function isValidObjectId(id) {
  if (!id || typeof id !== "string") {
    return false;
  }
  return mongoose.isValidObjectId(id);
}
