export function parseCursor(cursor) {
  if (!cursor) return { serverSequence: 0, deviceId: null };
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    return { serverSequence: decoded.s || 0, deviceId: decoded.d || null };
  } catch {
    return { serverSequence: 0, deviceId: null };
  }
}

export function encodeCursor(serverSequence, deviceId) {
  const data = { s: serverSequence, d: deviceId };
  return Buffer.from(JSON.stringify(data)).toString('base64');
}
