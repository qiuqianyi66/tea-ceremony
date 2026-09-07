# Naming Conventions

Clear names remove the need for comments. Optimize for the reader.

## Casing

| Kind | Convention | Example |
|------|-----------|---------|
| Variables, functions, methods | `camelCase` | `orderTotal`, `fetchOrders()` |
| Classes, constructors, enums-as-objects | `PascalCase` | `OrderService`, `HttpStatus` |
| Module-level constants | `UPPER_SNAKE_CASE` | `MAX_RETRIES`, `API_BASE_URL` |
| Private class fields | `#field` | `#token` |
| Private by convention (non-class) | `_prefix` | `_internalCache` |
| File names | `kebab-case` | `order-service.js` |

## Semantic prefixes

- Booleans: `is`, `has`, `can`, `should`, `did` — `isLoading`, `hasPermission`, `canEdit`.
- Getters/derivers: noun — `fullName`, `activeUsers`.
- Actions/mutations: verb — `loadUser`, `saveDraft`, `resetForm`.
- Event handlers: `handle`/`on` — `handleSubmit`, `onScroll`.
- Async actions: verb describing the operation — `fetchUser`, `uploadAvatar`.

## Describe intent, not implementation

```js
const users = await fetchUsers()        // good
const userArray = await fetchUsers()    // bad — type in name

const elapsedMs = end - start           // good — unit encoded
const time = end - start                // bad — ambiguous
```

## Avoid

- Single letters except short-lived loop indices (`i`) or math (`x`, `y`).
- Abbreviations beyond well-known ones (`id`, `url`, `db`, `ctx`, `req`, `res`).
- Negated booleans (`isNotReady`) — prefer the positive (`isReady`).
- Numbered suffixes (`data2`, `tmp3`) — name the difference instead.

## Constants and magic values

Extract repeated or unexplained literals into named constants near the top of the module:

```js
const DEBOUNCE_MS = 300
const PAGE_SIZE = 20
```
