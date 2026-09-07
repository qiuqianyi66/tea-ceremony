# parseInt and Number Parsing Traps

## Symptom

```js
parseInt('08')           // 8, but historically 0 in old engines
parseInt('1e3')          // 1 ❌ (stops at 'e')
parseInt(0.0000005)      // 5 ❌ (number → '5e-7' string first)
Number('')               // 0 ❌ (empty string is zero)
Number(null)             // 0 ❌
Number(undefined)        // NaN
+'12px'                  // NaN
parseInt('12px')         // 12 (stops at first non-digit)
```

## Rules

- `parseInt(str, 10)` — **always pass the radix**; parses leading digits, ignores trailing garbage.
- `Number(str)` — strict whole-string conversion; `''`/`null` become `0` (trap), whitespace-only too.
- `parseFloat(str)` — like parseInt but for decimals; same leading-parse semantics.

## Choosing the right parser

| Input | Want | Use |
|-------|------|-----|
| `'42'` from form/API | strict number | `Number(x)` + `Number.isFinite` check |
| `'12px'`, `'42 items'` | leading number | `parseInt(x, 10)` / `parseFloat(x)` |
| unknown user input | validated number | explicit validation below |

```js
function toNumber(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error(`Not a number: ${input}`)
  }
  const n = Number(input)
  if (!Number.isFinite(n)) throw new Error(`Not a number: ${input}`)
  return n
}
```

## map + parseInt classic

```js
['1', '2', '3'].map(parseInt)        // ❌ [1, NaN, NaN]
// parseInt receives (value, index) → radix 0, 1, 2
['1', '2', '3'].map(Number)          // ✅ [1, 2, 3]
['1', '2', '3'].map((s) => parseInt(s, 10)) // ✅
```
