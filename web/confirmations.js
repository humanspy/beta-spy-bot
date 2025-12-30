import crypto from "crypto";

const pending = new Map();

export function createConfirmation(payload) {
  const id = crypto.randomUUID();
  pending.set(id, {
    ...payload,
    createdAt: Date.now(),
  });

  return id;
}

export function consumeConfirmation(id) {
  const entry = pending.get(id);
  if (!entry) return null;

  pending.delete(id);
  return entry;
}
