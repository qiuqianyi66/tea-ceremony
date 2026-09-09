# Data Flow Patterns

Patterns for data architecture decisions in frontend applications. Framework-agnostic.

---

## 1. Client vs. Server State Decision Matrix

Use this matrix to determine where a piece of data should live.

| Characteristic | Server State | Client State | URL State | Derived State |
|---------------|:---:|:---:|:---:|:---:|
| Source of truth is API | X | | | |
| Multiple users see same data | X | | | |
| Only current user cares | | X | | |
| Should survive page refresh | X | | X | |
| Part of shareable link | | | X | |
| Computed from other state | | | | X |
| Needs offline access | X | X | | |
| Changes on user interaction only | | X | X | |
| Backend enforces constraints | X | | | |

### Server State

- **Definition**: Data owned by the backend, accessed via API.
- **Examples**: User profiles, entity lists, configuration, permissions, feature flags.
- **Management**: Cache + synchronization layer. The client holds a copy, never the original.
- **Invalidation**: Time-based, event-based, or manual (see Section 2).
- **Rule**: Never mutate directly. Always mutate through API, then invalidate or update the local cache.
- **Anti-pattern**: Storing server data in a client-side store and modifying it without syncing back. This creates two sources of truth that will diverge.

### Client State

- **Definition**: UI-only state not persisted to the backend.
- **Examples**: Form drafts, wizard step, modal open/closed, selected items, accordion expansion, sidebar collapsed, drag-in-progress.
- **Management**: Component state or a client-side store, depending on scope.
- **Persistence tiers**:
  - **Memory** (ephemeral): Lost on navigation or refresh. Use for transient UI state.
  - **Session storage** (survives refresh): Lost when tab closes. Use for in-progress work.
  - **Local storage** (survives session): Persists across sessions. Use for preferences.
- **Rule**: If you need this data on another device, it is not client state -- it is server state.
- **Anti-pattern**: Putting UI-only state (like "is dropdown open") in a global store. Keep ephemeral state as close to the component as possible.

### URL State

- **Definition**: State encoded in the URL (query params, path segments, hash fragments).
- **Examples**: Current page number, active filters, sort order, search query, selected tab, open item ID, date range.
- **Management**: Router and URL synchronization. URL is the source of truth; UI reads from it.
- **Rule**: If the user should be able to bookmark it or share it, it belongs in the URL.
- **Serialization**: Keep URL params flat and human-readable. Avoid base64-encoded blobs.
- **Anti-pattern**: Storing filter state in a client-side store but not reflecting it in the URL. The user cannot share or bookmark the filtered view.

### Derived State

- **Definition**: Computed from other state. Never stored independently.
- **Examples**: Filtered lists, aggregated totals, validation status, "has unsaved changes" flag, formatted display values, permission checks combining role + resource.
- **Management**: Computed/selector/memo pattern. Recalculate when dependencies change.
- **Rule**: If you can compute it, do not store it. Storing derived state creates synchronization bugs.
- **Performance**: Memoize expensive computations. Recompute cheap ones on every render/change cycle.
- **Anti-pattern**: Storing `filteredItems` alongside `items` and `filter`. When `items` changes, you must remember to recompute `filteredItems`. You will forget. Use a selector.

---

## 2. Cache Strategy Patterns

### Time-Based Cache (TTL)

- **How it works**: Cache the API response for N seconds/minutes. Serve from cache until expired, then fetch fresh.
- **When to use**: Data changes infrequently, exact freshness is not critical.
- **Configuration guidelines**:
  - Short TTL (30s-5min): Active data the user is working with (entity details, list pages).
  - Long TTL (1hr+): Reference data (dropdown options, categories, country lists).
  - Very long TTL (24hr+): Essentially static data (feature flags fetched at login, app config).
- **Pitfall**: Stale data visible to the user until TTL expires. Show a "last updated" timestamp when freshness matters.
- **Cache key**: Include all parameters that affect the response (endpoint + query params + user context).

### Stale-While-Revalidate (SWR)

- **How it works**: Serve cached data immediately. Fetch fresh data in the background. Replace cached data when the fresh response arrives.
- **When to use**: Data should feel instant but freshness still matters. Dashboards, list views, profiles.
- **UX implication**: The user sees stale data briefly, then content may update. This can cause layout shift if the data shape changes.
- **When NOT to use**: When stale data could cause the user to take a wrong action (financial balances, permission checks, inventory counts for purchasing).
- **Optimization**: Compare fresh response to cached response. Only trigger a UI update if the data actually changed.

### Event-Based Invalidation

- **How it works**: Cache until a specific event occurs (user action, push notification, WebSocket message, tab focus).
- **When to use**: When you know exactly what actions change the data.
- **Examples**:
  - User edits an entity -> invalidate that entity's cache and any list containing it.
  - New item created -> invalidate the list cache.
  - User changes role -> invalidate permission cache.
  - Tab regains focus -> refetch active queries.
- **Pitfall**: Missing an invalidation event leaves stale data permanently cached. Pair with a long TTL as a safety net.
- **Implementation**: Maintain a mapping of cache keys to invalidation events. Centralize this mapping; do not scatter it across components.

### Optimistic Cache

- **How it works**: Update the cache immediately with the expected result. Send the API request asynchronously. Reconcile when the response arrives.
- **When to use**: High-confidence operations where the server almost always accepts (toggle, increment, simple field edit).
- **Rollback**: If the server rejects the operation, revert the cache to the previous snapshot and show an error notification.
- **When NOT to use**: Complex operations, operations that might conflict with other users, anything involving money or irreversible consequences.
- **Snapshot**: Always capture the pre-mutation state before applying the optimistic update. Without it, rollback is impossible.

### No Cache

- **When to use**: Highly sensitive data (account balance, real-time permissions), rapidly changing data, very small payloads where latency is acceptable.
- **Implication**: Every navigation or view triggers a network request. The user sees a loading state every time.
- **Mitigation**: Use loading skeletons, prefetch on hover or focus, keep payloads small.

### Cache Strategy Decision Flow

```
Is the data sensitive (financial, permissions, security-critical)?
  YES -> No Cache or very short TTL (< 30s)
  NO  -> Does the user expect instant display?
           YES -> SWR
           NO  -> Do you know exactly what invalidates it?
                    YES -> Event-Based Invalidation (+ long TTL safety net)
                    NO  -> Time-Based TTL (tune the duration)
```

---

## 3. Optimistic Update Patterns

### Simple Optimistic (Toggle/Flag)

```
User action -> Update UI immediately -> Send API request
  |-- Success -> Done (UI already correct)
  |-- Failure -> Revert UI to previous state -> Show error toast
```

- **Use for**: Likes, bookmarks, toggles, boolean status changes.
- **Confidence threshold**: Use when success rate is >99%.
- **Key requirement**: Capture state snapshot before mutation for reliable rollback.

### Optimistic with Pending Indicator

```
User action -> Update UI + show "saving" indicator -> Send API request
  |-- Success -> Remove indicator -> Show brief "saved" confirmation
  |-- Failure -> Revert UI -> Show error with retry option
```

- **Use for**: Text edits, reordering, drag-and-drop, moderate-confidence operations.
- **Confidence threshold**: Use when success rate is >95%.
- **UX detail**: The "saving" indicator should be subtle (small spinner or text) -- not a blocking overlay.

### Pessimistic (Wait for Server)

```
User action -> Disable control + show loading state -> Send API request
  |-- Success -> Update UI with server response
  |-- Failure -> Re-enable control -> Show error, UI unchanged
```

- **Use for**: Payments, deletions, permission changes, anything irreversible or high-stakes.
- **Use when**: Failure rate is significant, consequences are high, or server may transform the data.
- **UX detail**: Disable the trigger control to prevent double-submission. Show a loading indicator on the control itself.

### Choosing the Right Pattern

| Factor | Simple Optimistic | Optimistic + Indicator | Pessimistic |
|--------|:---:|:---:|:---:|
| High success rate (>99%) | X | | |
| Moderate success rate (>95%) | | X | |
| Uncertain success rate | | | X |
| Reversible operation | X | X | |
| Irreversible operation | | | X |
| Involves money | | | X |
| Frequent user action | X | X | |
| Infrequent user action | | | X |

### Conflict Resolution Strategies

#### Last Write Wins

- Server accepts the most recent write. Previous changes are silently overwritten.
- **Use for**: Low-stakes data, single-user scenarios, settings/preferences.
- **Risk**: User A's changes lost if User B saves after. Acceptable only when data is non-critical.

#### Field-Level Merge

- Server merges changes field-by-field. Each field's latest value wins independently.
- **Use for**: Profile updates with independent fields, forms where users rarely edit the same field simultaneously.
- **Implementation**: Send only changed fields in the PATCH request. Server merges per-field.

#### Manual Resolution

- Show the user both versions. Let them choose one, merge manually, or discard.
- **Use for**: Critical data, collaborative documents, conflicting edits on the same field.
- **UX**: Present a clear diff. Highlight conflicts. Provide "use mine" / "use theirs" / "merge" options.

#### Version Check (Optimistic Locking)

- Include a version number or ETag in the update request. Server rejects if the version does not match.
- **On rejection**: Fetch the latest version, show the user what changed, let them re-apply their edits.
- **Use for**: Most CRUD applications. Best default strategy.
- **Implementation**: Store `version` or `updatedAt` on every entity. Send it with every PUT/PATCH. Return 409 Conflict on mismatch.

---

## 4. Real-Time Data Patterns

### Polling

- **How**: Client sends requests at fixed intervals (e.g., every 30 seconds).
- **When to use**: Low-frequency updates, simple infrastructure, fewer than 100 concurrent users watching the same data.
- **Interval guidance**:
  - 5-10s: Live dashboards, active monitoring.
  - 30-60s: List views, notification counts.
  - 5min+: Settings, reference data.
- **Optimization**: Pause polling when the browser tab is hidden. Increase interval after N polls with no changes. Resume normal interval on tab focus.
- **Anti-pattern**: Polling every second for data that changes once per hour. Match interval to actual change frequency.

### Server-Sent Events (SSE)

- **How**: Server pushes events over a persistent HTTP connection. Client receives a stream of text events.
- **When to use**: One-way server-to-client updates. Notifications, activity feeds, live status, progress updates.
- **Advantages over WebSocket**: Simpler protocol, works through most HTTP proxies and load balancers, automatic reconnection built into the browser API, works with standard HTTP authentication.
- **Limitation**: Unidirectional (server to client only). Client cannot send messages through the SSE connection. Use regular HTTP requests for client-to-server communication.
- **Connection management**: Browser handles reconnection automatically. Send a `Last-Event-ID` header on reconnect to resume from where the client left off.

### WebSocket

- **How**: Full-duplex persistent connection. Both client and server can send messages at any time.
- **When to use**: Bidirectional real-time communication (chat, collaborative editing, multiplayer, live cursors).
- **Connection state machine**:
  ```
  disconnected -> connecting -> connected -> disconnecting -> disconnected
                                    |                              ^
                                    +--- connection lost ---------->|
                                    |                              |
                                    +--- reconnecting ------------+
  ```
- **Reconnection**: Use exponential backoff with jitter. Cap maximum delay (e.g., 30s). Replay missed messages after reconnect using a sequence ID or timestamp.
- **Heartbeat**: Send ping/pong at regular intervals (15-30s) to detect dead connections. If no pong received within timeout, trigger reconnection.

### Decision Matrix

| Criterion | Polling | SSE | WebSocket |
|-----------|:---:|:---:|:---:|
| Update frequency < 1/min | X | | |
| Update frequency 1-10/min | | X | |
| Update frequency > 10/min | | | X |
| Server to client only | X | X | |
| Bidirectional needed | | | X |
| Simple infrastructure | X | X | |
| Works through all proxies | X | X | |
| Lowest latency | | | X |
| Lowest server resource cost | X | | |
| Auto-reconnect built in | | X | |
| Binary data support | | | X |

### Combining Patterns

Real applications often combine patterns. Common combinations:
- **SWR + SSE**: Load data with SWR for instant display. Subscribe to SSE for live updates. Invalidate SWR cache when SSE event arrives.
- **Polling + Event-based invalidation**: Poll at a long interval as a safety net. Invalidate immediately on user actions.
- **WebSocket + Pessimistic updates**: Use WebSocket for receiving updates from other users. Use pessimistic HTTP requests for the current user's mutations.

---

## 5. Pagination Patterns

### Offset-Based (`page=2&limit=20`)

- **Pros**: Simple to implement, supports "jump to page N", produces stable/shareable URLs, easy to show total page count.
- **Cons**: Inconsistent results when data changes between page loads (inserts/deletes shift items), poor database performance on deep pages (OFFSET 10000 scans and discards 10000 rows).
- **Use for**: Admin panels, reports, content with stable ordering, datasets under 100K rows.
- **URL format**: `?page=2&limit=20&sort=name&order=asc`

### Cursor-Based (`after=xyz&limit=20`)

- **Pros**: Consistent results even when data changes, efficient at any depth (no offset scanning), works well with real-time data.
- **Cons**: No "jump to page N", harder to implement and debug, opaque cursor values in URLs.
- **Use for**: Feeds, timelines, real-time data, large datasets (>100K rows), infinite scroll.
- **Cursor encoding**: Encode the sort field value(s) + unique ID. Use base64 for URL safety. Always include a tiebreaker (unique ID) to handle duplicate sort values.

### Virtual Scroll

- **How**: Renders only the visible items plus a small buffer. Creates the illusion of a fully rendered list by manipulating scroll container height and item positioning.
- **Pros**: Handles 100K+ items with constant memory usage, smooth scrolling experience.
- **Cons**: Complex implementation, accessibility challenges (screen readers see only rendered items), browser search-in-page does not find off-screen items, variable-height items add significant complexity.
- **Use for**: Long homogeneous lists where the user browses sequentially. Data tables, log viewers, file explorers.

### Load More / Infinite Scroll

- **How**: User triggers loading the next batch either by clicking a "Load More" button or by scrolling near the bottom of the list. New items append to the existing list.
- **Pros**: Good for browsing and discovery, mobile-friendly, simple mental model.
- **Cons**: Hard to deep-link to a specific position, hard to return to a previous scroll position after navigation, no awareness of total count, back button behavior is tricky.
- **Use for**: Social feeds, image galleries, search results for exploration, comment threads.
- **UX detail**: Prefer a "Load More" button over automatic infinite scroll. It gives users control and avoids footer-inaccessibility problems.

### State Management per Pattern

| Pattern | URL State Needed | Scroll Position | Cache Behavior |
|---------|:---:|:---:|---|
| Offset | page, limit, sort, filters | Reset on page change | Cache per page independently |
| Cursor | cursor, limit | Preserve across appends | Append new pages to existing cache |
| Virtual | Minimal or none | Restore on navigate back | Cache the full dataset reference, render on demand |
| Infinite | Minimal or none | Restore on navigate back | Cache all loaded items, track last cursor for next fetch |

### Pagination + Filtering Interaction

When filters change:
1. Reset pagination to page 1 (offset) or clear cursor (cursor-based).
2. Clear cached pages -- they are no longer valid.
3. Update the URL to reflect new filters AND reset page state.
4. Show a loading state for the entire list, not just the next page.

---

## 6. Form Data Patterns

### Draft Persistence

- Auto-save form state to session storage at regular intervals (5-30s depending on form complexity and user expectations).
- On page return, detect existing draft and prompt: "You have unsaved changes from [timestamp]. Restore or discard?"
- Clear the draft on successful submission or explicit user discard.
- Include a schema version in the saved draft. If the form schema changes between saves, discard the incompatible draft gracefully rather than crashing.
- Key the draft by a stable identifier (entity ID for edits, route path for creation forms).

### Multi-Step Form State

- Store all steps in a single form state object. Each step owns a slice of that object.
- Validate the current step on "Next." Do not allow advancing with invalid data.
- Allow backward navigation WITHOUT re-triggering validation. The user is reviewing, not submitting.
- Persist progress at each step transition (not only on final submit). If the user abandons at step 3 of 5, they should resume at step 3.
- On navigation away, prompt "You have unsaved progress" and auto-save the draft.
- Show a step indicator with completed/current/upcoming status. Allow clicking completed steps to jump back.

### Field-Level vs. Form-Level Submission

**Field-level** (auto-save, inline edit):
- Each field submits independently when changed (on blur or after debounce).
- Use when fields are independent of each other and saving per-field is meaningful.
- Handle concurrent saves: queue or debounce, do not fire parallel requests for the same field.
- Show per-field status indicators: idle, saving, saved, error.
- Error recovery: retry failed field saves, show inline error on the field itself.

**Form-level** (traditional submit):
- All fields collected and submitted together as one payload.
- Use when fields have cross-field dependencies, transactional integrity is needed, or validation rules span multiple fields.
- On validation failure: scroll to the first error, focus it, preserve all user input.
- Disable the submit button during submission to prevent double-submit.

### Complex Field Patterns

**Dependent fields**: Field B's options depend on Field A's value.
- When A changes: clear B's value, show a loading state on B while fetching new options, disable B until options arrive.
- Cache options per parent value so switching back to a previous A value is instant.

**Repeatable sections**: Add/remove groups of related fields.
- Preserve group ordering. Each group needs a stable client-side key (not array index).
- Validate each group independently. Show errors per group.
- Enforce minimum and maximum group count. Disable "remove" at minimum, disable "add" at maximum.

**Conditional fields**: Show or hide fields based on other field values.
- Do not validate hidden fields. Exclude hidden field values from the submission payload.
- Decision: clear hidden field values when hiding, or preserve them in case the user toggles back? Preserving is usually better UX; clearing is safer for data integrity. Choose based on context.

**File uploads**:
- Upload immediately on file selection (background upload) or on form submit? Immediate upload provides better UX (progress feedback, early error detection) but requires cleanup of orphaned uploads.
- Show per-file progress bars. Handle upload failure independently of the form.
- Validate file type and size on the client before uploading. Validate again on the server.
- For large files, use chunked/resumable uploads.

---

## 7. Cross-Tab/Window State

### Shared State (All Tabs See Same Data)

- **Mechanism**: BroadcastChannel API (modern) or `storage` event on localStorage (broad support).
- **Examples**: Authentication state (logout in one tab logs out all tabs), theme preference, notification badge count, language selection.
- **Conflict handling**: Last write wins for simple scalar values. For complex objects, use a version counter and merge strategy.
- **Critical pattern -- auth sync**: When the auth token expires or the user logs out in any tab, ALL tabs must respond immediately. Redirect to login, clear sensitive data from memory.

### Isolated State (Each Tab Independent)

- **Examples**: Form drafts, wizard progress, modal open/closed state, scroll position, selected list item.
- **Mechanism**: sessionStorage provides automatic tab isolation. Each tab gets its own sessionStorage instance.
- **Identifier**: If using localStorage for isolated state, prefix keys with a tab-specific ID (generated on tab open and stored in sessionStorage).

### Hybrid State

Most applications use a combination:
- **Shared**: Auth, user preferences, notification count, feature flags.
- **Isolated**: Current form, navigation state, transient UI state.
- **Rule of thumb**: If acting on it in one tab should affect other tabs, share it. Otherwise, isolate it.

### Tab Awareness Patterns

**Resource locking**:
- When a user opens an entity for editing in one tab, other tabs of the same user should show "Editing in another tab" with a read-only view or a link to the editing tab.
- Implementation: Write a lock record to shared storage (localStorage or server) with tab ID and timestamp. Release on save, discard, or tab close. Use `beforeunload` to clean up, with a server-side TTL as a safety net for crashes.

**Cross-tab data freshness**:
- When data is modified in Tab A, Tab B (if viewing the same data) should show a non-intrusive notification: "This data was updated. Refresh to see changes."
- Do not auto-refresh Tab B. The user may be in the middle of reading or interacting. Let them choose when to refresh.

**Cross-tab selection sync** (optional, power-user feature):
- In admin tools, selecting an entity in one tab could highlight or navigate to it in another tab.
- Only implement when users have explicitly requested this workflow. It is surprising behavior by default.

### Cleanup

- Always handle the `beforeunload` event to clean up shared locks and temporary shared state.
- Use TTLs on any shared storage entries as a safety net. Tabs can crash without firing `beforeunload`.
- Periodically garbage-collect expired entries from shared storage to prevent unbounded growth.
