import type { DiffOp } from './types.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 递归计算两个对象之间的字段级差异
 * @returns 以点号路径为键的 diff 记录
 */
export function computeDiff(
  oldValue: unknown,
  newValue: unknown,
  prefix = ''
): Record<string, DiffOp> {
  const diff: Record<string, DiffOp> = {};

  if (oldValue === newValue) {
    return diff;
  }

  const oldIsObject = isPlainObject(oldValue);
  const newIsObject = isPlainObject(newValue);

  if (oldIsObject && newIsObject) {
    const oldObj = oldValue as Record<string, unknown>;
    const newObj = newValue as Record<string, unknown>;
    const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    for (const key of keys) {
      const path = prefix ? `${prefix}.${key}` : key;
      const childDiff = computeDiff(oldObj[key], newObj[key], path);
      Object.assign(diff, childDiff);
    }
    return diff;
  }

  if (oldValue === undefined || oldValue === null) {
    diff[prefix || '.'] = 'added';
  } else if (newValue === undefined || newValue === null) {
    diff[prefix || '.'] = 'removed';
  } else {
    diff[prefix || '.'] = 'changed';
  }

  return diff;
}
