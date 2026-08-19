export function generateId() {
  return crypto.randomUUID();
}

export function timestamp() {
  return new Date().toISOString();
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
