// src/lib/rqKeys.ts
export const matchKey = (qKey: unknown, tpl: readonly unknown[]) =>
  Array.isArray(qKey) && qKey[0] === tpl[0];

export const matchAny = (
  qKey: unknown,
  tpls: readonly (readonly unknown[])[]
) => tpls.some((t) => matchKey(qKey, t));
