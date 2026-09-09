# State Specifications Reference

Templates for modeling component states, transitions, and persistence rules.
Framework-agnostic. Use these as starting points, then trim to fit the feature.

---

## 1. State Machine Template

Use this format for any component that has discrete modes of behavior.

### States

| State | Description | Data Available | Entry Action | Exit Action |
|-------|-------------|----------------|--------------|-------------|
| `idle` | Default resting state | (list fields) | — | — |
| `active` | User is interacting | (list fields) | Start timer | Stop timer |
| `error` | Operation failed | Error object | Log error | Clear error |

### Transitions

| Current State | Event | Guard | Action | Next State |
|---------------|-------|-------|--------|------------|
| `idle` | USER_CLICK | — | fetchData() | `loading` |
| `loading` | FETCH_SUCCESS | — | storeData() | `loaded` |
| `loading` | FETCH_FAILURE | — | storeError() | `error` |
| `error` | RETRY | retryCount < 3 | incrementRetry() | `loading` |
| `error` | DISMISS | — | clearError() | `idle` |

### Data Context

```
StateContext {
  // Shared across all states
  id: string
  timestamp: number

  // State-specific (nullable when not in relevant state)
  data?: T            // available in: loaded, refreshing
  error?: ErrorInfo   // available in: error
  progress?: number   // available in: loading
}
```

### Rules

- **Initial state** is marked with `-->` or listed first.
- **Terminal states** (if any) are marked with `[final]`.
- Every non-terminal state MUST have at least one outbound transition.
- Every non-initial state MUST have at least one inbound transition.

---

## 2. Common State Sets

### Form States

```
                       +-----------+
                       |  pristine |<-----------+
                       +-----+-----+            |
                             |                  |
                        FIELD_CHANGE            |
                             |                  |
                       +-----v-----+        RESET /
                  +--->|   dirty   |      clearFields()
                  |    +-----+-----+            |
           FIELD_ |          |                  |
           CHANGE |     SUBMIT                  |
                  |  [form.valid]               |
                  |          |                  |
                  |    +-----v------+           |
                  +----| submitting |           |
                       +-----+------+           |
                             |                  |
                    +--------+--------+         |
                    |                 |         |
              SUBMIT_OK         SUBMIT_FAIL    |
                    |                 |         |
              +-----v-----+   +------v----+   |
              |  success   |   |   error   |   |
              +-----+------+   +-----+-----+   |
                    |                |          |
                    +---CONTINUE-----+----------+
```

**States:**

| State | Data Available | Notes |
|-------|----------------|-------|
| `pristine` | Default/initial values | No user changes. Submit disabled. |
| `dirty` | Current field values, validation results | At least one field changed. |
| `submitting` | Frozen field values | All inputs disabled. Show spinner. |
| `success` | Server response | Transient: auto-advance or show confirmation. |
| `error` | Server error, field values preserved | User can retry without re-entering data. |

**Field-Level Validation States (per field):**

| State | Trigger | Display |
|-------|---------|---------|
| `untouched` | Initial | No validation indicators |
| `touched-valid` | Blur + passes rules | Success indicator (checkmark, green border) |
| `touched-invalid` | Blur + fails rules | Error message, red border |
| `validating` | Async validation in flight | Spinner on field |
| `validated-async` | Async result returned | Show pass/fail from server |

**Draft Persistence:**
- Debounce field changes (1-2 seconds).
- Persist to session storage on each debounced change.
- Restore on mount if draft exists and form is `pristine`.
- Clear draft on successful submit or explicit discard.

---

### Data View States

```
              +-------+
              | empty |
              +---+---+
                  |
              LOAD_DATA
                  |
            +-----v-----+
            |  loading   |-----LOAD_FAIL----+
            +-----+------+                  |
                  |                         |
              LOAD_OK                  +----v----+
                  |                    |  error   |
            +-----v-----+             +----+-----+
        +-->|  loaded    |                 |
        |   +-----+------+            RETRY|
        |         |                        |
     REFRESH_OK   REFRESH              LOAD_DATA
        |         |                        |
        |   +-----v-------+               |
        +---|  refreshing  |---REFRESH_FAIL+
            +--------------+
```

**States:**

| State | Data Available | UI Pattern |
|-------|----------------|------------|
| `empty` | Nothing | Empty state illustration + CTA |
| `loading` | Nothing (show skeleton) | Skeleton screen or spinner |
| `loaded` | Full dataset | Render content |
| `refreshing` | Previous dataset (stale) | Content visible + subtle refresh indicator |
| `error` | Previous dataset if any, error info | Error banner; show stale data if available |

**Pagination Sub-States (when `loaded` or `refreshing`):**

| Sub-State | Meaning |
|-----------|---------|
| `page-loading` | Next page in flight, current pages visible |
| `page-complete` | All requested pages loaded |
| `end-of-list` | Server indicated no more pages |

**Stale Data Rules:**
- Data older than threshold shows a "last updated X ago" indicator.
- Background refresh on focus/reconnect when stale.
- User can force refresh at any time from `loaded` or `error`.

---

### Auth States

```
  +----------+      LOGIN       +-----------------+
  | anonymous|----------------->| authenticating  |
  +----+-----+                  +--------+--------+
       ^                                 |
       |                        +--------+--------+
   LOGOUT /                     |                 |
   clearSession()          AUTH_OK           AUTH_FAIL
       |                        |                 |
       |                  +-----v--------+        |
       +--FORCE_LOGOUT----|authenticated |        |
       |                  +-----+--------+        |
       |                        |                 |
       |                   TOKEN_EXPIRING         |
       |                        |                 |
       |                  +-----v--------+        |
       +--REAUTH_FAIL----| expired       |<-------+
                          +-----+--------+
                                |
                           AUTO_REFRESH
                                |
                          +-----v-----------+
                          | reauthenticating |--REAUTH_OK--> authenticated
                          +-----------------+
```

**States:**

| State | Available Data | Behavior |
|-------|----------------|----------|
| `anonymous` | Nothing | Show login UI. Redirect protected routes to login. |
| `authenticating` | Credentials in flight | Disable login form. Show spinner. |
| `authenticated` | User profile, tokens | Full app access. Start token refresh timer. |
| `expired` | Stale user profile | Show "session expiring" warning. Attempt silent refresh. |
| `reauthenticating` | Stale profile, refresh token | Silent attempt. On fail, drop to anonymous. |

**Token Refresh Timeline:**
1. Token issued with expiry `T`.
2. At `T - buffer` (e.g., 60s before expiry): transition to `expired`, attempt silent refresh.
3. Silent refresh succeeds: back to `authenticated` with new token.
4. Silent refresh fails: prompt user to re-login or force logout.

**Session Timeout Warning:**
- Show warning dialog at `inactivity_limit - warning_buffer`.
- User action during warning resets inactivity timer.
- No action: transition to `anonymous` + clear session.

---

### CRUD Entity States

```
  +----------+     CREATE     +-----------+
  |  viewing |--------------->| creating  |
  +----+-----+                +-----+-----+
       |  ^                         |
       |  |    VIEW /          SAVE | CANCEL
       |  | clearSelection()        |     |
       |  +-------------------------+-----+
       |
       |  EDIT          +-----------+
       +--------------->|  editing  |
       |                +-----+-----+
       |                      |
       |                 SAVE | CANCEL
       |                      |     |
       |  <-------------------+-----+
       |
       |  DELETE         +-----------+     CONFIRM     +-----------+
       +--------------->|  deleting  |---------------->|  archived |
                        +-----+-----+                  +-----------+
                              |
                          CANCEL
                              |
                        viewing <--+
```

**Optimistic Update Pattern:**
1. On SAVE: immediately update UI to reflect new state.
2. Fire API request in background.
3. On success: no visible change (already showing correct state).
4. On failure: roll back to previous state, show error.
5. Keep a snapshot of pre-edit state for rollback.

**Conflict Detection:**
- On EDIT entry: record entity version/ETag.
- On SAVE: send version with request.
- Server returns 409 Conflict: show diff, let user choose "overwrite" or "reload".

**Soft Delete vs. Hard Delete:**

| Type | Transition | Recovery | Storage |
|------|-----------|----------|---------|
| Soft delete | `viewing` -> `archived` | RESTORE -> `viewing` | Flagged in DB, excluded from default queries |
| Hard delete | `viewing` -> `[removed]` (terminal) | Not recoverable | Purged after confirmation |

---

### Toggle/Selection States

**Single Item:**

| State | Meaning |
|-------|---------|
| `unselected` | Not chosen |
| `selected` | Chosen |

**Parent of Partial Selection (tree/checkbox group):**

| State | Meaning |
|-------|---------|
| `unselected` | No children selected |
| `indeterminate` | Some children selected |
| `selected` | All children selected |

**Multi-Select Patterns:**

| Pattern | Behavior |
|---------|----------|
| Independent | Each item toggles independently |
| Select-all | Header checkbox selects/deselects all visible |
| Select-all with exclusions | "All N selected" minus explicitly excluded items; scales to large datasets |
| Range select | Shift+click selects range from last click |

**Select-All With Exclusions Context:**
```
SelectionContext {
  mode: 'include' | 'exclude'
  ids: Set<string>
  totalCount: number
}

// 'include' mode: ids = explicitly selected items
// 'exclude' mode: ids = explicitly deselected items (everything else is selected)
```

---

### Wizard / Stepper States

**Per-Step States:**

| State | Meaning | Navigation |
|-------|---------|------------|
| `unvisited` | User has not reached this step | Blocked (unless wizard allows free navigation) |
| `active` | Currently displayed step | N/A |
| `completed` | Step passed validation and user advanced | Can revisit |
| `skipped` | Explicitly skipped (optional step) | Can revisit |
| `error` | Was completed but upstream change invalidated it | Must revisit before final submit |

**Overall Wizard States:**

| State | Meaning |
|-------|---------|
| `in-progress` | At least one step active or unvisited |
| `review` | All required steps completed, showing summary |
| `submitting` | Final submission in flight |
| `complete` | Successfully submitted (terminal or restart) |
| `abandoned` | User navigated away; persist draft if configured |

**Step Dependency Rules:**
- Linear wizard: step N requires step N-1 completed.
- Branching wizard: define prerequisite map per step.
- Free-navigation wizard: any step accessible, but submit requires all required steps completed.

---

### Real-Time Connection States

```
  +--------------+    CONNECT     +-------------+
  | disconnected |--------------->| connecting  |
  +------+-------+                +------+------+
         ^                               |
         |                      +--------+--------+
     MAX_RETRIES                |                 |
     EXCEEDED               OPEN              CONNECT_FAIL
         |                      |                 |
         |               +------v------+   +------v---------+
         +---------------| connected   |   | reconnecting   |--+
                         +------+------+   +------+---------+  |
                                |                 |             |
                           CONNECTION_LOST        RECONNECT_OK  |
                                |                 |         RECONNECT_FAIL
                                +--> reconnecting +    [retries < max]
                                                        |
                                                   backoff wait
                                                        |
                                                        +--+
```

**Reconnection Backoff:**
```
attempt 1:  1s delay
attempt 2:  2s delay
attempt 3:  4s delay
attempt 4:  8s delay
attempt 5: 16s delay (cap)
```
Add jitter: `delay * (0.5 + random() * 0.5)` to prevent thundering herd.

**Offline Queue:**
- While `disconnected` or `reconnecting`: queue outbound messages.
- On `connected`: flush queue in order.
- Show pending count to user.
- Messages older than TTL are discarded from queue.

**Stale Data Indicator:**
- On entering `reconnecting`: start staleness timer.
- After threshold (e.g., 30s): show "data may be outdated" banner.
- On `connected` re-entry: fetch latest state, clear indicator.

---

## 3. Transition Specification Format

Standard notation:

```
FromState --> Event [Guard] / Action --> ToState
```

### Simple Transition

No guard, no side effect.

```
idle --> CLICK --> active
```

### Guarded Transition

Transition only fires if the guard evaluates to true.

```
dirty --> SUBMIT [form.valid] / submitForm() --> submitting
dirty --> SUBMIT [!form.valid] / showErrors() --> dirty
```

### Transition With Side Effects

The action runs during the transition, before entering the next state.

```
loaded --> DELETE [hasPermission] / callDeleteAPI(id) --> deleting
```

### Self-Transition

Returns to the same state, but fires exit/entry actions and resets state timers.

```
error --> RETRY [retryCount < maxRetries] / incrementRetryCount() --> error
```

Use self-transitions for:
- Retry loops with counters.
- Polling intervals that reset.
- Input debouncing that restarts a timer.

### Null Transition (Internal / No State Change)

Updates context data without changing state or firing entry/exit actions.

```
loaded --> SORT_CHANGE / updateSortOrder() --> loaded (internal)
```

Mark with `(internal)` to distinguish from self-transitions that re-trigger entry/exit.

### Deferred Event

Event is remembered and processed when the machine reaches a state that handles it.

```
loading --> USER_INPUT / defer --> (processed when idle)
```

Use sparingly. Prefer disabling the UI element or queuing at the application layer.

---

## 4. Compound States

Most real components have multiple independent state dimensions running simultaneously.

### The Problem

A data table might have:
- **Data state**: empty | loading | loaded | error
- **Selection state**: none | some | all
- **Sort state**: unsorted | asc | desc (per column)
- **Filter state**: unfiltered | filtered

Modeling every combination as a flat state creates `4 * 3 * 3 * 2 = 72` states. This is unmanageable.

### Solution: Orthogonal Regions

Model each dimension as an independent state machine. They run in parallel.

```
DataTable {
  [data]:      empty | loading | loaded | error
  [selection]: none | some | all
  [sort]:      { column: string | null, direction: asc | desc }
  [filter]:    { active: boolean, criteria: FilterCriteria }
}
```

Each region has its own transitions. Cross-region communication happens through shared context or events that multiple regions listen to.

**Cross-Region Event Example:**
```
Event: DATA_LOADED
  [data]  region: loading --> loaded
  [selection] region: some --> none  (reset selection when data changes)
```

### Hierarchical States

When some states have sub-behavior that only applies in that parent state.

```
authenticated {
  active {
    browsing
    editing
    searching
  }
  idle {
    warning-shown
    auto-saving
  }
}
```

Rules:
- Entering `authenticated` defaults to `active.browsing`.
- Events handled by `active` apply to all sub-states (`browsing`, `editing`, `searching`).
- An event not handled by a sub-state bubbles up to the parent.

### State Composition Pattern

For component APIs, expose compound state as a single derived object.

```
ComponentState {
  // Primary dimension
  phase: 'loading' | 'ready' | 'error'

  // Secondary dimensions (independent)
  selection: SelectionState
  sort: SortState
  filter: FilterState

  // Derived (computed from dimensions)
  canSubmit: boolean        // ready && selection.count > 0
  showEmptyState: boolean   // ready && filteredData.length === 0
  isStale: boolean          // ready && lastFetch < threshold
}
```

Consumers read derived booleans. They should not need to check multiple dimensions manually.

---

## 5. Persistence Rules

### Decision Matrix

| State Category | Survives Navigation? | Survives Refresh? | Survives Session End? | Storage Mechanism |
|----------------|:---:|:---:|:---:|---------|
| Current route / page | Yes | Yes | No | URL (path + query params) |
| Sort / filter / pagination | Yes | Yes | No | URL query params |
| Search query | Yes | Yes | No | URL query param |
| Form draft (short forms) | No | No | No | Memory |
| Form draft (long forms) | Yes | Yes | No | Session storage |
| Scroll position | Sometimes | No | No | Memory or session storage |
| Auth tokens | Yes | Yes | Configurable | Secure cookie or session storage |
| User preferences | Yes | Yes | Yes | Local storage or server-persisted |
| Selected items | No | No | No | Memory |
| Expanded/collapsed UI | Configurable | Configurable | No | Session or local storage |
| Wizard progress | Yes | Yes | No | Session storage |
| Shopping cart | Yes | Yes | Yes | Local storage + server sync |
| Notification read state | Yes | Yes | Yes | Server-persisted |
| Dark/light mode | Yes | Yes | Yes | Local storage + system preference |

### Storage Guidance

**URL-Driven State (back-button friendly):**
- Current view, tab, page number, sort, filters, search.
- Rule: if a user shares the URL, the recipient should see the same view.
- Encode as path segments or query parameters, not hash fragments.
- Keep URLs human-readable. Compress complex filter state if needed.

**Session Storage (survives refresh, lost on tab close):**
- Form drafts, wizard progress, ephemeral UI state.
- Key format: `{feature}:{entity-id}:{state-type}`.
- Set a TTL. Clean up on successful completion.

**Local Storage (survives session):**
- User preferences, theme, dismissed banners, onboarding progress.
- Key format: `{app}:{user-id}:{preference}`.
- Keep total size under 2MB. Audit periodically.
- Never store sensitive data (tokens, PII) in local storage.

**Memory Only (ephemeral):**
- Hover states, focus states, animation progress.
- Temporary selection, drag state, tooltip visibility.
- Anything that would be confusing if restored after navigation.

### Hydration Priority

When restoring state on mount, apply in this order:
1. **URL params** (highest authority -- user explicitly navigated here).
2. **Server state** (source of truth for entities).
3. **Session storage** (drafts, wizard progress).
4. **Local storage** (preferences).
5. **Defaults** (fallback).

If sources conflict, higher-priority source wins.

---

## 6. State Machine Composition Checklist

Validate every state machine against this list before implementation.

### Structural Completeness

- [ ] Every state has at least one inbound transition (except the initial state).
- [ ] Every state has at least one outbound transition (except terminal states).
- [ ] There is exactly one initial state.
- [ ] Terminal states (if any) are explicitly marked and intentional.
- [ ] No orphan states exist (unreachable from initial state).
- [ ] No dead-end states exist unintentionally (reachable but no exit).

### Error Handling

- [ ] Every error state has at least one recovery path (retry, reset, dismiss).
- [ ] API call states have both success AND failure transitions.
- [ ] Network-dependent transitions handle timeout (not just success/fail).
- [ ] Validation failures return to a state where the user can correct input.
- [ ] Error context is preserved (user does not lose work on failure).

### Loading and Async

- [ ] Every loading state has a timeout transition to error or retry.
- [ ] Long-running operations show progress or indeterminate indicator.
- [ ] Rapid state transitions are debounced (no flicker between loading and loaded).
- [ ] Minimum display time for loading indicators (300-500ms) to prevent flash.
- [ ] Cancellation is possible for user-initiated async operations.

### User Control

- [ ] User-initiated actions have cancel or undo paths where applicable.
- [ ] Destructive transitions (delete, discard, overwrite) have confirmation guards.
- [ ] Back/forward navigation does not break state consistency.
- [ ] Keyboard users can trigger every transition that mouse users can.
- [ ] Focus is managed on state transitions (focus moves to relevant element).

### Data Integrity

- [ ] Optimistic updates have rollback paths on failure.
- [ ] Concurrent edit scenarios are handled (conflict detection or last-write-wins).
- [ ] Stale data is detectable and communicable to the user.
- [ ] Draft data is saved before destructive navigation (or user is warned).
- [ ] State context is cleaned up when component unmounts or entity is deleted.

### Performance

- [ ] Transition side effects are non-blocking where possible.
- [ ] State changes batch-update the UI (no intermediate renders for multi-step transitions).
- [ ] Large data in state context is referenced (by ID), not duplicated.
- [ ] Polling or subscription states have proper cleanup on exit.
- [ ] Memory-held state is released when no longer needed.

### Accessibility

- [ ] State changes that affect content announce updates to screen readers (live regions).
- [ ] Loading states communicate progress or busy status to assistive technology.
- [ ] Error states move focus to the error message or summary.
- [ ] Disabled states communicate the reason (not just grayed out).
- [ ] Confirmation dialogs are keyboard-trappable and announce themselves.

### Testing

- [ ] Every transition has at least one test case.
- [ ] Guard conditions have tests for both true and false outcomes.
- [ ] Rapid event sequences are tested (double-click, race conditions).
- [ ] State machines can be tested in isolation from UI rendering.
- [ ] Edge case: events that arrive in unexpected states are handled (ignored or queued).
