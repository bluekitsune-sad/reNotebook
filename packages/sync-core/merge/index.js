export function threeWayMerge(base, versionA, versionB) {
  const merged = { ...base };

  const fieldsA = Object.keys(versionA).filter((k) => versionA[k] !== base[k]);
  const fieldsB = Object.keys(versionB).filter((k) => versionB[k] !== base[k]);

  const conflictFields = fieldsA.filter((f) => fieldsB.includes(f));

  if (conflictFields.length > 0) {
    return { merged: null, conflictFields, autoMergeable: false };
  }

  for (const field of fieldsA) {
    merged[field] = versionA[field];
  }
  for (const field of fieldsB) {
    merged[field] = versionB[field];
  }

  return { merged, conflictFields: [], autoMergeable: true };
}

export function mergeTextContent(base, versionA, versionB) {
  const linesA = (versionA || '').split('\n');
  const linesB = (versionB || '').split('\n');
  const linesBase = (base || '').split('\n');

  const maxLen = Math.max(linesA.length, linesB.length, linesBase.length);
  const result = [];

  for (let i = 0; i < maxLen; i++) {
    const baseLine = linesBase[i];
    const aLine = linesA[i];
    const bLine = linesB[i];

    if (aLine === baseLine && bLine === baseLine) {
      result.push(baseLine);
    } else if (aLine === baseLine) {
      result.push(bLine);
    } else if (bLine === baseLine) {
      result.push(aLine);
    } else {
      return { merged: null, conflictLines: [i], autoMergeable: false };
    }
  }

  return { merged: result.join('\n'), conflictLines: [], autoMergeable: true };
}
