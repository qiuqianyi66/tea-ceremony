# Non-Happy State Design Reference

Every screen has at least five states: ideal, empty, loading, error, and partial.
Designing only the ideal state means designing 20% of the user experience.
This reference covers the other 80%.

---

## 1. Empty States

Empty states are the most common first impression. They set expectations,
teach functionality, and determine whether a user engages or bounces.

### First-Run Empty (No Data Ever Created)

| Aspect | Guidance |
|--------|----------|
| **Show** | Illustration or contextual icon + one-sentence explanation of what belongs here + clear CTA to create the first item |
| **Actions** | Primary creation action (prominent button), import option if applicable, sample/demo data option for complex features |
| **Tone** | Welcoming, encouraging, instructional. "Create your first project" not "No projects found." |
| **Layout** | Centered vertically and horizontally in the content area. Do not left-align empty states in a wide container. |

Common mistakes:
- Showing a blank table with column headers and zero rows.
- Using the word "empty" in the message. The user can see it is empty.
- Hiding the creation action behind a menu when the screen has nothing else to do.
- Using a generic illustration unrelated to the feature.

### Filtered-to-Nothing

| Aspect | Guidance |
|--------|----------|
| **Show** | "No results match your filters" + a summary of active filters as removable chips/tags |
| **Actions** | "Clear all filters" button, individual filter removal, save search for notifications if applicable |
| **Tone** | Helpful, not blaming. Never "You filtered too aggressively." |
| **Layout** | Inline within the content area where results would normally appear. Keep filter controls visible and editable. |

Common mistakes:
- Reusing the first-run empty state. These are different situations with different remedies.
- Not showing which filters are active, forcing the user to check each one.
- Hiding the filter controls, making it harder to adjust.

### Search-No-Results

| Aspect | Guidance |
|--------|----------|
| **Show** | "No results for **[query]**" with the query visibly quoted or bolded + search tips |
| **Actions** | Clear search field, suggested alternative terms (if search engine supports it), option to broaden scope (e.g., search all categories instead of current one) |
| **Tone** | Helpful. Acknowledge the attempt. |
| **Layout** | Below the search field. Never clear the search input automatically. |

Common mistakes:
- Not echoing back what the user searched for.
- Clearing the search field on zero results, destroying the user's input.
- Showing "No results" identically to the filtered-to-nothing state.

### Deleted-Everything

| Aspect | Guidance |
|--------|----------|
| **Show** | Empty state with creation CTA. If distinguishable from first-run, acknowledge the history: "All items have been removed." |
| **Actions** | Create new item, undo bulk delete if within the undo window, import data |
| **Tone** | Neutral. Not celebratory, not alarming. |
| **Layout** | Same as first-run empty but skip onboarding language. |

### Permission-Restricted

| Aspect | Guidance |
|--------|----------|
| **Show** | "You don't have access to [resource name]" + who can grant access (role name, admin contact) |
| **Actions** | Request access (if workflow exists), go back to previous page, contact admin link |
| **Tone** | Factual, not apologetic. "This requires Editor access" not "Sorry, you can't see this." |
| **Layout** | Centered in content area. Never show a brief flash of content before the permission check completes. |

Common mistakes:
- Showing a 403 error code to non-technical users.
- Not telling the user who can fix the problem.
- Redirecting silently to the home page without explanation.

### Archived/Completed

| Aspect | Guidance |
|--------|----------|
| **Show** | "All items completed" or "All items archived" + what that means contextually |
| **Actions** | View archive/completed list, create new item, celebrate if contextually appropriate (e.g., task completion) |
| **Tone** | Positive, accomplished. This is a success state disguised as empty. |
| **Layout** | Can include a subtle success illustration. More personality is acceptable here. |

---

## 2. Loading States

Loading states maintain user trust during waits. The wrong loading pattern
(full-screen spinner when data is already visible) destroys perceived performance.

### Initial Load (First Render)

| Aspect | Guidance |
|--------|----------|
| **Pattern** | Skeleton screens for known layouts; spinner only for completely unknown content structure |
| **Duration** | Skeleton appears immediately on render. No artificial delay or "flash" protection needed for skeletons. |
| **Content** | Skeleton shape must match the expected content structure (card grid, list, detail view). |
| **User can** | Nothing meaningful, or cancel/navigate away if the operation is long-running. |

### Refresh (Data Already Displayed)

| Aspect | Guidance |
|--------|----------|
| **Pattern** | Preserve existing content. Add a subtle refresh indicator: pull-to-refresh spinner, thin progress bar at top, or small inline indicator. Never replace visible content with a full-screen spinner. |
| **Duration** | If refresh completes in under 1 second, show no indicator at all to avoid a loading flash. |
| **Content** | Stale data remains fully visible and interactive during the refresh. |
| **User can** | Continue reading and interacting with the displayed (stale) data. |

### Pagination / Load More

| Aspect | Guidance |
|--------|----------|
| **Pattern** | Inline loading indicator at the insertion point (bottom of list, next page area). |
| **Duration** | Disable the load-more trigger during the request. Show placeholder rows matching expected content height. |
| **Content** | Existing data remains in place. New data appends below or replaces the current page. |
| **User can** | Scroll and interact with already-loaded content. Cannot trigger another load until current one completes. |

### Background Save

| Aspect | Guidance |
|--------|----------|
| **Pattern** | Brief "Saving..." indicator in a non-blocking location: status bar, inline near the save trigger, or as a subtle toast. Never block the UI. |
| **Duration** | Show "Saved" or a checkmark confirmation for 2-3 seconds after completion, then fade. |
| **Content** | User continues editing normally during the save. |
| **User can** | Everything. The save operation is completely non-blocking. |

### Lazy-Load Sections

| Aspect | Guidance |
|--------|----------|
| **Pattern** | Individual skeleton for each section that has not loaded yet. |
| **Duration** | Load above-the-fold sections first. Lazy-load sections below the fold as the user scrolls or after primary content renders. |
| **Content** | Each section loads independently. A failed section does not block siblings. |
| **User can** | Interact with any loaded section while others are still loading. |

### Long-Running Operations

| Aspect | Guidance |
|--------|----------|
| **Pattern** | Determinate progress bar with percentage if calculable. Indeterminate progress with status text if not. |
| **Duration** | Show estimated time remaining if possible. After exceeding the expected duration, show "Still working..." to reassure the user. |
| **Content** | Status text updates as the operation progresses through stages. |
| **User can** | Cancel with a confirmation prompt. Navigate away with a warning that the operation is still running in the background (if supported). |

---

## 3. Error States

Error handling is trust management. Every error is a moment where the user
decides whether to retry, work around, or leave. Make retrying the easiest option.

### Network Failure (Offline)

| Aspect | Guidance |
|--------|----------|
| **Message** | "You're offline. [Feature] needs an internet connection." Name the feature, not the technology. |
| **Recovery** | Auto-retry when connection is restored (listen for online event). Show a manual retry button as fallback. |
| **Fallback** | Display cached data if available, marked with an "Offline" badge or banner. Allow read-only interaction with cached content. |
| **Escalation** | None needed. The user knows they are offline. |

### API Error -- Client Errors (4xx)

**400 Bad Request**
- Message: "Something went wrong with your request." Show server-provided validation details if available.
- Recovery: Guide the user to correct the input. Never say "Bad Request" in user-facing copy.

**401 Unauthorized**
- Message: None initially. Attempt a silent token refresh, then retry the original request.
- Recovery: If the refresh fails, redirect to the login screen. Preserve the current URL to return after authentication.

**403 Forbidden**
- Message: "You don't have permission to [specific action]." Include who to contact.
- Recovery: Request access workflow, link to admin, or navigate back.

**404 Not Found**
- Message: "This [item type] no longer exists or has been moved."
- Recovery: Navigate to the parent resource, show similar items if available, or offer search.

**409 Conflict**
- Message: "Someone else has modified this [item type] since you started editing."
- Recovery: Show a diff if possible. Offer to merge changes, overwrite, or discard local changes.

**422 Unprocessable Entity**
- Message: Map each server-provided validation error to the corresponding form field.
- Recovery: Highlight fields with errors, scroll to the first one, focus it.

**429 Rate Limited**
- Message: "Too many requests. Trying again in [countdown]."
- Recovery: Auto-retry with exponential backoff. Show a countdown to the next attempt.

### API Error -- Server Errors (5xx)

| Aspect | Guidance |
|--------|----------|
| **Message** | "Something went wrong on our end. We've been notified." Never expose stack traces or error codes to the user. |
| **Recovery** | Retry button visible immediately. Auto-retry up to 3 times with exponential backoff (1s, 2s, 4s) before giving up. |
| **Fallback** | Show cached or stale data with an error banner: "Showing data from [time]. Some information may be outdated." |
| **Escalation** | Link to a status page or support channel. If repeated failures, surface a "Contact Support" action. |

### Validation Failure (Client-Side)

| Aspect | Guidance |
|--------|----------|
| **Inline display** | Error message directly below the field. Red border on the field. Icon optional but not sufficient alone (color alone fails accessibility). |
| **Timing** | On blur: recommended default for most fields. On submit: for interdependent field validation. Real-time: only for format checks like email, phone, or character limits. |
| **Scroll behavior** | Scroll to the first error field and focus it. If multiple errors, show all but focus the first. |
| **Clearing** | Error clears when the user modifies the field value, not when they click elsewhere or re-focus. |

### Timeout

| Aspect | Guidance |
|--------|----------|
| **Message** | "This is taking longer than expected." |
| **Recovery** | Two options: "Retry" and "Keep waiting." Do not auto-cancel. |
| **Fallback** | Show partial results if the operation supports streaming or chunked responses. |
| **Threshold** | Show the timeout message at 2x the expected response time for the endpoint. |

### Auth Expiry

| Aspect | Guidance |
|--------|----------|
| **During active use** | Modal overlay: "Your session has expired. Sign in to continue." Preserve form state, scroll position, and unsaved changes behind the modal. |
| **During background** | Attempt a silent token refresh. If it fails, show the auth prompt on the next user-initiated action, not proactively. |
| **After re-auth** | Return the user to the exact page, scroll position, and form state. Replay the failed request automatically. |

### Rate Limiting

| Aspect | Guidance |
|--------|----------|
| **User-facing** | "Slow down. Try again in [X seconds]." Show a visible countdown. Disable the trigger until the countdown expires. |
| **System-facing** | Invisible retry with exponential backoff. Only surface an error to the user after all retry attempts are exhausted. |

---

## 4. Partial States

Real applications rarely fail completely. Partial states are the most common
and the least designed-for.

### Some Data Loaded, Some Failed

- Display loaded data normally in its expected layout.
- Show an error banner or inline error section for the failed portions only.
- Allow full interaction with the loaded data.
- Provide a retry action scoped to the failed sections, not a full page reload.

### Degraded Functionality

- Show available features in their normal state.
- Apply a disabled visual treatment to unavailable features (reduced opacity, no pointer events).
- Tooltip on disabled features: "Currently unavailable. [Reason if known]."
- Never hide features that are temporarily unavailable. Users need to know they exist.

### Feature Unavailable

- Message: "[Feature name] is currently unavailable."
- Distinguish clearly between:
  - **Temporary** (maintenance): "Back shortly. Check our status page."
  - **Plan limitation**: "Available on [Plan Name]. Upgrade to access."
  - **Regional**: "Not available in your region."
- Provide the most relevant action: status page link, upgrade button, or alternative workflow.

---

## 5. Transition States

Transition states exist between user action and server confirmation.
They are where optimistic UI lives and where trust is most fragile.

### Optimistic Update Pending

- Show the updated state immediately, as if the server already confirmed.
- Add a subtle, non-blocking indicator that the save is in progress (e.g., brief status text).
- On failure: revert to the previous state, show an error notification, and offer a retry action.
- Only use optimistic updates for operations with a failure rate below 1%. High-risk operations (payments, deletions) must wait for confirmation.

### Background Sync In Progress

- Indicator: Small sync icon in the header or status bar area. Not a modal, not a banner.
- Content: User sees the latest local state. It may differ from the server state until sync completes.
- On conflict: Queue the resolution for the next natural interaction point. Do not interrupt the user mid-task.
- On completion: Silently merge changes. Only notify the user if their data was changed by another source.

### Upload/Download Progress

- Show a determinate progress bar with: percentage, file name, and file size.
- Allow cancellation with a confirmation prompt for large files.
- On failure: offer retry without requiring the user to re-select the file. Keep the file reference.
- Multiple files: show individual file progress and an overall progress summary.

---

## 6. Skeleton Screen Decision Tree

```
Is the content structure known in advance?
|
+-- YES --> Use skeleton screens that match the content layout
|   |
|   +-- Text content?   --> Gray bars matching expected line count and width
|   +-- Card grid?      --> Gray card placeholders in the grid layout
|   +-- Table?          --> Gray rows matching expected column widths
|   +-- Media?          --> Gray box matching the expected aspect ratio
|
+-- NO --> Is the wait expected to be under 2 seconds?
|   |
|   +-- YES --> Show nothing, then render content (avoid loading flash)
|   +-- NO  --> Centered spinner with optional status text
|
+-- Is this a REFRESH of existing content?
    |
    +-- YES --> Keep existing content visible + subtle loading indicator
    +-- NO  --> Follow the YES/NO branches above
```

### Minimum Display Time Rule

If content loads in under 300ms, do NOT show any loading indicator --
skeleton or spinner. A flash of a loading state is worse than a brief pause.
For skeletons specifically, only render them if they will be visible for more
than 300ms. Use a short delay before showing the skeleton to avoid the flash.

### Animation Guidelines (Functional Purpose Only)

| Element | Guidance |
|---------|----------|
| **Skeleton shimmer** | Direction: left-to-right, matching the reading direction. Speed: 1.5-2s per cycle. |
| **Spinner** | Use only for unknown-duration waits where the content structure is unknown. Never use a spinner when you know the layout. |
| **Progress bar** | Use only when the completion percentage is genuinely calculable. Fake progress bars erode trust. |
| **Status text with spinner** | Add descriptive status text for any operation exceeding 5 seconds. Update the text as stages complete. |

---

## Quick Reference: Choosing the Right Non-Happy State

```
User sees nothing where content should be?
  --> Was there ever content?
      NO  --> First-Run Empty
      YES --> Are filters/search active?
             YES --> Filtered-to-Nothing or Search-No-Results
             NO  --> Deleted-Everything, Permission-Restricted, or Archived

User is waiting for content?
  --> Is content already on screen?
      YES --> Refresh pattern (keep content, subtle indicator)
      NO  --> Is the layout known?
             YES --> Skeleton screen
             NO  --> Spinner (if > 2s expected) or nothing (if < 2s)

Something went wrong?
  --> Is the user offline?
      YES --> Network Failure with cached fallback
      NO  --> Is it a user input problem?
             YES --> Validation Failure (inline, field-level)
             NO  --> Is the server responding?
                    YES --> Map to specific HTTP status handling
                    NO  --> Timeout pattern

Only part of the page works?
  --> Partial State: show what works, error-state what doesn't, retry the broken parts
```
