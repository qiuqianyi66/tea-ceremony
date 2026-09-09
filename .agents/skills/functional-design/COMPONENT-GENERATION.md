# Component Generation Reference

This reference teaches the Functional Design skill how to generate framework-specific,
production-ready component code from functional specs and a design system. Every template
adapts to the detected framework, styling approach, and project conventions.

---

## 1. Framework Detection

Identify the project's framework by reading `package.json` dependencies and scanning
the filesystem for characteristic files.

| Signal | Framework |
|--------|-----------|
| `package.json` has `react` + `react-dom` | React |
| `package.json` has `@angular/core` | Angular |
| `package.json` has `vue` | Vue |
| `package.json` has `svelte` | Svelte |
| `.html` files only, no bundler | Vanilla |
| `next` in dependencies | Next.js (React SSR) |
| `nuxt` in dependencies | Nuxt (Vue SSR) |

### Detection Order

1. Read `package.json` at project root.
2. Check `dependencies` first, then `devDependencies`.
3. If multiple frameworks appear (e.g., `react` and `next`), choose the more specific
   one (`Next.js` over plain `React`).
4. If no `package.json` exists, scan for `.html` files and classify as Vanilla.
5. Confirm by checking for framework config files (`next.config.js`, `angular.json`,
   `vite.config.ts`, `svelte.config.js`, `nuxt.config.ts`).

### Framework-Specific Assumptions

- **React**: Functional components with hooks. No class components unless the codebase
  already uses them.
- **Angular**: Standalone components by default (Angular 15+). Fall back to NgModule
  components if the project uses `@NgModule`.
- **Vue**: Composition API with `<script setup>` (Vue 3). Fall back to Options API if
  the project uses it.
- **Next.js**: App Router by default. Fall back to Pages Router if `pages/` directory
  exists and `app/` does not.
- **Svelte**: Svelte 4 syntax unless `svelte.config.js` indicates Svelte 5 (runes).

---

## 2. Styling Detection

| Signal | Styling Approach |
|--------|-----------------|
| `tailwindcss` in dependencies + `tailwind.config` file | Tailwind CSS |
| `.module.css` files in `src/` | CSS Modules |
| `styled-components` or `@emotion/styled` in deps | CSS-in-JS |
| `.scss` files in `src/` | Sass/SCSS |
| Only `.css` files, no modules or processors | Vanilla CSS |

### Detection Order

1. Check `package.json` for Tailwind, styled-components, Emotion, or Sass.
2. Scan `src/` for file extensions (`.module.css`, `.scss`, `.css`).
3. If multiple approaches exist, prefer the one used by the majority of components.
4. Check for a design token file (`theme.ts`, `tokens.css`, `variables.scss`,
   `tailwind.config.js` custom theme) and use its values instead of hardcoded colors
   or spacing.

### Token Mapping

When a design system defines tokens, map them to component styles:

```
Design Token          Tailwind Example        CSS Variable Example
────────────────────  ────────────────────    ────────────────────
surface-1             bg-gray-50              var(--surface-1)
surface-2             bg-white                var(--surface-2)
surface-3             bg-gray-100             var(--surface-3)
text-primary          text-gray-900           var(--text-primary)
text-muted            text-gray-500           var(--text-muted)
border-default        border-gray-200         var(--border-default)
accent                text-blue-600           var(--accent)
danger                text-red-600            var(--danger)
success               text-green-600          var(--success)
warning               text-amber-600          var(--warning)
radius-md             rounded-lg              var(--radius-md)
shadow-sm             shadow-sm               var(--shadow-sm)
spacing-1             p-1 (4px)              var(--spacing-1)
spacing-2             p-2 (8px)              var(--spacing-2)
spacing-4             p-4 (16px)             var(--spacing-4)
spacing-6             p-6 (24px)             var(--spacing-6)
```

NEVER hardcode hex colors or pixel values. Always use the project's token system.

---

## 3. File Organization Detection

Read the project's existing component structure before generating anything.

### Common Patterns

- **Feature-based**: `components/{feature}/{Component}.tsx`
  - Example: `components/jobs/JobListPage.tsx`, `components/jobs/JobCard.tsx`
- **Type-based**: `components/{pages|shared|layout}/{Component}.tsx`
  - Example: `components/pages/Dashboard.tsx`, `components/shared/Button.tsx`
- **Flat**: `components/{Component}.tsx`
  - Example: `components/JobListPage.tsx`, `components/KpiCard.tsx`
- **Atomic Design**: `components/{atoms|molecules|organisms|templates|pages}/`
  - Example: `components/atoms/Button.tsx`, `components/organisms/DataTable.tsx`

### Detection Steps

1. List directories under `src/components/` (or `src/app/` for Angular).
2. If subdirectories are named after features (jobs, users, dashboard), it is
   feature-based.
3. If subdirectories are named after types (shared, layout, pages, ui), it is
   type-based.
4. If no subdirectories exist, it is flat.
5. Check for barrel files (`index.ts`) and match that pattern.
6. Check import paths in existing files to confirm the convention.

ALWAYS match the existing convention. Never impose a new organization on an existing
project. For greenfield projects, default to feature-based organization.

---

## 4. Component Templates

Templates are written as pseudo-code that adapts to the detected framework and styling
approach at generation time. Each template includes ALL visual states.

### 4.1 Page Component Template

A page component is the top-level component rendered by a route. It orchestrates data
fetching, state, and child component composition.

```
PageComponent({ params }):
  // 1. Data fetching — use project's data layer (SWR, React Query, NgRx, etc.)
  data = useFetchWithSWR(endpoint, {
    pollInterval: specified_in_spec,
    enabled: shouldPoll(params)
  })

  // 2. URL state — filters, sort, pagination synced to query params
  filters = useURLParams(spec.url_params)

  // 3. Derived state — computed from raw data + filters
  derived = computeFrom(data, filters)

  // 4. Action handlers
  handleAction = async (payload) => {
    optimisticUpdate(data, payload)
    await mutate(endpoint, payload)
    // revalidation happens automatically via SWR
  }

  // 5. Render based on state machine
  if (data.loading && !data.staleData)   -> render LoadingSkeleton
  if (data.error && !data.staleData)     -> render ErrorState with retry
  if (data.loaded && isEmpty(derived))   -> render EmptyState with CTA
  if (data.loaded || data.staleData)     -> render Content with optional stale indicator
  if (data.refreshing)                   -> render Content with subtle refresh indicator
```

**Implementation notes:**

- The loading skeleton MUST match the layout of the loaded state (same number of cards,
  table rows, spacing). Never use a generic spinner.
- Stale data takes priority over loading: if we have previous data, show it with a
  subtle refresh indicator rather than replacing content with a skeleton.
- Error state shows a retry button that calls `data.refetch()`.
- Empty state includes a call-to-action that guides the user toward populating the view.
- URL params are the source of truth for filters/sort/pagination so the user can share
  or bookmark filtered views.

### 4.2 SWR Polling Hook Template

This is the most critical reusable hook. Most projects need a data fetching layer that
supports stale-while-revalidate semantics with optional polling.

```
useSWRPolling(url, options):
  // ─── State ───
  data          = null      // current valid data
  staleData     = null      // last known good data (survives errors)
  loading       = true      // initial load in progress
  error         = null      // current error, if any
  isRefreshing  = false     // background revalidation in progress

  // ─── Tab Visibility ───
  isVisible = useTabVisibility()
  // Uses document.visibilitychange event
  // Pauses polling when tab is hidden, resumes when visible
  // On resume: trigger immediate refetch if stale

  // ─── Core Fetch Logic ───
  fetchData():
    if (data exists):
      set isRefreshing = true
    else:
      set loading = true
    try:
      response = await fetch(url, { signal: abortController.signal })
      if (!response.ok) throw new HttpError(response.status, response.statusText)
      parsed = await response.json()
      set data = parsed
      set staleData = parsed   // always update last-known-good
      set error = null
    catch (err):
      if (err.name === 'AbortError') return   // ignore aborted requests
      set error = err
      // CRITICAL: do NOT clear staleData — this is the SWR core principle
    finally:
      set loading = false
      set isRefreshing = false

  // ─── Lifecycle ───
  onMount:
    fetchData()

  // ─── Polling ───
  if (options.pollInterval && options.enabled !== false && isVisible):
    interval = setInterval(fetchData, options.pollInterval)
    onCleanup -> clearInterval(interval)

  // ─── Manual Controls ───
  refetch = () => fetchData()

  mutate(optimisticData):
    set data = optimisticData
    set staleData = optimisticData
    fetchData()   // revalidate from server

  return { data, staleData, loading, error, isRefreshing, refetch, mutate }
```

**Critical implementation notes:**

- `staleData` NEVER clears on error. This is the entire point of stale-while-revalidate.
  Users see the last good data with an error banner, not a blank screen.
- Tab visibility uses `document.addEventListener('visibilitychange', ...)`. When the tab
  becomes visible again, trigger an immediate fetch if `pollInterval` has elapsed.
- Clean up ALL intervals and abort controllers on unmount. Leaked intervals cause memory
  leaks and ghost requests.
- The `enabled` flag controls whether polling is active. Use this for conditional polling
  (e.g., only poll while a job is running, stop when it completes).
- AbortController: create a new one per fetch, abort the previous one if a new fetch
  starts before the old one completes. This prevents race conditions.
- Error retry: optionally support exponential backoff (1s, 2s, 4s, 8s, max 30s) for
  transient errors. Reset backoff on successful fetch.

### 4.3 Card Component Template

Cards are the primary content container. They have multiple variants optimized for
different use cases.

```
Card({ variant, children, onClick?, className? }):
  // Variants: default, kpi, status, clickable, compact
  // All variants share base styles

  baseStyles = "surface-2 bg, radius-md, border-default, padding-4 md:padding-6"

  // ─── Default ───
  // Simple content container
  render: <div className={baseStyles}>{children}</div>

  // ─── KPI Variant ───
  // Left accent border, large prominent value, muted label
  if variant == "kpi":
    render:
      <div className={baseStyles + "border-l-4 border-l-accent"}>
        <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
        <span className="text-2xl md:text-3xl font-semibold text-primary mt-1">{value}</span>
        {trend &&
          <span className={trend > 0 ? "text-success" : "text-danger"}>
            {trend > 0 ? "+" : ""}{trend}%
          </span>
        }
        {subtext && <span className="text-xs text-muted mt-1">{subtext}</span>}
      </div>

  // ─── Status Variant ───
  // Colored left or top border indicating item status
  if variant == "status":
    borderColor = STATUS_COLOR_MAP[status]
    render:
      <div className={baseStyles + `border-l-4 ${borderColor}`}>
        {children}
      </div>

  // ─── Clickable Variant ───
  // Interactive card with hover/focus states
  if variant == "clickable":
    render:
      <button
        className={baseStyles + "hover:surface-3 cursor-pointer transition-colors focus-visible:ring-2 ring-accent"}
        onClick={onClick}
        role="button"
        tabIndex={0}
      >
        {children}
      </button>

  // ─── Compact Variant ───
  // Reduced padding for dense layouts (lists, sidebars)
  if variant == "compact":
    render: <div className={baseStyles.replace("padding-4 md:padding-6", "padding-2 md:padding-3")}>{children}</div>
```

### 4.4 Data Table Template

Tables are complex components with many states and responsive requirements.

```
DataTable({ columns, data, loading, error, empty, sortable, onSort, pagination }):
  // ─── URL-synced Sort State ───
  [sortColumn, setSortColumn] = useURLParam('sort', columns[0]?.key)
  [sortDirection, setSortDirection] = useURLParam('order', 'asc')

  handleSort(columnKey):
    if (columnKey === sortColumn):
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else:
      setSortColumn(columnKey)
      setSortDirection('asc')

  // ─── Responsive Detection ───
  isMobile = useMediaQuery('(max-width: 768px)')

  // ─── State Rendering ───
  if loading:
    render TableSkeleton:
      <table>
        <thead> {columns.map(col => <th>{SkeletonBar width=col.width}</th>)} </thead>
        <tbody>
          {Array(5).map(() =>
            <tr>{columns.map(col => <td>{SkeletonBar width=col.skeletonWidth || "80%"}</td>)}</tr>
          )}
        </tbody>
      </table>

  if error:
    render ErrorState:
      <div className="centered padding-12">
        <ErrorIcon />
        <p>Failed to load data</p>
        <Button variant="secondary" onClick={onRetry}>Try again</Button>
      </div>

  if empty (data.length === 0):
    render EmptyState:
      // Centered in the table area, NOT an empty table with just headers
      <div className="centered padding-12">
        <EmptyIcon />
        <p>{emptyMessage}</p>
        {emptyCTA && <Button variant="primary">{emptyCTA.label}</Button>}
      </div>

  // ─── Loaded: Desktop ───
  if !isMobile:
    render:
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b text-xs uppercase text-muted">
            {columns.map(col =>
              <th
                className={"text-" + col.align + (col.sortable ? " cursor-pointer select-none" : "")}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                aria-sort={sortColumn === col.key ? sortDirection : undefined}
              >
                {col.label}
                {sortColumn === col.key && <SortIndicator direction={sortDirection} />}
              </th>
            )}
          </thead>
          <tbody>
            {data.map(row =>
              <tr className="border-b hover:surface-1 transition-colors">
                {columns.map(col =>
                  <td className={"text-" + col.align + " padding-y-3 padding-x-4"}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>

  // ─── Loaded: Mobile ───
  if isMobile:
    render card-based layout:
      {data.map(row =>
        <Card variant="compact" className="mb-2">
          {columns.filter(col => !col.hideOnMobile).map(col =>
            <div className="flex justify-between py-1">
              <span className="text-xs text-muted">{col.label}</span>
              <span>{col.render ? col.render(row) : row[col.key]}</span>
            </div>
          )}
        </Card>
      )}

  // ─── Pagination ───
  if pagination:
    render:
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-muted">
          Showing {start}-{end} of {total}
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" disabled={page === 1} onClick={prevPage}>Prev</Button>
          {pageNumbers.map(n => <Button size="sm" variant={n === page ? "primary" : "ghost"}>{n}</Button>)}
          <Button size="sm" variant="ghost" disabled={page === lastPage} onClick={nextPage}>Next</Button>
        </div>
      </div>
```

**Column definition format:**

```
type Column<T> = {
  key: keyof T
  label: string
  align: 'left' | 'center' | 'right'    // default: 'left'
  sortable: boolean                       // default: false
  hideOnMobile: boolean                   // default: false
  width: string                           // e.g., '120px', '20%'
  skeletonWidth: string                   // width of skeleton placeholder
  render: (row: T) => ReactNode           // custom cell renderer
}
```

### 4.5 Form Template

Forms use a state machine approach: `pristine -> dirty -> submitting -> success | error`.

```
Form({ fields, onSubmit, initialValues?, submitLabel? }):
  // ─── State ───
  formState = useFormState(initialValues || deriveDefaults(fields))
  fieldErrors = {}
  formError = null
  status = 'pristine'  // pristine | dirty | submitting | success | error

  // ─── Dirty Tracking ───
  isDirty = !deepEqual(formState, initialValues)
  // Update status to 'dirty' when any field changes from initial value

  // ─── Navigate-Away Warning ───
  useNavigateAwayWarning(isDirty && status !== 'success')
  // browser beforeunload event + router-level guard

  // ─── Validation ───
  validateField(name, value):
    field = fields.find(f => f.name === name)
    for each validator in field.validators:
      result = validator(value, formState)  // pass full state for cross-field validation
      if (result.error) return result.error
    return null

  validateAll():
    errors = {}
    for each field in fields:
      error = validateField(field.name, formState[field.name])
      if (error) errors[field.name] = error
    return Object.keys(errors).length > 0 ? errors : null

  // ─── Validation Timing ───
  // On blur: validate the field that lost focus
  // On change: clear that field's error if it was previously set
  // On submit: validate all fields
  // Cross-field validation: only on submit (e.g., "end date after start date")

  handleBlur(name):
    error = validateField(name, formState[name])
    if (error) fieldErrors[name] = error

  handleChange(name, value):
    formState[name] = value   // (immutable update in practice)
    if (fieldErrors[name]) delete fieldErrors[name]
    status = 'dirty'

  // ─── Submit ───
  handleSubmit(event):
    event.preventDefault()
    errors = validateAll()
    if (errors):
      fieldErrors = errors
      scrollToFirstError()
      focusFirstErrorField()
      return
    status = 'submitting'
    try:
      await onSubmit(formState)
      status = 'success'
    catch (err):
      formError = extractUserMessage(err)
      status = 'error'

  // ─── Render ───
  <form onSubmit={handleSubmit} noValidate>
    {formError &&
      <div role="alert" className="bg-danger/10 text-danger border border-danger/20 rounded padding-3 mb-4">
        {formError}
      </div>
    }

    {fields.map(field =>
      <FormField
        key={field.name}
        label={field.label}
        type={field.type}
        value={formState[field.name]}
        onChange={(val) => handleChange(field.name, val)}
        onBlur={() => handleBlur(field.name)}
        error={fieldErrors[field.name]}
        required={field.required}
        helpText={field.helpText}
        disabled={status === 'submitting'}
        placeholder={field.placeholder}
        options={field.options}          // for select, radio, checkbox-group
        aria-describedby={field.helpText ? `${field.name}-help` : undefined}
        aria-invalid={!!fieldErrors[field.name]}
      />
    )}

    <div className="flex gap-3 mt-6">
      <Button
        type="submit"
        variant="primary"
        loading={status === 'submitting'}
        disabled={!isDirty || status === 'submitting'}
      >
        {status === 'submitting' ? "Saving..." : (submitLabel || "Save")}
      </Button>
      {onCancel &&
        <Button type="button" variant="ghost" onClick={onCancel} disabled={status === 'submitting'}>
          Cancel
        </Button>
      }
    </div>
  </form>
```

**Supported field types:**

| Type | Component | Notes |
|------|-----------|-------|
| `text` | `<input type="text">` | Standard text input |
| `email` | `<input type="email">` | Browser email validation |
| `password` | `<input type="password">` | Toggle visibility button |
| `number` | `<input type="number">` | Min/max/step attributes |
| `textarea` | `<textarea>` | Auto-resize option |
| `select` | `<select>` or custom dropdown | Options array |
| `checkbox` | `<input type="checkbox">` | Boolean toggle |
| `toggle` | Custom toggle switch | Visual alternative to checkbox |
| `radio` | `<input type="radio">` group | Options array |
| `date` | `<input type="date">` or datepicker | Native or custom |
| `file` | `<input type="file">` | Drag-and-drop zone option |

### 4.6 Button Component Template

```
Button({ variant, size, loading, disabled, onClick, children, type?, icon? }):
  // Variants: primary, secondary, danger, ghost
  // Sizes: sm (h-8 text-xs px-3), md (h-10 text-sm px-4), lg (h-12 text-base px-6)

  isDisabled = disabled || loading

  variantStyles = {
    primary:   "bg-accent text-white hover:bg-accent/90 focus-visible:ring-accent",
    secondary: "bg-surface-3 text-primary border hover:bg-surface-2 focus-visible:ring-accent",
    danger:    "bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger",
    ghost:     "text-primary hover:bg-surface-3 focus-visible:ring-accent"
  }

  sizeStyles = {
    sm: "h-8 text-xs px-3 rounded",
    md: "h-10 text-sm px-4 rounded-md",
    lg: "h-12 text-base px-6 rounded-lg"
  }

  <button
    type={type || "button"}
    className={
      "inline-flex items-center justify-center gap-2 font-medium transition-colors " +
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
      "disabled:opacity-50 disabled:cursor-not-allowed " +
      variantStyles[variant] + " " + sizeStyles[size]
    }
    disabled={isDisabled}
    onClick={!isDisabled ? onClick : undefined}
    aria-busy={loading}
    aria-disabled={isDisabled}
  >
    {loading && <Spinner size={size} aria-hidden="true" />}
    {!loading && icon && <Icon name={icon} aria-hidden="true" />}
    <span>{children}</span>
  </button>
```

### 4.7 Badge / Status Component Template

```
StatusBadge({ status, size? }):
  // Size: sm (text-xs px-2 py-0.5), md (text-sm px-2.5 py-1)

  STATUS_MAP = {
    active:    { dot: "bg-success",  bg: "bg-success/10", text: "text-success",  label: "Active",    pulse: true  },
    running:   { dot: "bg-accent",   bg: "bg-accent/10",  text: "text-accent",   label: "Running",   pulse: true  },
    completed: { dot: "bg-success",  bg: "bg-success/10", text: "text-success",  label: "Completed", pulse: false },
    failed:    { dot: "bg-danger",   bg: "bg-danger/10",  text: "text-danger",   label: "Failed",    pulse: false },
    pending:   { dot: "bg-warning",  bg: "bg-warning/10", text: "text-warning",  label: "Pending",   pulse: false },
    cancelled: { dot: "bg-muted",    bg: "bg-muted/10",   text: "text-muted",    label: "Cancelled", pulse: false },
    paused:    { dot: "bg-warning",  bg: "bg-warning/10", text: "text-warning",  label: "Paused",    pulse: false }
  }

  config = STATUS_MAP[status]

  <span
    className={"inline-flex items-center gap-1.5 rounded-full font-medium " + config.bg + " " + config.text + " " + sizeStyles[size]}
    role="status"
    aria-label={config.label}
  >
    <span
      className={"w-1.5 h-1.5 rounded-full " + config.dot + (config.pulse ? " animate-pulse" : "")}
      aria-hidden="true"
    />
    {config.label}
  </span>
```

### 4.8 Skeleton Component Template

Skeletons must match the EXACT dimensions of their loaded counterpart.

```
Skeleton({ variant, width?, height?, lines? }):
  // Animation: shimmer gradient sweep from left to right
  // Base: neutral surface color, rounded, no content

  shimmerStyles = "relative overflow-hidden bg-surface-3 rounded " +
    "before:absolute before:inset-0 before:bg-gradient-to-r " +
    "before:from-transparent before:via-white/20 before:to-transparent " +
    "before:animate-shimmer"

  // Respect prefers-reduced-motion
  // @media (prefers-reduced-motion: reduce) -> use opacity pulse instead of shimmer

  variants:
    text:
      render N lines (default 3):
        {Array(lines).map((_, i) =>
          <div
            className={shimmerStyles + " h-4 mb-2"}
            style={{ width: i === lines - 1 ? "60%" : "100%" }}
          />
        )}

    circle:
      <div className={shimmerStyles + " rounded-full"} style={{ width, height: width }} />

    card:
      <div className={"border rounded-lg padding-4 " + shimmerStyles}>
        <div className="h-4 w-1/3 bg-surface-3 rounded mb-3" />
        <div className="h-8 w-1/2 bg-surface-3 rounded mb-2" />
        <div className="h-3 w-2/3 bg-surface-3 rounded" />
      </div>

    table-row:
      <tr>
        {columnWidths.map(w =>
          <td className="padding-y-3 padding-x-4">
            <div className={shimmerStyles + " h-4"} style={{ width: w }} />
          </td>
        )}
      </tr>

    avatar:
      <div className={shimmerStyles + " rounded-full w-10 h-10"} />
```

### 4.9 Empty State Component Template

```
EmptyState({ icon?, title, description, action? }):
  <div
    className="flex flex-col items-center justify-center py-12 px-4 text-center"
    role="status"
  >
    {icon &&
      <div className="w-12 h-12 text-muted mb-4" aria-hidden="true">
        <Icon name={icon} />
      </div>
    }
    <h3 className="text-lg font-medium text-primary mb-2">{title}</h3>
    <p className="text-sm text-muted mb-6 max-w-sm">{description}</p>
    {action &&
      <Button variant="primary" onClick={action.onClick}>
        {action.label}
      </Button>
    }
  </div>
```

### 4.10 Error State Component Template

```
ErrorState({ error, onRetry?, variant? }):
  // Variants: full-page, inline-banner, inline-section

  // Extract user-friendly message — NEVER show raw errors or stack traces
  message = getUserMessage(error)
  // Map known error codes to actionable messages:
  //   401 -> "Your session has expired. Please sign in again."
  //   403 -> "You don't have permission to view this."
  //   404 -> "This item could not be found."
  //   500 -> "Something went wrong on our end. Please try again."
  //   network -> "Unable to reach the server. Check your connection."

  if variant === "full-page":
    <div className="flex flex-col items-center justify-center min-h-[400px] py-12 px-4 text-center">
      <AlertIcon className="w-12 h-12 text-danger mb-4" aria-hidden="true" />
      <h3 className="text-lg font-medium text-primary mb-2">Something went wrong</h3>
      <p className="text-sm text-muted mb-6 max-w-sm">{message}</p>
      {onRetry && <Button variant="primary" onClick={onRetry}>Try again</Button>}
    </div>

  if variant === "inline-banner":
    <div
      role="alert"
      className="flex items-center gap-3 bg-danger/10 border border-danger/20 text-danger rounded-lg px-4 py-3 animate-slide-down"
    >
      <AlertIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
      <p className="text-sm flex-1">{message}</p>
      {onRetry && <Button size="sm" variant="ghost" onClick={onRetry}>Retry</Button>}
      <button onClick={dismiss} aria-label="Dismiss error" className="shrink-0">
        <CloseIcon className="w-4 h-4" />
      </button>
    </div>

  if variant === "inline-section":
    <div className="flex flex-col items-center py-8 px-4 text-center">
      <AlertIcon className="w-8 h-8 text-danger mb-3" aria-hidden="true" />
      <p className="text-sm text-muted mb-4">{message}</p>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
```

### 4.11 Toast / Notification System Template

```
ToastProvider:
  // ─── Config ───
  MAX_VISIBLE = 3
  DEFAULTS = { success: 4000, info: 4000, warning: 6000, error: 0 }  // 0 = persistent

  // ─── State ───
  toasts = []   // { id, type, message, duration }

  // ─── Actions ───
  addToast(type, message, options?):
    id = generateId()
    duration = options?.duration ?? DEFAULTS[type]
    toast = { id, type, message, duration }
    toasts = [...toasts, toast]

    // Trim to max visible
    if (toasts.length > MAX_VISIBLE):
      remove oldest non-error toast

    // Auto-dismiss (errors are persistent — user must dismiss them)
    if (duration > 0):
      setTimeout(() => removeToast(id), duration)

  removeToast(id):
    // Trigger exit animation, then remove from array after animation completes
    markAsExiting(id)
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id)
    }, 200)  // match animation duration

  // ─── Render ───
  // Desktop: top-right corner
  // Mobile: bottom-center, full width with margins
  <div
    className="fixed z-50 flex flex-col gap-2
      top-4 right-4                          // desktop
      max-md:bottom-4 max-md:left-4 max-md:right-4 max-md:top-auto"  // mobile
    role="region"
    aria-label="Notifications"
    aria-live="polite"
  >
    {toasts.map(toast =>
      <div
        key={toast.id}
        className={
          "flex items-start gap-3 rounded-lg shadow-lg border px-4 py-3 " +
          "animate-slide-in " +
          (toast.exiting ? "animate-slide-out " : "") +
          typeStyles[toast.type]
        }
        role="alert"
      >
        <TypeIcon type={toast.type} className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm flex-1">{toast.message}</p>
        <button
          onClick={() => removeToast(toast.id)}
          aria-label="Dismiss notification"
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
    )}
  </div>

  // ─── Context / Hook ───
  Export a hook: useToast() => { success, error, warning, info }
  Usage: toast.success("Changes saved")
         toast.error("Failed to save. Please try again.")
```

### 4.12 Layout Shell Template

```
Shell:
  // ─── State ───
  sidebarOpen = useLocalStorage('sidebar-open', true)
  isMobile = useMediaQuery('(max-width: 768px)')

  // Mobile: sidebar is overlay with backdrop, closed by default
  // Desktop: sidebar is persistent, can be collapsed to icon-only

  <div className="h-screen flex bg-surface-1 overflow-hidden">

    // ─── Sidebar ───
    <aside
      className={
        "flex flex-col bg-surface-2 border-r transition-all duration-200 " +
        (isMobile
          ? "fixed inset-y-0 left-0 z-50 w-64 " + (sidebarOpen ? "translate-x-0" : "-translate-x-full")
          : sidebarOpen ? "w-56" : "w-16")
      }
      aria-label="Main navigation"
    >
      // Logo / Brand
      <div className="h-14 flex items-center px-4 border-b shrink-0">
        {(sidebarOpen || isMobile) ? <FullLogo /> : <IconLogo />}
      </div>

      // Navigation
      <nav className="flex-1 overflow-y-auto py-2">
        {routes.map(route =>
          <NavItem
            key={route.path}
            icon={route.icon}
            label={route.label}
            path={route.path}
            active={currentPath.startsWith(route.path)}
            collapsed={!sidebarOpen && !isMobile}
          />
        )}
      </nav>

      // Sidebar Footer
      <div className="border-t p-3 shrink-0">
        {primaryCTA && <Button variant="primary" className="w-full">{primaryCTA}</Button>}
      </div>
    </aside>

    // ─── Mobile Backdrop ───
    {isMobile && sidebarOpen &&
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
    }

    // ─── Main Content ───
    <div className="flex-1 flex flex-col overflow-hidden">
      // Header
      <header className="h-14 bg-surface-2 border-b flex items-center px-4 shrink-0 gap-3">
        {isMobile &&
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="p-2 -ml-2 rounded hover:bg-surface-3"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
        }
        {!isMobile &&
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            className="p-2 -ml-2 rounded hover:bg-surface-3"
          >
            <SidebarIcon className="w-5 h-5" />
          </button>
        }
        <h1 className="text-lg font-semibold flex-1">{pageTitle}</h1>
        <div className="flex items-center gap-2">
          {statusIndicators}
          {userMenu}
        </div>
      </header>

      // Content Area
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <Outlet />  // or router-outlet, slot, etc. depending on framework
      </main>
    </div>
  </div>
```

---

## 5. Accessibility Checklist

Apply this checklist to EVERY generated component without exception.

### Semantic HTML

- Use `<button>` for actions, `<a>` for navigation, `<nav>` for navigation regions,
  `<main>` for primary content, `<aside>` for sidebars, `<header>`/`<footer>` for
  their respective regions.
- Use heading hierarchy (`h1` through `h6`) in logical order. One `h1` per page.
- Use `<ul>`/`<ol>` for lists, `<table>` for tabular data.
- Never use `<div onClick>` when `<button>` is correct.

### ARIA

- Icon-only buttons MUST have `aria-label`.
- Loading states use `aria-busy="true"`.
- Error messages use `role="alert"` for immediate screen reader announcement.
- Toast regions use `aria-live="polite"`.
- Sort indicators use `aria-sort="ascending"` / `"descending"` / `"none"`.
- Expandable sections use `aria-expanded`.
- Form fields with errors use `aria-invalid="true"` and `aria-describedby` pointing
  to the error message element.

### Focus Management

- All interactive elements must have visible focus styles: `focus-visible:ring-2
  ring-accent ring-offset-2`.
- After modal open: focus moves to first focusable element inside.
- After modal close: focus returns to the trigger element.
- After toast appears: do NOT steal focus. Use `aria-live` instead.
- After inline error: focus the first field with an error on form submit.
- Tab order follows visual order. Never use positive `tabindex` values.

### Keyboard Navigation

| Element | Key | Action |
|---------|-----|--------|
| Button | Enter, Space | Activate |
| Link | Enter | Navigate |
| Modal | Escape | Close |
| Dropdown | Escape | Close, return focus to trigger |
| Dropdown | Arrow Up/Down | Navigate options |
| Tab list | Arrow Left/Right | Switch tabs |
| Table sort | Enter, Space | Toggle sort |

### Color and Contrast

- Never use color as the ONLY indicator. Always pair with icons, text, or patterns.
- Status badges include a dot AND text label.
- Error states include an icon AND red color AND descriptive text.
- Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text.

### Motion and Animation

- ALL animations must respect `prefers-reduced-motion`:
  ```
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
- No auto-playing animations that cannot be paused.
- Skeleton shimmer switches to a subtle opacity pulse under reduced motion.

### Touch Targets

- Minimum 44x44px touch target on mobile for all interactive elements.
- If visual design requires smaller elements, extend the hit area with padding or
  `::after` pseudo-elements.

---

## 6. Responsive Generation Rules

### Breakpoints

| Breakpoint | Class Prefix | Target Device | Layout Strategy |
|-----------|-------------|---------------|-----------------|
| Default | (none) | Mobile (< 640px) | Single column, stacked |
| `sm:` | 640px+ | Large phone / small tablet | Minor adjustments |
| `md:` | 768px+ | Tablet | Two columns, side panels |
| `lg:` | 1024px+ | Desktop | Full layout, sidebar |
| `xl:` | 1280px+ | Large desktop | Wider content, more columns |

### Mobile-First Rules

1. Start with mobile layout. ADD complexity at larger breakpoints. Never start with
   desktop and subtract.
2. Tables become card lists on mobile. Use horizontal scroll only when data comparison
   across rows is critical (financial data, feature comparison).
3. Side-by-side layouts stack vertically on mobile.
4. Persistent sidebar becomes hamburger overlay on mobile.
5. Reduce padding and gap by one step on mobile (`p-4` desktop becomes `p-3` mobile).
6. Hide non-essential data columns on mobile, but NEVER hide action buttons.
7. Modal dialogs become full-screen sheets on mobile (slide up from bottom).
8. Multi-column forms become single-column on mobile.
9. Large headings scale down: `text-3xl` desktop becomes `text-xl` mobile.
10. Horizontal navigation becomes a bottom tab bar or hamburger menu on mobile.

### Responsive Patterns by Component

| Component | Mobile | Tablet | Desktop |
|-----------|--------|--------|---------|
| KPI cards | 1 col, stacked | 2 col grid | 3-4 col grid |
| Data table | Card list | Table with hidden cols | Full table |
| Form | Single column | Single column | Two columns for short fields |
| Sidebar | Overlay | Overlay or narrow | Persistent |
| Modal | Full screen sheet | Centered, 80% width | Centered, max-w-lg |
| Tabs | Horizontal scroll | Full width | Full width |

---

## 7. File Naming Conventions

### Detection

Read existing files to detect the project's naming convention. Look at 5-10 component
files to establish the pattern.

### Default Conventions (When No Convention Exists)

| Framework | File Convention | Example |
|-----------|----------------|---------|
| React | PascalCase.tsx | `JobListPage.tsx`, `KpiCard.tsx` |
| Angular | kebab-case.component.ts | `job-list-page.component.ts` |
| Vue | PascalCase.vue | `JobListPage.vue` |
| Svelte | PascalCase.svelte | `JobListPage.svelte` |
| Next.js (App Router) | page.tsx in route folder | `app/jobs/page.tsx` |
| Nuxt | kebab-case.vue in pages/ | `pages/job-list.vue` |

### Directory Structure

```
src/
  components/
    {feature}/                  # Feature folder (e.g., jobs/, dashboard/)
      {FeaturePage}.tsx         # Page-level component
      {FeatureCard}.tsx         # Feature-specific component
      {feature}.types.ts        # Types for this feature
      {feature}.hooks.ts        # Hooks for this feature (or individual files)
    shared/                     # Cross-feature shared components
      Button.tsx
      Card.tsx
      DataTable.tsx
      StatusBadge.tsx
      Skeleton.tsx
      EmptyState.tsx
      ErrorState.tsx
    layout/                     # Layout components
      Shell.tsx
      Sidebar.tsx
      Header.tsx
  hooks/                        # Global reusable hooks
    use-swrpolling.ts
    use-url-params.ts
    use-media-query.ts
    use-tab-visibility.ts
    use-local-storage.ts
    use-navigate-away-warning.ts
  types/                        # Global type definitions
    api.ts
    common.ts
  constants/                    # Status maps, config, route definitions
    status.ts
    routes.ts
```

### Co-located Files

When a component has associated styles, tests, or stories, co-locate them:

```
components/jobs/
  JobListPage.tsx
  JobListPage.test.tsx
  JobListPage.module.css       # if CSS Modules
  JobListPage.stories.tsx      # if Storybook
```

---

## 8. Generation Checklist

Before writing ANY component, verify every item on this checklist. Skip nothing.

### Functional Completeness

- [ ] All states from the functional spec are implemented: loading, loaded, empty,
      error, refreshing, partial failure
- [ ] Polling and data fetching match the spec's endpoint table (correct URLs, intervals,
      HTTP methods, cache strategy, error handling)
- [ ] Optimistic updates are implemented where the spec calls for them
- [ ] URL state syncs correctly for filters, sort, and pagination
- [ ] Navigate-away warnings are present on dirty forms
- [ ] All user actions from the spec have corresponding handlers

### Visual and Responsive

- [ ] Responsive behavior matches the spec's breakpoint table
- [ ] Mobile layout is usable without horizontal scrolling
- [ ] Touch targets are at least 44x44px on mobile
- [ ] Skeleton loading states match the dimensions of loaded content
- [ ] Empty states are centered and include a call-to-action
- [ ] Error states are human-readable with actionable next steps

### Design System Compliance

- [ ] Component uses the design system's tokens (not hardcoded hex, px, etc.)
- [ ] Spacing follows the token scale (4, 8, 12, 16, 24, 32, 48)
- [ ] Typography uses defined type scale and weights
- [ ] Colors come from the semantic palette (surface, text, accent, danger, etc.)
- [ ] Border radius, shadows, and transitions match the system

### Code Quality

- [ ] File follows the project's naming and organization convention
- [ ] TypeScript types are defined for ALL props and data shapes
- [ ] No `console.log` statements
- [ ] No hardcoded strings (use constants, enums, or i18n-ready patterns)
- [ ] No deep nesting (max 4 levels)
- [ ] Functions are under 50 lines
- [ ] Immutable state updates (spread operators, not mutations)
- [ ] All side effects are cleaned up on unmount (intervals, listeners, subscriptions)

### Accessibility

- [ ] Semantic HTML elements used throughout
- [ ] ARIA labels on all icon-only buttons
- [ ] Focus-visible styles on all interactive elements
- [ ] Keyboard navigation works for all interactions
- [ ] Color is never the only indicator
- [ ] `aria-live` regions for dynamic content updates
- [ ] `prefers-reduced-motion` respected for all animations
- [ ] Form fields have labels, error associations, and required indicators

### Performance

- [ ] No unnecessary re-renders (memoize expensive computations and stable callbacks)
- [ ] Large lists use virtualization (100+ items)
- [ ] Images have explicit dimensions (prevent layout shift)
- [ ] Heavy components are lazy-loaded when below the fold
- [ ] Bundle impact considered (no large library imports for small features)

---

## Important

This file describes PATTERNS, not literal code for a specific framework. The Functional
Design skill adapts these patterns to the detected framework, styling approach, and
project conventions at generation time. The pseudo-code above is a blueprint. The output
is real, production-ready, framework-specific code that follows every convention of the
target project.
