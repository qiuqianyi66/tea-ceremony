# JSON Serialization Losses

## Symptom

Data silently changes shape after `JSON.parse(JSON.stringify(x))` or an API round-trip:

```js
JSON.stringify({ a: undefined })        // '{}' — key dropped
JSON.stringify({ fn: () => {} })        // '{}' — dropped
JSON.stringify([undefined, fn])         // '[null,null]' — became null!
JSON.stringify(new Map([[1, 2]]))       // '{}' — empty
JSON.stringify(new Set([1, 2]))         // '{}' — empty
JSON.stringify(new Date())              // '"2026-06-12T..."' — string now
JSON.stringify(NaN)                     // 'null'
JSON.stringify(123n)                    // ❌ TypeError: BigInt
JSON.stringify(obj)                     // ❌ TypeError if circular
```

## Rules

JSON supports: objects, arrays, strings, finite numbers, booleans, `null`. Everything else is dropped, nullified, stringified, or throws.

- `undefined`, functions, symbols → dropped in objects, `null` in arrays.
- `Date` → ISO string; **does not come back as Date** on parse.
- `Map`/`Set` → `{}`; convert explicitly: `[...map]`, `[...set]`.
- `NaN`/`Infinity` → `null`.
- `BigInt` and circular references → throw.

## Fixes

Dates — revive explicitly:

```js
const user = JSON.parse(raw)
user.createdAt = new Date(user.createdAt)
```

Map/Set round-trip:

```js
const json = JSON.stringify({ tags: [...tagsSet], index: [...indexMap] })
const data = JSON.parse(json)
const tags = new Set(data.tags)
const index = new Map(data.index)
```

Deep copy — use `structuredClone`, not the JSON trick:

```js
structuredClone(state)   // ✅ keeps Dates, Maps, Sets, handles cycles
```

Circular structures for logging:

```js
console.log(util.inspect(obj))           // node
JSON.stringify(obj, getCircularReplacer()) // custom replacer
```
