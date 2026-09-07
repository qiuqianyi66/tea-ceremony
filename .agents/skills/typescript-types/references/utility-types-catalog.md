# Built-in Utility Types — Full Catalog

```ts
interface User {
  id: number
  name: string
  email: string
  password: string
  role: 'admin' | 'member'
  address?: { city: string; zip: string }
}
```

## Object shape transforms

```ts
type Partial<T>         // all properties optional
type Required<T>        // all properties required (removes `?`)
type Readonly<T>         // all properties readonly
type Pick<T, K>          // subset of keys K
type Omit<T, K>          // all keys except K
type Record<K, V>        // { [key in K]: V }
```

```ts
type UpdateUserPayload = Partial<Omit<User, 'id'>>
type PublicUser = Omit<User, 'password'>
type UserSummary = Pick<User, 'id' | 'name'>
type FrozenUser = Readonly<User>
type UsersById = Record<number, User>
```

## Union transforms

```ts
type Exclude<T, U>       // members of T not assignable to U
type Extract<T, U>       // members of T assignable to U
type NonNullable<T>      // remove null and undefined
```

```ts
type Role = User['role']
type NonAdminRole = Exclude<Role, 'admin'>       // 'member'
type OnlyAdmin = Extract<Role, 'admin'>          // 'admin'
type DefiniteCity = NonNullable<User['address']> // { city, zip } — strips `undefined`
```

## Function-related

```ts
type Parameters<F>        // tuple of a function's parameter types
type ReturnType<F>        // a function's return type
type ConstructorParameters<C>
type InstanceType<C>
```

```ts
function createUser(name: string, role: Role): User { /* ... */ }

type CreateUserArgs = Parameters<typeof createUser>   // [string, Role]
type CreateUserResult = ReturnType<typeof createUser> // User

class Repository {
  constructor(private http: HttpClient) {}
}

type RepoCtorArgs = ConstructorParameters<typeof Repository> // [HttpClient]
type Repo = InstanceType<typeof Repository>                  // Repository
```

Use `ReturnType`/`Parameters` to keep a caller's types in sync with a function automatically — if the function's signature changes, dependent types update without manual edits.

## Async

```ts
type Awaited<P>   // unwraps Promise<T> (including nested promises) to T
```

```ts
async function fetchUser(): Promise<User> { /* ... */ }

type FetchedUser = Awaited<ReturnType<typeof fetchUser>> // User
```

## String manipulation types

```ts
type Uppercase<S extends string>
type Lowercase<S extends string>
type Capitalize<S extends string>
type Uncapitalize<S extends string>
```

```ts
type EventName = `on${Capitalize<'click'>}` // 'onClick'
```

## `keyof`, `typeof`, indexed access

```ts
type UserKeys = keyof User                 // 'id' | 'name' | 'email' | ...
type RoleType = User['role']               // 'admin' | 'member'
type AllValues = User[keyof User]          // union of every property's value type

const config = { retries: 3, timeout: 5000 } as const
type Config = typeof config                // { readonly retries: 3; readonly timeout: 5000 }
```

## Combining utilities

```ts
type PatchUserRequest = Partial<Pick<User, 'name' | 'email' | 'address'>>

type ApiSafeUser = Readonly<Omit<User, 'password'>>

type UserRoleMap = Record<User['role'], string>
// { admin: string; member: string }
```

Composing 2–3 utility types is normal and readable. Beyond that, name each intermediate step so the type reads top-to-bottom instead of requiring the reader to unwind nested generics.
