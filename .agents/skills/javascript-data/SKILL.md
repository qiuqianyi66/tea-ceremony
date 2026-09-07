---
name: javascript-data
description: Working with data in JavaScript - dates and time zones, Intl formatting (dates, numbers, currencies, lists, plurals), JSON serialization gotchas, structuredClone, regular expressions best practices, Map/Set/WeakMap collections, and sorting/grouping with Intl.Collator and Object.groupBy. Load when formatting dates or money, parsing/serializing data, handling locales and i18n formatting, writing regexes, or choosing collections.
license: MIT
metadata:
  sources:
    - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl (MDN Intl)
    - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date (MDN Date)
  version: "1.0.0"
compatibility: ECMAScript 2020+ / Node.js >=18
---

# JavaScript Data — Dates, Intl, JSON, Regex, Collections

> Format with `Intl`, never by hand. Store dates as ISO UTC strings or timestamps.

## Core Rules

- **Never format dates/numbers manually** — `Intl.DateTimeFormat` / `Intl.NumberFormat`.
- **Store UTC, display local** — ISO 8601 strings or epoch ms in storage/API.
- **Money in integer minor units** — format with `style: 'currency'` only at display time.
- **`structuredClone` for deep copies** — not the JSON round-trip.
- **Reuse `Intl` formatter instances** — construction is expensive.

---

## 1) Dates

### Creating & storing

```js
const now = new Date()
const fromIso = new Date('2026-06-12T10:30:00Z')   // ✅ ISO with timezone
const fromMs = new Date(1781234567890)

now.toISOString()    // '2026-06-12T07:30:00.000Z' — for storage/API
Date.now()           // epoch ms — for timestamps/durations
```

Traps:

```js
new Date('2026-06-12')        // parsed as UTC midnight
new Date('06/12/2026')        // ❌ ambiguous, locale-dependent — never parse this
new Date(2026, 5, 12)         // months are 0-based: 5 = June (!)
date.getDay()                 // weekday (0=Sunday), NOT day of month (getDate())
```

- Mutating setters (`setHours` etc.) change the object in place — copy first: `new Date(date)`.
- Date-only values (birthdays): keep as `'YYYY-MM-DD'` strings, don't convert to `Date` unless needed — timezone shifts corrupt them.

### Formatting — always Intl

```js
const fmt = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'long', timeStyle: 'short' })
fmt.format(date)                       // '12 червня 2026 р. о 10:30'

new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Kyiv',
}).format(date)
```

Relative time:

```js
const rtf = new Intl.RelativeTimeFormat('uk', { numeric: 'auto' })
rtf.format(-1, 'day')    // 'учора'
rtf.format(3, 'hour')    // 'через 3 години'
```

### Durations & arithmetic

```js
const elapsed = endMs - startMs                       // numbers, not Dates
const tomorrow = new Date(date)
tomorrow.setDate(tomorrow.getDate() + 1)              // handles month/year rollover
```

For heavy timezone/calendar math use a library (`date-fns`, `dayjs`) or `Temporal` when available — don't hand-roll DST handling.

---

## 2) Numbers & Currency

```js
const uah = new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' })
uah.format(1234.5)        // '1 234,50 ₴'

new Intl.NumberFormat('en-US', { notation: 'compact' }).format(1_250_000) // '1.3M'
new Intl.NumberFormat('uk-UA', { style: 'percent' }).format(0.156)        // '15,6 %'
new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1, style: 'unit', unit: 'kilometer' }).format(5.27)
```

- Store money as integer cents; divide by 100 only inside `format`.
- Reuse formatter instances at module scope.
- Plurals — `Intl.PluralRules`, never `count === 1 ? ... : ...` (breaks for Ukrainian/Polish/etc.):

```js
const pr = new Intl.PluralRules('uk')
const forms = { one: 'товар', few: 'товари', many: 'товарів', other: 'товару' }
`${n} ${forms[pr.select(n)]}`
```

Lists:

```js
new Intl.ListFormat('uk', { type: 'conjunction' }).format(['A', 'B', 'C']) // 'A, B і C'
```

---

## 3) JSON & Cloning

What JSON drops or breaks: `undefined`/functions (dropped), `Date` (becomes string), `Map`/`Set` (become `{}`), `NaN`/`Infinity` (become `null`), `BigInt`/circular (throw).

```js
// deep copy — keeps Dates, Maps, Sets, handles cycles
const copy = structuredClone(state)

// revive dates after parse
const user = JSON.parse(raw)
user.createdAt = new Date(user.createdAt)

// pretty-print for files/logs
JSON.stringify(data, null, 2)

// safe parse at boundaries
function parseJson(text, fallback = null) {
  try {
    return JSON.parse(text)
  } catch {
    return fallback
  }
}
```

- `structuredClone` doesn't clone functions or class prototypes — plain data only.
- `toJSON()` method on a class customizes its serialization.

---

## 4) Regular Expressions

```js
const RE_ORDER_ID = /^ORD-(\d{4,8})$/

const match = input.match(RE_ORDER_ID)
if (match) {
  const id = match[1]
}

// named groups — self-documenting
const RE_DATE = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/
const { year, month, day } = input.match(RE_DATE)?.groups ?? {}
```

Rules:
- Anchor validations with `^...$` — `/\d+/.test('abc123')` is true.
- Name and hoist regexes to module constants — intent + no re-compilation.
- Escape user input before embedding in a dynamic regex:

```js
const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const re = new RegExp(escaped, 'i')
```

- A **global** (`/g`) regex keeps `lastIndex` state across `test()` calls — alternating true/false bug; use `matchAll` or non-global for tests.
- `matchAll` for all matches with groups:

```js
for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) {
  vars.add(m[1])
}
```

- Prefer string methods when they suffice: `includes`, `startsWith`, `replaceAll`.
- Beware catastrophic backtracking (`(a+)+`, nested quantifiers) on user input.

---

## 5) Collections

| Need | Use |
|------|-----|
| ordered list | `Array` |
| unique values, fast membership | `Set` |
| keyed lookup, any key type, iteration order | `Map` |
| metadata for objects without preventing GC | `WeakMap` |
| fixed shape record | plain object |

```js
const unique = [...new Set(emails)]

const usersById = new Map(users.map((u) => [u.id, u]))
usersById.get(42)

const seen = new Set()
const deduped = items.filter((i) => !seen.has(i.id) && seen.add(i.id))
```

- `Map` over plain object for dynamic keys: no prototype collisions (`'constructor'`, `'__proto__'`), `.size`, any key type, fast add/remove.
- `Object.groupBy` / `Map.groupBy` (ES2024) for grouping:

```js
const byStatus = Object.groupBy(orders, (o) => o.status)
// fallback: orders.reduce((acc, o) => { (acc[o.status] ??= []).push(o); return acc }, {})
```

---

## 6) Sorting & Comparing Text

Never sort user-facing strings with `<` — use `Intl.Collator`:

```js
const collator = new Intl.Collator('uk', { sensitivity: 'base' })
names.toSorted(collator.compare)

// natural sort for mixed text+numbers: item2 < item10
new Intl.Collator(undefined, { numeric: true }).compare('item2', 'item10') // -1
```

Multi-key sort:

```js
items.toSorted((a, b) =>
  a.category.localeCompare(b.category, 'uk') || b.price - a.price,
)
```

---

## 7) Final Self-Check

- Dates stored as ISO UTC / epoch ms; formatted only via `Intl.DateTimeFormat`.
- No manual date string parsing of ambiguous formats.
- Money in integer minor units; `Intl.NumberFormat` with `currency` for display.
- Plurals via `Intl.PluralRules`; lists via `Intl.ListFormat`.
- Deep copies via `structuredClone`; JSON losses handled at boundaries.
- Regexes anchored, named, escaped for user input; no stateful `/g` in `test()`.
- `Map`/`Set` for dynamic collections; `Intl.Collator` for text sorting.
