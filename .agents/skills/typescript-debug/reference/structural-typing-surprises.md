# Structural Typing Surprises

TypeScript uses **structural** typing ("duck typing"): a type is compatible if its shape matches, regardless of name or declared relationship.

## Unrelated interfaces are assignable if shapes match

```ts
interface Point2D {
  x: number
  y: number
}

interface Vector2D {
  x: number
  y: number
}

function distance(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

const v: Vector2D = { x: 1, y: 2 }
distance(v, { x: 0, y: 0 }) // fine — Vector2D structurally matches Point2D, no relation declared
```

This is intentional and usually helpful (no need to explicitly implement every interface) — but it means a type name alone provides no guarantee; only the shape does.

## Extra properties are fine when passed via a variable

```ts
interface Point2D { x: number; y: number }

const point3D = { x: 1, y: 2, z: 3 }
function log(p: Point2D) { console.log(p.x, p.y) }

log(point3D) // fine — point3D has at least x and y; z is just ignored
```

Structural typing is "at least this shape," not "exactly this shape" — see `excess-property-checks.md` for the one place (direct object literals) where TypeScript is stricter.

## A class satisfies an interface without `implements`

```ts
interface Disposable {
  dispose(): void
}

class FileHandle {
  dispose(): void {
    console.log('closed')
  }
}

const d: Disposable = new FileHandle() // fine — FileHandle structurally matches Disposable
```

Useful for adapting third-party classes to your own interfaces without wrapping them, but it also means a method rename on `FileHandle` won't produce an error pointing at "you broke the `Disposable` contract" unless the class explicitly declares `implements Disposable`.

### Fix — declare intent explicitly for contracts that matter

```ts
class FileHandle implements Disposable {
  dispose(): void {
    console.log('closed')
  }
}
```

Now renaming `dispose` produces an immediate, clearly-attributed compiler error on the class itself.

## Functions: parameter count and variance

```ts
type ClickHandler = (event: MouseEvent) => void

const handler: ClickHandler = () => {
  console.log('clicked') // fine — a function can ignore parameters it doesn't need
}

const handler2: ClickHandler = (event, extra) => {
  // TS2322 — a function with MORE required parameters than expected is not assignable
}
```

A function type is assignable to another if it accepts **at most** the same parameters (fewer is fine, since callers won't pass more than expected) — this trips people who expect exact parameter-list matching.

## Nominal-style safety via branded types

When true nominal typing is needed (e.g. not mixing up two different string IDs), simulate it with a brand:

```ts
type UserId = string & { readonly __brand: 'UserId' }
type OrderId = string & { readonly __brand: 'OrderId' }

function toUserId(id: string): UserId {
  return id as UserId
}

function getUser(id: UserId) { /* ... */ }

getUser('abc')                 // TS2345 — plain string isn't a UserId
getUser(toUserId('abc'))       // fine
```

Branded types close the structural-typing gap for identifiers/values that are accidentally interchangeable at the shape level but should never be mixed up in practice.
