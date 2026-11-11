// Tool input against the tool's input_schema. In chat the schema is only
// documentation for the model (tools.ts); here the input comes from another
// program, so it is checked before anything runs.
//
// Only the JSON Schema keywords the exposed tools use are understood.
// assertSupported() runs over every exposed schema at module load (index.ts),
// so a schema that gains a keyword stops the function from starting instead of
// going unchecked.

const KNOWN = new Set([
  'type', 'properties', 'required', 'additionalProperties', 'enum',
  'minimum', 'maximum', 'minLength', 'maxLength', 'format', 'items', 'maxItems',
  'description', 'default',
])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Schema = Record<string, unknown>

function typeOf(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'
  return typeof v
}

function matchesType(v: unknown, type: string): boolean {
  const t = typeOf(v)
  return t === type || (type === 'number' && t === 'integer')
}

/** The first problem with `value` against `schema`, as a path and a short
 * reason; null when it is valid. */
export function validate(value: unknown, schema: Schema, path = 'input'): string | null {
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type as string[] : [schema.type as string]
    if (!types.some((t) => matchesType(value, t))) return `${path}: expected ${types.join(' or ')}`
  }
  if (schema.enum !== undefined && !(schema.enum as unknown[]).includes(value)) {
    return `${path}: not one of the allowed values`
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) return `${path}: below ${schema.minimum}`
    if (typeof schema.maximum === 'number' && value > schema.maximum) return `${path}: above ${schema.maximum}`
  }
  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) return `${path}: too short`
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) return `${path}: too long`
    if (schema.format === 'uuid' && !UUID.test(value)) return `${path}: not a uuid`
  }
  if (Array.isArray(value)) {
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) return `${path}: too many items`
    if (schema.items) {
      for (const [i, item] of value.entries()) {
        const problem = validate(item, schema.items as Schema, `${path}[${i}]`)
        if (problem) return problem
      }
    }
  }
  if (typeOf(value) === 'object') {
    const obj = value as Record<string, unknown>
    const props = (schema.properties ?? {}) as Record<string, Schema>
    for (const r of (schema.required ?? []) as string[]) {
      if (!(r in obj)) return `${path}.${r}: required`
    }
    for (const [k, v] of Object.entries(obj)) {
      if (props[k]) {
        const problem = validate(v, props[k], `${path}.${k}`)
        if (problem) return problem
      } else if (schema.additionalProperties === false) {
        return `${path}.${k}: not allowed`
      }
    }
  }
  return null
}

/** Throws if `schema`, or any schema nested in it, uses a keyword validate()
 * does not understand. */
export function assertSupported(schema: Schema, path = 'input'): void {
  for (const k of Object.keys(schema)) {
    if (!KNOWN.has(k)) throw new Error(`validate: unsupported schema keyword "${k}" at ${path}`)
  }
  for (const [k, sub] of Object.entries((schema.properties ?? {}) as Record<string, Schema>)) assertSupported(sub, `${path}.${k}`)
  if (schema.items) assertSupported(schema.items as Schema, `${path}[]`)
}
