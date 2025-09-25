/**
 * Utility type for deep partial objects
 */
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * Check if a value is a plain object (not an array or null)
 * @param value The value to check
 * @returns True if the value is a plain object
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  )
}

/**
 * Deep merge two objects together. For arrays, replace instead of merge.
 * @param target The base object
 * @param source The object whose properties take precedence
 * @returns A new object with merged properties
 */
export function deepMerge<T extends object>(
  target: T,
  source: DeepPartial<T>
): T {
  const output = { ...target } as T

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key]
      const targetValue = target[key]

      if (sourceValue === undefined) {
        continue
      }

      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        // Recursively merge nested objects
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        output[key] = deepMerge(targetValue as any, sourceValue) as T[Extract<keyof T, string>]
      } else {
        // For primitives, arrays, or null values, replace entirely
        output[key] = sourceValue as T[Extract<keyof T, string>]
      }
    }
  }

  return output
}

/**
 * Merge multiple objects in sequence using deep merge
 * @param objects Array of objects to merge (later objects take precedence)
 * @returns A new object with all properties merged
 */
export function deepMergeMultiple<T extends object>(...objects: Array<DeepPartial<T>>): T {
  if (objects.length === 0) {
    throw new Error('At least one object must be provided')
  }

  let result = objects[0] as T

  for (let i = 1; i < objects.length; i++) {
    result = deepMerge(result, objects[i])
  }

  return result
}

export type { DeepPartial }