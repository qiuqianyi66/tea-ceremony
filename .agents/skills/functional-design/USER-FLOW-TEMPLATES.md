# User Flow Templates

Reusable frameworks for mapping user journeys through an application. Each template
is framework-agnostic and designed for rapid documentation during sprint planning,
design reviews, and handoff to engineering.

---

## 1. Happy Path Template

The happy path captures the ideal journey where everything works as expected. Start
here before mapping errors or edge cases.

```
### Flow: [Task Name]
**Actor**: [User role]
**Goal**: [What they want to accomplish]
**Preconditions**: [What must be true before starting]

**Steps**:
1. [Entry point] — User arrives from [context]
2. [Action] — User [does something]
   - System responds: [what happens]
   - User sees: [what's displayed]
3. [Decision point] — If [condition A] -> Step 4a, If [condition B] -> Step 4b
4a. [Branch A action]
4b. [Branch B action]
5. [Success state] — User sees [confirmation]

**Postconditions**: [What's true after completion]
**Time to complete**: [Expected duration]
```

### Worked Example: Create and Publish a Report

```
### Flow: Create and Publish a Report
**Actor**: Editor
**Goal**: Draft a report with charts and narrative, then publish it to stakeholders
**Preconditions**: User is authenticated, has "editor" role, at least one data source is connected

**Steps**:
1. Entry — User clicks "New Report" from the dashboard
   - System responds: Opens a blank report canvas with a title field focused
   - User sees: Empty report with sidebar showing available chart types and data sources

2. Title — User types a report title
   - System responds: Auto-saves title, updates browser tab text
   - User sees: Title rendered in header, "Draft" badge appears

3. Add section — User clicks "Add Section" and selects "Chart"
   - System responds: Inserts chart placeholder, opens data source picker
   - User sees: Modal listing connected data sources with preview thumbnails

4. Configure chart — User selects a data source, picks chart type, maps fields
   - System responds: Renders live preview of chart with real data
   - User sees: Chart in the report canvas, configuration panel on the right

5. Add narrative — User clicks below the chart and types explanatory text
   - System responds: Auto-saves content every 5 seconds
   - User sees: Rich text editor with formatting toolbar

6. Review — User clicks "Preview"
   - System responds: Renders report in read-only stakeholder view
   - User sees: Full report as stakeholders will see it, with "Back to Edit" and "Publish" buttons

7. Publish — User clicks "Publish"
   - System responds: Shows confirmation dialog listing recipient groups
   - User sees: "Publish to: [group list]" with Confirm / Cancel

8. Confirm — User clicks "Confirm"
   - System responds: Sends notifications, changes status from Draft to Published
   - User sees: Success banner "Report published. 12 stakeholders notified."
     Report status badge changes to "Published" with timestamp.

**Postconditions**: Report is visible to stakeholders, listed in published reports,
  notifications sent, audit log updated
**Time to complete**: 5-15 minutes depending on complexity
```

---

## 2. Error Path Template

Error paths branch from specific happy path steps. Document each one separately
so engineering knows exactly what to build.

```
### Error Path: [Task Name] — [Error Scenario]
**Branching from**: Happy path step [N]
**Trigger**: [What goes wrong]

**Error handling**:
1. [What the system shows]
2. [What actions are available]
3. [Recovery path — how to get back to happy path]
4. [Fallback — if recovery isn't possible]

**Data preservation**: [What user input is preserved through the error]
**State after recovery**: [Where the user ends up]
```

### Common Error Paths

#### API Failure During Form Submission

```
### Error Path: Create Report — API Failure on Publish
**Branching from**: Happy path step 8 (Confirm publish)
**Trigger**: Server returns 500 or network request fails

**Error handling**:
1. System removes the loading spinner and shows inline error banner:
   "We couldn't publish your report. Your work is saved as a draft."
2. Available actions: "Try Again" button, "Save as Draft" button
3. Recovery: User clicks "Try Again" — system retries the publish request
   (max 2 automatic retries with exponential backoff before showing manual retry)
4. Fallback: If retry fails, report remains in Draft status. User can return
   to dashboard and try publishing later.

**Data preservation**: All report content preserved. Draft auto-saved before publish attempt.
**State after recovery**: If retry succeeds, user lands on published confirmation (step 8 success).
  If retry fails, user is on the report edit screen with Draft status.
```

#### Validation Failure

```
### Error Path: Create Report — Validation Failure on Chart Configuration
**Branching from**: Happy path step 4 (Configure chart)
**Trigger**: User maps incompatible field types (e.g., text field to numeric axis)

**Error handling**:
1. System highlights the invalid field mapping in red, shows tooltip:
   "Revenue expects a numeric field. 'Customer Name' is text."
2. Available actions: Change the field mapping, change chart type, remove the chart
3. Recovery: User selects a compatible field — validation clears, preview renders
4. Fallback: User cancels chart configuration, section reverts to placeholder

**Data preservation**: All other field mappings in the chart are preserved.
  Only the invalid mapping is flagged.
**State after recovery**: User continues from step 4 with corrected mapping.
```

#### Timeout

```
### Error Path: Create Report — Timeout Loading Data Source
**Branching from**: Happy path step 3 (Add section — data source picker)
**Trigger**: Data source query exceeds 30-second timeout

**Error handling**:
1. System replaces loading spinner with: "This data source is taking longer
   than expected." Shows elapsed time.
2. Available actions: "Keep Waiting" (extends timeout by 30s), "Try Another
   Data Source", "Cancel"
3. Recovery: If data eventually loads, picker populates normally.
   If user picks another source, flow continues from step 3.
4. Fallback: User cancels and adds a different section type (narrative text)
   or saves draft and returns when the data source is responsive.

**Data preservation**: Report title and any existing sections are unaffected.
**State after recovery**: User is back at step 3 with the section picker open.
```

#### Permission Denied Mid-Flow

```
### Error Path: Create Report — Permission Denied on Publish
**Branching from**: Happy path step 7 (Publish button click)
**Trigger**: User's role was downgraded to "viewer" by an admin while editing

**Error handling**:
1. System shows modal: "You no longer have permission to publish reports.
   Your draft has been saved."
2. Available actions: "OK" (returns to dashboard), "Contact Admin" (opens
   support channel or shows admin email)
3. Recovery: If admin restores permissions, user returns to draft and
   publishes from step 6.
4. Fallback: Draft remains saved. Another user with publish rights can
   open and publish it.

**Data preservation**: Full report content preserved as draft under original author.
**State after recovery**: User is on the dashboard with the draft listed.
```

#### Data Conflict (Concurrent Edit)

```
### Error Path: Create Report — Concurrent Edit Conflict
**Branching from**: Happy path step 5 (Add narrative — auto-save triggers)
**Trigger**: Another editor modified the same report section since the current
  user loaded it

**Error handling**:
1. System shows conflict banner: "Alex Chen edited this section 2 minutes ago.
   Your version and theirs differ."
2. Available actions: "Keep Mine" (overwrites), "Keep Theirs" (discards local),
   "View Diff" (shows side-by-side comparison)
3. Recovery: User picks a version or manually merges content, then continues editing.
4. Fallback: If user is unsure, "Save as Copy" creates a duplicate report
   with their changes intact.

**Data preservation**: Both versions are available until user resolves the conflict.
  No data is lost automatically.
**State after recovery**: User continues from step 5 with the resolved content.
```

#### Session Expiry During Multi-Step Process

```
### Error Path: Create Report — Session Expires Mid-Edit
**Branching from**: Any step (detected on next server interaction)
**Trigger**: Authentication token expires after inactivity or time limit

**Error handling**:
1. System shows overlay modal: "Your session has expired. Sign in to continue."
   The report content behind the modal remains visible but non-interactive.
2. Available actions: "Sign In" (opens auth in same window or popup),
   "Cancel" (navigates to login page)
3. Recovery: After re-authentication, system restores the user to their exact
   position. Any unsaved changes are submitted from the local state.
4. Fallback: If re-auth fails or user closes the tab, local storage retains
   a recovery draft for 24 hours. On next login, system prompts:
   "You have unsaved changes to [Report Title]. Resume editing?"

**Data preservation**: Client-side state held in memory during re-auth.
  Local storage backup updated every 30 seconds as secondary protection.
**State after recovery**: User returns to the exact step and scroll position
  where the session expired.
```

---

## 3. Edge Case Catalog

Review this checklist when designing any user flow. Not every case applies to every
flow, but each should be consciously considered and either handled or documented as
out of scope.

### User State Edge Cases

- [ ] **First-time user** — No prior context. Needs onboarding hints, empty state
  guidance, or a setup wizard. Does the flow assume prior knowledge?
- [ ] **Returning user with stale data** — Data changed since their last visit.
  Does the UI reflect current state on load, or could they act on outdated info?
- [ ] **No permissions for current action** — User navigated to a page they cannot
  use. Show disabled controls with explanation, or redirect with message?
- [ ] **Expired session** — Token expired between page load and form submit.
  Handle gracefully without losing user work.
- [ ] **Different device than where they started** — User began on desktop, continues
  on mobile. Does the flow adapt? Is progress synced?
- [ ] **Guest/anonymous user attempting authenticated action** — Prompt to sign in
  without losing their progress. Deep-link back after authentication.
- [ ] **Multiple accounts** — User signed into the wrong account. Allow switching
  without navigating away from the flow.
- [ ] **Degraded permissions** — User had access when they started but lost it
  mid-flow (role change, license expiry).

### Data State Edge Cases

- [ ] **Zero items (empty state)** — No data to display. Show helpful guidance,
  not a blank screen. Provide a clear call to action.
- [ ] **One item (singular vs. plural)** — UI copy and layout handle the singular
  case ("1 report" not "1 reports"). List layout doesn't look broken with one row.
- [ ] **Maximum items** — Pagination, virtualized scrolling, or load-more pattern.
  Performance tested with realistic data volumes.
- [ ] **Item deleted by another user** — User is viewing or editing something that
  no longer exists. Detect and communicate clearly.
- [ ] **Item modified by another user** — Concurrent edit. Show conflict resolution
  or last-write-wins with notification.
- [ ] **Legacy or migrated data** — Older records missing fields that newer code
  expects. Null-safe rendering and graceful degradation.
- [ ] **Unicode and special characters** — Emojis, RTL text, diacritics, zero-width
  characters in user input. Renders correctly, doesn't break layout.
- [ ] **Very long text** — Field designed for 50 characters receives 5000. Truncate
  with tooltip, scroll, or enforce a limit with clear feedback.
- [ ] **Very large file uploads** — User uploads a file at or beyond the size limit.
  Show progress, allow cancellation, validate before uploading.
- [ ] **Numeric extremes** — Zero, negative numbers, very large numbers, decimals
  where integers are expected.

### Navigation Edge Cases

- [ ] **Browser back button** — During multi-step flows, does back go to the previous
  step or leave the flow entirely? Warn about unsaved changes.
- [ ] **Browser forward button** — After completing a flow, forward shouldn't replay
  the final action (double-submit).
- [ ] **Deep link to mid-flow step** — User bookmarked step 3 of 5. Redirect to
  step 1, or load step 3 if prerequisites are met?
- [ ] **Multiple tabs with same flow** — Two tabs open to the same edit form.
  Submissions from tab A should not be silently overwritten by tab B.
- [ ] **Page refresh with unsaved changes** — Browser beforeunload warning. On
  reload, restore from local storage or start fresh?
- [ ] **URL manipulation** — User changes an ID in the URL. Return 404 or
  "not found" UI, never expose someone else's data.
- [ ] **Bookmark to context-dependent page** — Page requires setup state that
  isn't present when accessed directly. Redirect with explanation.
- [ ] **Redirect after login** — If the flow required authentication, return the
  user to where they were, not the default landing page.

### Network and System Edge Cases

- [ ] **Offline during submission** — Detect network absence before sending. Queue
  the action or inform the user.
- [ ] **Connection drops and reconnects** — Ongoing operations (polling, WebSocket)
  resume without requiring a full page reload.
- [ ] **Slow network** — 3G-like latency. Loading indicators appear quickly (within
  200ms). No layout shift when content loads.
- [ ] **Cached/stale server response** — Client receives outdated data from a CDN
  or cache layer. Stale-while-revalidate strategy or cache-busting.
- [ ] **Partial API response** — Some fields are null or missing. UI degrades
  gracefully, showing what's available.
- [ ] **File upload interrupted** — Large upload fails partway. Support resumable
  uploads or clear error with retry.
- [ ] **Third-party service outage** — Payment processor, auth provider, or external
  API is down. Communicate clearly, offer alternatives if possible.

### Timing Edge Cases

- [ ] **Double-click on submit** — Disable button after first click or debounce.
  Backend idempotency as a safety net.
- [ ] **Navigation before async completes** — User clicks away before a save
  finishes. Complete the save in the background or warn and wait.
- [ ] **Idle timeout during active work** — User is reading or thinking, not
  interacting. Reset the timer on scroll and keystrokes, not just clicks.
- [ ] **Simultaneous actions across tabs** — Same user deletes an item in tab A
  while editing it in tab B. Tab B must handle the conflict.
- [ ] **Race condition with background update** — A polling refresh overwrites
  the user's in-progress edits. Pause polling while editing.
- [ ] **Rapid repeated actions** — User clicks "add item" 10 times quickly.
  Each click produces exactly one item, not duplicates or errors.
- [ ] **Clock skew** — User's device clock is wrong. Token expiry checks and
  time-based features use server time as source of truth.

---

## 4. Flow Notation

A lightweight text-based notation for describing flows in markdown without
diagram tools. Useful in tickets, PRs, and design documents.

### Linear Flow

```
[Start] --> Step 1 --> Step 2 --> Step 3 --> [End]
```

### Branching Flow

```
[Start] --> Step 1 --> {Decision?}
  |-- YES --> Step 2a --> Step 3 --> [End]
  '-- NO  --> Step 2b --> [End]
```

### Parallel Flow (concurrent async operations)

```
[Start] --> Step 1 --+--> Step 2a (async) --+--> Step 3 --> [End]
                     '--> Step 2b (async) --'
```

### Loop Flow (retry / validation cycle)

```
[Start] --> Step 1 --> Step 2 --> {Valid?}
  |-- YES --> Step 3 --> [End]
  '-- NO  --> [Back to Step 1]
```

### Error Branch

```
[Start] --> Step 1 --> Step 2 ==ERROR==> [Error Handler] --> {Retry?}
                                           |-- YES --> [Back to Step 2]
                                           '-- NO  --> [Exit with error state]
```

### Sub-Flow Reference

```
[Start] --> Step 1 --> [[Authentication Sub-Flow]] --> Step 2 --> [End]
```

Reference sub-flows with double brackets to indicate a documented flow elsewhere.
Include the sub-flow name exactly as it appears in its own document.

### Conventions

**Naming**:
- Use verbs for user actions: "Enter credentials", "Select plan", "Confirm payment"
- Use nouns or states for system states: [Authenticated], [Dashboard], [Error]
- Use questions for decisions: {Has account?}, {Payment valid?}, {Admin?}

**Symbols**:
- `[Square brackets]` — States and endpoints (start, end, named pages)
- `{Curly braces}` — Decision points requiring a condition
- `[[Double brackets]]` — Sub-flow references
- `-->` — Normal progression
- `==ERROR==>` — Error transition
- `|--` and `'--` — Branch paths (first and last branches)

**Annotations** — Add inline notes in parentheses for context:

```
Step 1 (requires: auth token) --> Step 2 (async, ~2s) --> Step 3 (writes to DB)
```

**Timing** — Prefix with approximate duration when relevant:

```
[Start] --> [~1s] Load dashboard --> [~0s] Click "New" --> [~3s] Fetch template --> [Edit]
```

**Data flow** — Note what data moves between steps:

```
Step 1 [collects: email, name] --> Step 2 [uses: email for lookup] --> Step 3
```

---

## 5. Branching Logic Template

For flows where the path differs based on user role, feature flags, data state,
or other conditions.

```
### Branching Flow: [Feature Name]

**Branch Conditions**:
| Condition | Value | Path |
|-----------|-------|------|
| User role | admin | Full CRUD + settings |
| User role | editor | Read + edit own items |
| User role | viewer | Read only |
| Feature flag: beta | true | Show new UI |
| Data state: first-time | true | Onboarding flow |

**Path Details**:

#### Admin Path
[Step-by-step flow for admin]

#### Editor Path
[Step-by-step flow for editor]

#### First-Time Overlay
[Additional steps overlaid on any role path]
```

### Worked Example: Report Sharing

```
### Branching Flow: Share Report

**Branch Conditions**:
| Condition | Value | Path |
|-----------|-------|------|
| User role | owner | Full sharing controls |
| User role | editor | Share read-only link only |
| User role | viewer | No sharing — "Request access" prompt |
| Report status | draft | Share as preview (watermarked) |
| Report status | published | Share as final |
| Org setting: external sharing | disabled | Internal recipients only |

**Path Details**:

#### Owner Path
1. Click "Share" button on report header
2. System opens sharing modal with three tabs: People, Link, Embed
3. People tab: Search users/groups, assign role (viewer/editor), add message
4. Link tab: Generate shareable link, set expiration, toggle password protection
5. Embed tab: Generate iframe snippet with size controls
6. Click "Send" — System sends invitations, copies link, or displays embed code
7. Success: "Shared with 3 people. Link copied to clipboard."

#### Editor Path
1. Click "Share" button on report header
2. System opens sharing modal with Link tab only
3. Link tab: Read-only link pre-generated, "Copy Link" button
4. Click "Copy Link" — Link copied to clipboard
5. Success: "Read-only link copied."
   Note: "Need to share with edit access? Contact the report owner."

#### Viewer Path
1. "Share" button is replaced with "Request Share Access"
2. Click opens a brief form: message to owner, requested permission level
3. System sends request notification to the report owner
4. Success: "Access request sent to [Owner Name]."

#### Draft Status Overlay (applies to owner and editor paths)
- Insert after step 2: System shows warning banner:
  "This report is a draft. Recipients will see a watermarked preview."
- Sharing modal includes toggle: "Notify recipients when published"

#### External Sharing Disabled Overlay
- In the People search (owner path step 3): External email addresses are
  blocked with inline message: "External sharing is disabled by your
  organization. Contact your admin to change this setting."
- In the Link tab: "Anyone with link" option is hidden. Only "People
  in [Org Name]" is available.
```

---

## 6. Multi-Step Flow Template

For wizards, onboarding sequences, checkout flows, and other processes that span
multiple distinct screens or stages.

```
### Multi-Step Flow: [Name]

**Total Steps**: [N]
**Estimated Duration**: [time]
**Can Save Progress?**: Yes / No
**Can Skip Steps?**: [Which ones]

#### Step Overview
| # | Name | Required? | Skip Condition | Depends On |
|---|------|-----------|----------------|------------|
| 1 | [Name] | Yes | -- | -- |
| 2 | [Name] | No | [When to skip] | Step 1 |
| 3 | [Name] | Yes | -- | Steps 1, 2 |

#### Per-Step Template
**Step [N]: [Name]**
- **Purpose**: [What this step accomplishes]
- **Input**: [What data the user provides]
- **Validation**: [Rules, when validated (on blur / on next)]
- **Pre-populated from**: [Prior steps or saved data]
- **Save point**: [What is saved if user abandons here]
- **Back behavior**: [What happens going back — preserve input? reset?]
- **Skip logic**: [When this step is skipped and what defaults apply]

#### Flow Controls
- **Progress indicator**: [Step count, percentage, named stages]
- **Back button**: [Always available? Preserves data?]
- **Save & exit**: [Available? Where does user resume?]
- **Cancel**: [Confirmation required? Data preserved?]
- **Abandon detection**: [What happens if user leaves mid-flow via navigation]
```

### Worked Example: Team Onboarding Wizard

```
### Multi-Step Flow: Team Onboarding Wizard

**Total Steps**: 5
**Estimated Duration**: 4-8 minutes
**Can Save Progress?**: Yes — progress saved after each step completion
**Can Skip Steps?**: Steps 3 (Invite Members) and 4 (Integrations) are skippable

#### Step Overview
| # | Name | Required? | Skip Condition | Depends On |
|---|------|-----------|----------------|------------|
| 1 | Create Workspace | Yes | -- | -- |
| 2 | Choose Plan | Yes | -- | Step 1 |
| 3 | Invite Members | No | Solo user or "Do this later" | Step 1 |
| 4 | Connect Integrations | No | No integrations wanted | Step 1 |
| 5 | Confirmation | Yes | -- | Steps 1, 2 |

#### Step 1: Create Workspace
- **Purpose**: Establish the team's workspace identity
- **Input**: Workspace name, workspace URL slug (auto-generated, editable),
  team size range (dropdown: 1-5, 6-20, 21-100, 100+)
- **Validation**:
  - Name: required, 2-64 characters, validated on blur
  - URL slug: required, lowercase alphanumeric + hyphens, uniqueness checked
    on blur with debounce (300ms), shows availability inline
- **Pre-populated from**: User's organization name if available from SSO
- **Save point**: Nothing saved yet — workspace created on "Next"
- **Back behavior**: N/A (first step). "Cancel" returns to the landing page.
- **Skip logic**: Not skippable

#### Step 2: Choose Plan
- **Purpose**: Select billing plan to determine feature access
- **Input**: Plan selection (Free, Pro, Enterprise), billing cycle toggle
  (monthly / annual)
- **Validation**: Selection required. Enterprise triggers "Contact Sales"
  flow instead of proceeding.
- **Pre-populated from**: Team size from Step 1 highlights a recommended plan
- **Save point**: Workspace exists but has no plan. Shows as "Setup incomplete"
  in admin panel.
- **Back behavior**: Returns to Step 1 with all fields preserved
- **Skip logic**: Not skippable. Free plan is the zero-commitment option.

#### Step 3: Invite Members
- **Purpose**: Bootstrap the team so the workspace isn't empty
- **Input**: Email addresses (comma-separated or one per line), role assignment
  per invitee (admin / member)
- **Validation**: Email format validated on blur. Duplicate and self-invite
  detected with inline warning. Max 50 invites at once.
- **Pre-populated from**: None (could suggest contacts from SSO directory
  if available)
- **Save point**: Workspace and plan exist. Invites not sent yet.
- **Back behavior**: Returns to Step 2. Entered emails are preserved.
- **Skip logic**: "Skip — I'll invite people later" link at bottom of step.
  Defaults: no invitations sent. Reminder shown in dashboard after onboarding.

#### Step 4: Connect Integrations
- **Purpose**: Reduce time-to-value by connecting tools users already have
- **Input**: Select from available integrations (tiles with logos). Each
  selection opens an OAuth flow in a popup.
- **Validation**: OAuth must complete successfully. If it fails, tile shows
  error state with "Try Again".
- **Pre-populated from**: Team size and plan may influence which integrations
  are shown first (enterprise plans see SSO/SCIM prominently).
- **Save point**: Workspace, plan, and any completed integrations are saved.
  Pending OAuth flows are abandoned.
- **Back behavior**: Returns to Step 3. Connected integrations remain connected.
- **Skip logic**: "Skip — I'll set up integrations later" link. Defaults:
  no integrations connected. Prompt shown in settings after onboarding.

#### Step 5: Confirmation
- **Purpose**: Summarize what was set up and direct the user to their first task
- **Input**: None (read-only summary)
- **Validation**: None
- **Pre-populated from**: All prior steps
- **Save point**: Onboarding marked complete. "Getting Started" checklist
  initialized in dashboard.
- **Back behavior**: Can go back to any step to make changes. Summary updates
  in real time.
- **Skip logic**: Not skippable

**Summary displays**:
- Workspace name and URL
- Selected plan with cost
- Number of invitations sent (with "Invite more" link)
- Connected integrations (with "Add more" link)
- Primary CTA: "Go to Dashboard"
- Secondary CTA: "Take a quick tour" (launches product tour overlay)

#### Flow Controls
- **Progress indicator**: Named stages across the top ("Workspace > Plan >
  Team > Integrations > Done"). Current step highlighted. Completed steps
  show checkmarks. Skipped steps show dash.
- **Back button**: Always available from Step 2 onward. Preserves all input.
- **Save & exit**: Available from Step 2 onward (workspace must exist).
  Saves current state. On next login, user sees "Continue setup" banner
  linking to the next incomplete step.
- **Cancel**: Available on Step 1 only (before workspace creation). No
  confirmation needed since nothing is saved. From Step 2 onward, "Save &
  exit" replaces cancel.
- **Abandon detection**: If user navigates away via browser (closing tab,
  typing new URL, clicking a non-wizard link), beforeunload warning fires
  on Steps 1-4. Step 5 has no warning since everything is already saved.
  Abandoned wizards with a created workspace are resumable for 30 days,
  then the incomplete workspace is flagged for cleanup.
```
