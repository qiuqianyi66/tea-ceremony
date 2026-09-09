# Interaction Patterns: Decision Trees

Decision trees for choosing between common UI interaction patterns. Each pattern includes when to use it, when to avoid it, state and data requirements, and the most common pitfall.

---

## 1. Content Display Patterns

### Modal vs. Drawer vs. Inline Expand vs. New Page

**Modal Dialog**
- **When to use**: User MUST respond before continuing. Confirming a destructive action. Short forms (login, quick create) that block the main flow intentionally.
- **When NOT to use**: Informational content the user may want to reference alongside other content. Forms longer than the viewport. Content that leads to sub-navigation.
- **State requirements**: Open/closed boolean, scroll lock on body, focus trap, previous focus element for restoration, ESC key handler.
- **Data requirements**: All data must be available before opening OR show a skeleton/spinner inside the modal. Avoid fetching chains after open.
- **Common pitfall**: Using modals for content that should be a page. If the user would ever want to bookmark or share the URL, it is not a modal.

**Drawer (Side Sheet)**
- **When to use**: Detail view alongside a list. Secondary editing that benefits from seeing the parent context. Filters or settings panels. Content that is supplementary, not blocking.
- **When NOT to use**: Critical confirmations where the user must focus. Content wider than 480px on desktop. Primary creation flows.
- **State requirements**: Open/closed boolean, width (fixed or resizable), scroll position independent of main content, optional overlay/backdrop.
- **Data requirements**: Can lazy-load after open since the parent context remains visible and interactive.
- **Common pitfall**: Making drawers too wide, which obscures the context they are meant to supplement. Keep drawers under 40% of viewport width.

**Inline Expand (Accordion / Row Expand)**
- **When to use**: Additional detail for a specific item in a list. Content that is tightly coupled to its trigger. Quick preview without losing scroll position.
- **When NOT to use**: Content that requires full focus. More than 300px of expanded height. Content that includes complex interactions or sub-navigation.
- **State requirements**: Expanded/collapsed per item (single or multi-expand policy), animation height, scroll-into-view after expand.
- **Data requirements**: Lightweight data that loads fast. If the expanded content requires a heavy fetch, use a drawer or page instead.
- **Common pitfall**: Allowing multiple expansions that push content far off-screen, disorienting the user. Decide on single-expand vs. multi-expand policy upfront.

**New Page**
- **When to use**: Content that deserves full focus. Deep editing or creation flows. Content that should be bookmarkable or shareable. When the user's mental model is "I am going somewhere."
- **When NOT to use**: Quick glances at supplementary info. Frequent back-and-forth between list and detail (use master-detail instead).
- **State requirements**: Route/URL, browser history entry, page-level loading state, breadcrumb or back navigation.
- **Data requirements**: Full data fetch on navigation. Consider route-level data resolvers or loading skeletons.
- **Common pitfall**: Using a new page for a task the user performs repeatedly, forcing constant navigation. If the user does this action more than 5 times per session, keep it in context.

### Preview vs. Full View

**Hover Preview**
- **When to use**: Desktop only. Quick identification (image thumbnails, link previews, user profile cards). Content that takes under 200ms to display.
- **When NOT to use**: Mobile (no hover). Content requiring interaction. Critical information.
- **Common pitfall**: Triggering on every mouse movement. Add a 300ms delay before showing and a 150ms delay before hiding.

**Click-to-Expand**
- **When to use**: Works on all devices. Moderate detail needed. User needs to scan a list and occasionally drill in.
- **When NOT to use**: When the expanded content is the primary purpose (use a full view).
- **Common pitfall**: Not providing a clear visual affordance that the item is expandable.

**Dedicated Detail Page**
- **When to use**: Rich content with multiple sections. Content that users will spend more than 30 seconds reading. Content that should be linkable.
- **When NOT to use**: Simple data that fits in a tooltip or card expansion.
- **Common pitfall**: Not providing a fast way back to the list with scroll position preserved.

### Tooltip vs. Popover vs. Help Text

**Tooltip**
- **When to use**: Label for an icon-only button. Brief definition (under 15 words). Truncated text full value. Desktop pointer interfaces.
- **When NOT to use**: Content longer than one sentence. Interactive content (links, buttons). Mobile-primary interfaces.
- **State requirements**: Show/hide with delay, positioning logic (flip when near edges), single tooltip visible at a time.

**Popover**
- **When to use**: Interactive content triggered by a click. Small forms (color picker, emoji selector). Rich content up to 3-4 sentences with links.
- **When NOT to use**: Content that should persist (use inline). Blocking confirmations (use modal).
- **State requirements**: Open/closed, click-outside-to-close, positioning, focus management within popover.

**Help Text (Static)**
- **When to use**: Always-visible guidance below form fields. Information every user needs on first encounter. Compliance or legal requirements.
- **When NOT to use**: Information only power users need (use tooltip). Long explanations (use a link to docs).
- **Common pitfall**: Adding help text to every field, creating visual noise that nobody reads.

---

## 2. Editing Patterns

### Inline Edit vs. Form Page vs. Wizard vs. Sheet

**Single-Field Inline Edit**
- **When to use**: One field at a time. Low validation complexity. Frequent, quick edits (renaming, status changes). The field's current value is its own display.
- **When NOT to use**: Fields with cross-field validation. Fields requiring context or help text. New record creation.
- **State requirements**: View/edit mode toggle per field, previous value for cancel, optimistic update or loading indicator, ESC to cancel, Enter to save.
- **Data requirements**: Current field value, validation rules, API endpoint for single-field update.
- **Common pitfall**: Not handling the case where the API call fails after the UI has already shown the updated value. Always keep the previous value until confirmation.

**Multi-Field Inline Edit (Edit Mode Toggle)**
- **When to use**: 2-5 related fields edited together. Settings panels. Profile sections.
- **When NOT to use**: More than 5 fields (use a form page). Fields with complex dependencies.
- **State requirements**: Section-level edit/view toggle, dirty tracking for all fields, combined save/cancel.

**Form Page**
- **When to use**: 3+ fields. Cross-field validation. Creation of new records. Data with dependencies between fields. Infrequent editing.
- **When NOT to use**: Single-field updates that happen often.
- **State requirements**: Form dirty state, field-level errors, submit loading, unsaved changes guard.
- **Common pitfall**: Not pre-populating fields when editing an existing record, forcing the user to re-enter unchanged data.

**Multi-Step Wizard**
- **When to use**: 8+ fields with logical grouping. Steps that depend on previous answers. Complex onboarding. Data that benefits from focused attention per section.
- **When NOT to use**: Forms where users need to see all fields at once. Fewer than 7 fields.
- **State requirements**: Current step index, per-step validation, completed steps tracking, ability to navigate back, partial save between steps.
- **Data requirements**: Step dependency map, validation rules per step, draft persistence.
- **Common pitfall**: Not allowing users to go back and change previous steps. Every wizard must support backward navigation.

**Bottom Sheet (Mobile)**
- **When to use**: Mobile quick-edit flows. 1-3 fields. Actions that stem from a list item. Contextual editing without losing the parent view.
- **When NOT to use**: Desktop-primary interfaces. Complex forms. Content taller than 70% of viewport.
- **State requirements**: Open/closed, snap points (half/full), drag-to-dismiss, backdrop interaction policy.

### Auto-Save vs. Explicit Save vs. Save Draft

**Auto-Save**
- **When to use**: Collaborative documents. Long-form content (notes, articles). Settings that take effect immediately. Forms where data loss risk is high.
- **When NOT to use**: Financial transactions. Sensitive data changes. Forms where partial state is invalid or dangerous.
- **State requirements**: Debounce timer (typically 1-2 seconds after last keystroke), save status indicator (saving.../saved/error), conflict detection for collaboration, offline queue.
- **Common pitfall**: Not showing save status. Users must always know whether their changes are saved.

**Explicit Save (Button)**
- **When to use**: Transactional data (orders, payments). Forms where partial saves are meaningless. When review-before-commit is important.
- **When NOT to use**: Long editing sessions where data loss risk is high. Collaborative editing.
- **State requirements**: Dirty tracking (enable/disable save button), unsaved changes warning on navigation, loading state on submit.
- **Common pitfall**: Not disabling the save button during submission, allowing double-submits.

**Save Draft**
- **When to use**: Content publishing workflows. Long forms completed over multiple sessions. When the saved state and published state differ.
- **When NOT to use**: Simple settings. Real-time collaborative content.
- **State requirements**: Draft vs. published status, last saved timestamp, draft auto-save interval, publish confirmation.

### Bulk Edit vs. Individual Edit

**Bulk Edit**
- **When to use**: Applying the same change to 5+ items. Common operations like status change, category assignment, tagging.
- **When NOT to use**: Each item needs unique values. Complex validation per item.
- **State requirements**: Selected items set, bulk edit form (fields to change), progress/result summary, partial failure handling.
- **Common pitfall**: Not showing which items failed and why when a bulk operation partially succeeds.

**Individual Edit**
- **When to use**: Each item has unique field values. Complex per-item validation. Low frequency of cross-item changes.
- **When NOT to use**: Repetitive identical changes across many items.

---

## 3. Selection Patterns

### Dropdown vs. Radio Group vs. Toggle vs. Chip Group vs. Combobox

**Dropdown (Select)**
- **When to use**: 5-15 options. Single selection. Limited horizontal space. Options are a flat list without grouping.
- **When NOT to use**: Fewer than 5 options (use radio). More than 15 without search (use combobox). When the user benefits from seeing all options at once.
- **State requirements**: Open/closed, selected value, placeholder text, keyboard navigation (arrow keys, type-ahead).
- **Common pitfall**: Using a dropdown for yes/no or on/off choices. Use a toggle or checkbox instead.

**Radio Group**
- **When to use**: 2-5 mutually exclusive options. User benefits from comparing all options visually. Options have descriptions or icons.
- **When NOT to use**: More than 5 options (too much vertical space). When the selection is not mutually exclusive (use checkboxes).
- **State requirements**: Selected value (exactly one), default selection recommended (avoid no-selection state).

**Toggle (Switch)**
- **When to use**: Binary on/off states. Settings that take immediate effect. The two states have clear, opposite meanings.
- **When NOT to use**: When the action requires a save step (use checkbox). When the states are not clearly opposite.
- **State requirements**: Boolean value, optional loading state for async toggles, label that describes the "on" state.
- **Common pitfall**: Not making it clear which state is "on." Always label both states or position the label to describe the enabled state.

**Chip Group (Segmented Control)**
- **When to use**: 2-6 options where the selection changes the view or filters content. Multi-select tagging. Compact horizontal layout.
- **When NOT to use**: More than 6 options (wrapping chips are confusing). Formal data entry forms.
- **State requirements**: Selected value(s), multi-select vs. single-select policy, overflow behavior for many chips.

**Combobox (Searchable Select)**
- **When to use**: 15+ options. Options the user may know by name. Custom value entry needed. Async option loading (search-as-you-type).
- **When NOT to use**: Fewer than 10 well-known options. When browsing options is more important than searching.
- **State requirements**: Input text, filtered options list, selected value, loading state for async search, debounce on search input, highlight matching text.
- **Common pitfall**: Not handling the "no results" state. Always show a message and optionally a "create new" action.

### Date/Time Input

**Calendar Picker**
- **When to use**: Specific date selection. Date range selection. When day-of-week context matters (scheduling). When relative position of dates matters.
- **When NOT to use**: Dates far in the past (birthdate entry -- use typed input). Time-only selection.
- **State requirements**: Current viewed month, selected date(s), min/max bounds, disabled dates, today highlight.

**Text Input (Typed Date)**
- **When to use**: Known dates (birthdates, document dates). Dates far from today. When speed matters for experienced users.
- **When NOT to use**: When day-of-week context matters. Date range selection.
- **State requirements**: Input mask or format hint, parsing logic for multiple formats, validation feedback.
- **Common pitfall**: Not accepting common date formats. Parse liberally, display consistently.

**Relative Selector ("Last 7 Days")**
- **When to use**: Reporting and analytics filters. When the exact date matters less than the time window. When common presets cover 80% of use cases.
- **When NOT to use**: Precise date requirements. When the user thinks in absolute dates.
- **State requirements**: Selected preset, custom range fallback, resolved absolute dates for API calls.

### File Input

**Drag-and-Drop Zone**
- **When to use**: Desktop-primary interfaces. Bulk file uploads. When files are the primary content (design tools, document management).
- **When NOT to use**: Mobile-primary interfaces. Single small file uploads where a button is simpler.
- **State requirements**: Drag-over visual state, file validation (type, size), upload progress per file, error per file, retry capability.

**File Button**
- **When to use**: Simple single-file upload. Mobile interfaces. As a fallback alongside drag-and-drop.
- **When NOT to use**: Never omit this when offering drag-and-drop (always provide as fallback).

**Paste Input**
- **When to use**: Image paste from clipboard. Content from other applications. When speed of input matters.
- **State requirements**: Clipboard event listener, content type detection, preview before confirm.

**URL Input**
- **When to use**: Referencing external resources. When the file already exists online. When avoiding large uploads is beneficial.
- **When NOT to use**: When users have local files. When you need to guarantee file availability.
- **State requirements**: URL validation, fetch/preview capability, error handling for unreachable URLs.

---

## 4. Confirmation and Destructive Action Patterns

### Delete Confirmation

**Modal Dialog**
- **When to use**: Irreversible deletion. Deleting items that affect other users. Cascade deletes (deleting a project deletes all tasks).
- **When NOT to use**: Frequent low-risk deletions (removing a tag, clearing a filter). Reversible soft-deletes.
- **State requirements**: Item identifier in dialog text, explicit action label ("Delete Project" not "OK"), optional type-to-confirm for high-risk actions.
- **Common pitfall**: Generic "Are you sure?" messages. Always state what will be deleted and what the consequences are.

**Undo Toast**
- **When to use**: Reversible deletions. Frequent deletions where confirmation friction is costly. Archiving, removing from list, soft-delete.
- **When NOT to use**: Irreversible actions. Cascade deletes. Actions with side effects (sent emails, API calls to external systems).
- **State requirements**: Undo timer (5-10 seconds), pending deletion queue, toast visibility, undo handler that restores state.
- **Data requirements**: Item data must be retained in memory or a trash state for the undo window duration.

**Inline Confirm**
- **When to use**: Table row actions. When the delete target must be unambiguous. When modal context-switching is too disruptive.
- **When NOT to use**: Bulk deletions. When the confirmation needs to show impact details.
- **State requirements**: Confirming state per row, auto-cancel after timeout (10 seconds), click-outside-to-cancel.

**Trash/Archive Pattern**
- **When to use**: Content management systems. When users frequently need to recover items. When permanent deletion is rare.
- **When NOT to use**: When storage costs make retention expensive. When regulatory requirements demand immediate deletion.
- **State requirements**: Trash location, retention policy (auto-purge after 30 days), restore capability, empty trash action.

### Save Confirmation

**Auto-Save Indicator**
- **When to use**: Paired with auto-save. Shows "Saving..." then "Saved" with timestamp.
- **State requirements**: Save status enum (idle, saving, saved, error), last saved timestamp, position (typically top-right or toolbar).

**Success Toast**
- **When to use**: Explicit save actions. When the user expects confirmation. When the next action is not a redirect.
- **State requirements**: Duration (3-5 seconds), auto-dismiss, do not stack multiple success toasts.

**Redirect After Save**
- **When to use**: Creation flows (redirect to the new item). When the form context is no longer relevant. Checkout flows.
- **When NOT to use**: When the user may want to continue editing.
- **Common pitfall**: Redirecting without any confirmation, leaving the user unsure if the save succeeded. Show a brief toast even when redirecting.

### Abandon Unsaved Changes

**Custom Modal ("Unsaved Changes")**
- **When to use**: Forms with significant data entry. When auto-save is not available. Three options: Save and leave, Discard, Cancel.
- **When NOT to use**: When auto-save handles persistence. When the form has no dirty state.
- **State requirements**: Dirty tracking on the form, navigation guard (route change, tab close, back button).
- **Common pitfall**: Not guarding against browser back button and tab close, only guarding in-app navigation.

**Auto-Save Draft**
- **When to use**: Long content editing. When preserving partial work is more important than explicit save semantics.
- **State requirements**: Draft storage (local or server), draft recovery prompt on return, draft expiration policy.

---

## 5. Feedback Patterns

### Toast/Snackbar vs. Inline Message vs. Banner vs. Status Bar

**Toast/Snackbar**
- **When to use**: Success confirmations. Non-critical info. Undo actions. Messages that do not require user action.
- **When NOT to use**: Errors the user must address. Messages that need to persist. Critical system status.
- **State requirements**: Queue/stack for multiple toasts, duration (3-8 seconds), dismiss action, position (bottom-center or top-right), max 1-2 visible at once.
- **Common pitfall**: Showing error messages as toasts that disappear before the user reads them. Errors should be inline or persistent.

**Inline Message**
- **When to use**: Form validation errors (below the field). Contextual warnings near the relevant content. Status messages for a specific section.
- **When NOT to use**: Global status. Success messages for the whole page.
- **State requirements**: Visibility tied to the relevant state, dismiss capability for warnings, icon and color coding by severity.

**Banner (Page-Level)**
- **When to use**: System-wide announcements. Persistent warnings (subscription expiring). Maintenance notices. Messages that affect the entire page.
- **When NOT to use**: Frequent messages (banner fatigue). Success confirmations.
- **State requirements**: Dismissible vs. persistent policy, position (top of page, below header), collapse/expand for long messages.

**Status Bar**
- **When to use**: Continuous status (connection state, sync status, active mode). Information that the user glances at periodically.
- **When NOT to use**: One-time notifications. Urgent errors requiring action.
- **State requirements**: Always visible in a fixed position, concise text, color coding, optional detail on click.

### Progress Indication

**Determinate Progress Bar**
- **When to use**: File uploads. Multi-step processes with known step count. Operations where percentage complete is calculable.
- **When NOT to use**: Operations with unknown duration. Sub-second operations.
- **State requirements**: Percentage value (0-100), optional label, optional ETA, color change on completion or error.

**Indeterminate Spinner**
- **When to use**: API calls with unknown duration. Short operations (under 10 seconds). When calculating progress is not feasible.
- **When NOT to use**: Operations longer than 10 seconds (add a message or switch to determinate). Full-page blocking (use skeleton instead).
- **State requirements**: Visible/hidden boolean, optional label ("Loading...", "Saving..."), size variant (inline vs. page-level).

**Skeleton Screen**
- **When to use**: Initial page loads. Content-heavy pages where layout is known. When reducing perceived load time matters.
- **When NOT to use**: Actions triggered by the user (use spinner near the trigger). Error states. Empty states.
- **State requirements**: Layout matching the expected content shape, animation (pulse or wave), transition to real content without layout shift.
- **Common pitfall**: Skeleton shapes that do not match the actual content layout, causing a jarring shift when content loads.

**Status Text**
- **When to use**: Background operations. Batch processing with named steps. When the user benefits from knowing what is happening ("Importing contacts... 42 of 380").
- **State requirements**: Current step description, optional progress count, optional cancel action.

### Validation Feedback

**Inline (Below Field)**
- **When to use**: All form validation errors. The primary pattern for field-specific problems.
- **When NOT to use**: Cross-field validation errors that do not belong to one field (use summary).
- **State requirements**: Error message per field, field highlight (red border), icon, aria-describedby linkage.
- **Timing**: On blur for first validation, then real-time after first error is shown. On submit as fallback.

**Summary (Top of Form)**
- **When to use**: Long forms where errors may be off-screen. Cross-field validation. After a failed submit attempt.
- **When NOT to use**: As the only error indicator (always pair with inline errors).
- **State requirements**: Error list with links/anchors to each field, scroll-to-top on submit failure, error count.

**Real-Time Validation**
- **When to use**: Username availability. Password strength. Format validation (email, phone). When immediate feedback prevents wasted effort.
- **When NOT to use**: Showing errors on empty fields before the user has typed. Fields where any intermediate state is invalid (do not show "invalid email" while the user is still typing).
- **Timing**: Debounced (300-500ms after last keystroke) for async checks. On blur for format validation. Never on the first keystroke of an empty field.
- **Common pitfall**: Validating eagerly on every keystroke, showing errors while the user is mid-entry. Debounce and wait for blur.

---

## 6. Navigation Patterns

### Tabs vs. Sidebar vs. Top Nav vs. Bottom Nav

**Tabs**
- **When to use**: 2-6 peer-level sections. Content that users switch between frequently. When sections are not deeply nested.
- **When NOT to use**: More than 6 sections. Sections with sub-navigation. When tab labels are too long for the available width.
- **State requirements**: Active tab index, content for each tab (eager or lazy loaded), optional tab counts/badges.

**Sidebar**
- **When to use**: 7+ sections. Nested/hierarchical navigation. Desktop-primary applications. When section labels are long or need icons.
- **When NOT to use**: Mobile-primary apps (use bottom nav or hamburger). Fewer than 5 sections on desktop.
- **State requirements**: Expanded/collapsed state, active item, nested expand/collapse, responsive behavior (collapse to icons or hide on mobile).

**Top Nav**
- **When to use**: Marketing sites. Applications with few top-level sections. When brand identity needs prominent horizontal space.
- **When NOT to use**: Many sections (overflows poorly). Deep hierarchies.
- **State requirements**: Active item, responsive collapse to hamburger menu, dropdown for sub-items.

**Bottom Nav (Mobile)**
- **When to use**: Mobile apps with 3-5 primary destinations. Frequent switching between top-level sections. Thumb-reachable navigation.
- **When NOT to use**: Desktop interfaces. More than 5 items. Secondary or contextual navigation.
- **State requirements**: Active item, badge counts, icon + short label, safe area inset for notched devices.
- **Common pitfall**: Putting more than 5 items in a bottom nav. If you have more, use 4 items plus a "More" menu.

### Breadcrumbs vs. Back Button vs. Both vs. Neither

**Breadcrumbs**
- **When to use**: 3+ levels of hierarchy. When the user may want to jump to any ancestor level. E-commerce categories, file systems, nested settings.
- **When NOT to use**: Flat navigation (only 1-2 levels). When there is only one path to any page (use back button).

**Back Button**
- **When to use**: Linear flows (wizards, detail-to-list). Mobile interfaces. When the previous page is always predictable.
- **When NOT to use**: When multiple paths lead to the same page (back is ambiguous).

**Both**
- **When to use**: Complex hierarchies where users arrive from multiple paths. Desktop applications with deep nesting.

**Neither**
- **When to use**: Top-level pages. Single-page applications with tab/sidebar navigation. Dashboard home screens.

### Stepper vs. Wizard vs. Accordion

**Stepper (Visual Progress)**
- **When to use**: 3-7 sequential steps. When the user benefits from seeing overall progress and remaining steps.
- **When NOT to use**: More than 7 steps (overwhelming). Steps with branching logic that changes the total.
- **State requirements**: Step labels, current/completed/upcoming states, clickable completed steps for back-navigation.

**Wizard (Full-Page Steps)**
- **When to use**: Complex flows requiring focus (checkout, account setup). Steps with significant content per step.
- **When NOT to use**: Simple forms under 7 fields. When users need to reference multiple steps simultaneously.
- **State requirements**: Step data persistence, step validation before advancing, skip logic, progress indicator.

**Accordion (Expandable Sections)**
- **When to use**: Non-linear forms where users can complete sections in any order. FAQ and help content. When overview of all sections is valuable.
- **When NOT to use**: Strictly sequential processes. When only one section should be visible at a time (use wizard).
- **State requirements**: Open/closed per section, section completion indicators, expand-all/collapse-all option.

### Search vs. Browse vs. Filter

**Search**
- **When to use**: User knows what they want (known-item seeking). Large data sets (100+ items). Text-heavy content.
- **State requirements**: Query string, results list, result count, no-results state, search history (optional).

**Browse**
- **When to use**: Exploratory behavior. Curated or categorized content. When users do not know exact terms.
- **State requirements**: Category structure, sort order, current position in taxonomy.

**Filter**
- **When to use**: Narrowing a known data set by attributes. Faceted navigation (e-commerce). When multiple criteria refine results.
- **State requirements**: Active filters, filter counts, clear-all action, URL sync for shareable filtered views.
- **Common pitfall**: Not showing the count of results matching each filter value. Always show counts to prevent zero-result dead ends.

---

## 7. Data Display Patterns

### Table vs. Cards vs. List vs. Timeline vs. Kanban

**Table**
- **When to use**: Comparing items across consistent attributes. Data with 4+ columns. Sortable and filterable data. Dense information display.
- **When NOT to use**: Items with variable attributes. Image-heavy content. Mobile-primary interfaces.
- **State requirements**: Sort column and direction, column visibility, row selection, pagination or virtual scroll, responsive strategy (horizontal scroll or stacked).

**Cards**
- **When to use**: Items with images or visual previews. Variable content per item. Grid layouts. When each item is an entry point to a detail view.
- **When NOT to use**: Cross-item comparison. Dense data with many attributes. When vertical space is limited.
- **State requirements**: Grid column count (responsive), card height strategy (fixed or masonry), loading skeletons per card.

**List**
- **When to use**: Sequential content (messages, notifications, activity feeds). Items with 1-3 attributes. Mobile interfaces.
- **When NOT to use**: Items with many attributes (use table). When spatial layout matters (use cards).

**Timeline**
- **When to use**: Chronological events. Activity logs. Status history. When temporal sequence is the primary organizing principle.
- **State requirements**: Sort direction (newest first vs. chronological), date grouping, infinite scroll or pagination by date range.

**Kanban**
- **When to use**: Status-based workflows. When drag-and-drop between states is the primary action. Small to medium item counts per column.
- **When NOT to use**: More than 7 columns. Items that do not have a clear status workflow. Large item counts per column (50+).
- **State requirements**: Column definitions, item order within columns, drag state, drop targets, optimistic reorder with rollback.

### Sort vs. Filter vs. Group vs. Search

Combine them based on data volume and user tasks:
- **Under 20 items**: Sort alone is usually sufficient.
- **20-100 items**: Sort + filter. Add search if items have text content.
- **100-1000 items**: Sort + filter + search. Add grouping if there are natural categories.
- **1000+ items**: Search as primary, filter as secondary, sort within results. Consider faceted search.

### Pagination vs. Infinite Scroll vs. Load More vs. Virtual Scroll

**Pagination**
- **When to use**: User needs to reach specific items or pages. Deep linking to page N is required. SEO is important. Data tables.
- **When NOT to use**: Casual browsing (social feeds). When total count is unknown or very large.
- **State requirements**: Current page, total pages, page size, URL sync.

**Infinite Scroll**
- **When to use**: Social feeds. Image galleries. Content browsing where order does not matter. When engagement time is the goal.
- **When NOT to use**: When users need to reach the footer. When deep linking to a specific position matters. When the user has a specific target.
- **State requirements**: Scroll sentinel element, next page cursor, loading state, end-of-list indicator, scroll position restoration on back-navigation.
- **Common pitfall**: Not restoring scroll position when the user navigates back. Cache loaded items and scroll offset.

**Load More Button**
- **When to use**: When you want the benefits of incremental loading without hijacking scroll. When the footer must be reachable. As a middle ground.
- **State requirements**: Items loaded count, total count, loading state on button.

**Virtual Scroll (Windowed)**
- **When to use**: Very large lists (1000+ items) already loaded in memory. When rendering all DOM nodes would cause performance issues.
- **When NOT to use**: Server-paginated data. Lists under 200 items. Items with variable heights (complex to implement).
- **State requirements**: Scroll offset, visible range, item height (fixed or measured), overscan count.

### Master-Detail vs. Standalone vs. Overlay

**Master-Detail (Split View)**
- **When to use**: Users frequently switch between items. Detail is supplementary to the list. Desktop with sufficient width. Email clients, file managers, admin panels.
- **When NOT to use**: Mobile (not enough width). When detail requires full focus. When the list is rarely referenced while viewing detail.
- **State requirements**: Selected item, list scroll position, detail panel width, responsive collapse strategy.

**Standalone Detail**
- **When to use**: Detail content is complex and deserves full width. Mobile interfaces. When the user spends significant time on each item.

**Overlay Detail (Drawer/Modal)**
- **When to use**: Quick inspection without losing list context. Preview before committing to full navigation. Moderate detail complexity.

---

## 8. Form Patterns

### Single-Page Form vs. Multi-Step Wizard vs. Progressive Disclosure

**Single-Page Form**
- **When to use**: Under 7 fields. No field dependencies. Quick completion time. When seeing all fields provides useful context.
- **State requirements**: Field values, field errors, dirty state, submit loading.

**Multi-Step Wizard**
- **When to use**: 8+ fields with logical groups. Steps that depend on prior answers. When cognitive load per step should be low.
- **State requirements**: Step index, per-step validation, step completion flags, aggregate form data, back navigation, draft save.
- **Common pitfall**: Not saving progress between steps. If the user refreshes on step 4, they should not lose steps 1-3.

**Progressive Disclosure**
- **When to use**: When most users only need basic fields. Advanced options that 20% of users need. When the form feels overwhelming at first glance.
- **State requirements**: Disclosure toggle, expanded/collapsed sections, validation that accounts for hidden-but-required fields.

### Required vs. Optional Field Strategy

**Mark Required (Asterisk)**
- **When to use**: Most fields are optional. The required fields are the minority and need to stand out.

**Mark Optional (Label)**
- **When to use**: Most fields are required. The few optional fields should be identified to reduce pressure.

**Separate Sections**
- **When to use**: Clear split between essential and supplementary information. When optional fields can be deferred.

**Rule of thumb**: Mark the minority. If most fields are required, mark the optional ones. If most are optional, mark the required ones.

### Dynamic Forms

**Show/Hide Fields**
- **When to use**: 1-3 fields depend on a single toggle or selection. Layout impact is minimal.
- **State requirements**: Condition map (which field triggers which), animation for appearance, clear hidden field values or preserve them.

**Add/Remove Sections (Repeatable Groups)**
- **When to use**: Variable-count items (add another address, add line item). When the user controls how many groups exist.
- **State requirements**: Array of section data, per-section validation, add/remove handlers, minimum/maximum count, reorder capability.

**Conditional Steps (in Wizard)**
- **When to use**: Branching paths based on user input (business vs. personal account). When entire steps are relevant or irrelevant.
- **State requirements**: Step visibility conditions, dynamic step count in progress indicator, preserved data for skipped steps if the user backtracks.

---

## 9. Onboarding Patterns

### Wizard vs. Contextual Tips vs. Empty State Guidance vs. Checklist vs. Video Tour

**Setup Wizard**
- **When to use**: Mandatory configuration before the app is usable. Account setup, workspace creation. One-time flows.
- **When NOT to use**: Optional features. When the app is usable with defaults.
- **Common pitfall**: Making the wizard too long. Keep mandatory setup under 5 steps. Defer optional configuration.

**Contextual Tips (Coach Marks)**
- **When to use**: Highlighting specific UI elements on first use. Feature discovery for complex interfaces. Non-blocking guidance.
- **When NOT to use**: More than 5 tips in sequence (tip fatigue). On every page load (show once, then store dismissal).
- **State requirements**: Tip sequence, current tip index, dismiss/complete tracking per user, element targeting and positioning.

**Empty State Guidance**
- **When to use**: First-time experience of a feature area. When the empty state IS the onboarding. Creating the first item, importing data.
- **When NOT to use**: Screens that are never empty for returning users.
- **State requirements**: Conditional rendering based on data count, clear CTA, optional illustration or animation.
- **Common pitfall**: Empty states that only say "No items yet" without guiding the user on what to do next. Always include an action.

**Checklist**
- **When to use**: Multi-step setup the user can complete in any order. When progress visibility motivates completion. Product-led growth onboarding.
- **State requirements**: Task list with completion state, progress percentage, optional reward/celebration on completion, dismissible after completion.

**Video Tour**
- **When to use**: Complex workflows that benefit from visual demonstration. When reading documentation is unlikely. Optional and skippable.
- **When NOT to use**: Simple interfaces. As the only onboarding method. As a replacement for an intuitive UI.

### Permission/Access Requests

**Upfront (During Setup)**
- **When to use**: Permissions that are essential for core functionality. When explaining context upfront improves grant rate.
- **When NOT to use**: Permissions for secondary features. When asking before the user sees value.

**Just-in-Time (On First Use)**
- **When to use**: Permissions tied to a specific feature the user just triggered. When context makes the request self-explanatory.
- **Common pitfall**: Not explaining WHY the permission is needed before the system prompt appears. Pre-prompt with your own UI explanation.

**Progressive (Earn Trust First)**
- **When to use**: Multiple permissions needed over time. When early trust-building improves later grant rates. Notifications, location, camera in sequence.
- **State requirements**: Permission status tracking, graceful degradation for denied permissions, re-request strategy.

---

## 10. Bulk Operation Patterns

### Selection Mechanisms

**Checkbox Column**
- **When to use**: Table layouts. When selection is a common action. When the user needs precise per-item control.
- **State requirements**: Per-row selected boolean, select-all checkbox (with tri-state for partial), selected count display.

**Click-to-Select**
- **When to use**: Card and list layouts. When checkboxes add too much visual clutter. When selection mode is toggled explicitly.
- **State requirements**: Selection mode active/inactive, visual indicator for selected items, shift-click range selection.

**Select All**
- **When to use**: Bulk operations across entire data sets. When "select all across all pages" is needed, not just the visible page.
- **State requirements**: All-visible vs. all-matching distinction, clear indication of scope ("All 2,340 items selected"), deselect individuals from select-all.
- **Common pitfall**: "Select all" that only selects the current page without making this clear. Always state the scope explicitly.

### Bulk Action UI

**Floating Action Bar (Appears on Selection)**
- **When to use**: Selection is intermittent. Actions should be prominent when relevant. Modern SaaS pattern.
- **State requirements**: Selection count, available actions, position (bottom of viewport), animation on appear/disappear.

**Always-Visible Actions (Toolbar)**
- **When to use**: Bulk actions are a primary workflow. When disabled states for no-selection are acceptable.
- **State requirements**: Enabled/disabled based on selection, action availability based on selected items.

**Context Menu (Right-Click)**
- **When to use**: Desktop power users. As a secondary access method alongside toolbar actions. Never as the only way to access actions.
- **When NOT to use**: As the primary action discovery mechanism. Mobile interfaces.

### Batch Processing Feedback

**Per-Item Progress**
- **When to use**: Small batches (under 20). When individual item success/failure matters. When the user wants to monitor each item.
- **State requirements**: Per-item status (pending, processing, success, error), list view of items with status indicators.

**Overall Progress**
- **When to use**: Large batches (20+). When individual item status is less important than completion. Background operations.
- **State requirements**: Total count, completed count, progress bar, estimated time remaining, error count.

**Complete Notification**
- **When to use**: Background operations the user initiated and then navigated away from. When the operation takes more than 10 seconds.
- **State requirements**: Notification delivery (in-app, push, email based on duration), result summary, link to results, retry for failures.
- **Common pitfall**: Not handling partial failures. Always report successes and failures separately with the option to retry only the failed items.

---

## Quick Reference: Decision Shortcuts

The 10 most common decisions reduced to one-line rules.

| Decision | Quick Rule |
|----------|-----------|
| Modal or not? | Only if user MUST respond before continuing. Otherwise: drawer, inline, or new page. |
| Inline edit or form? | 1-2 fields: inline. 3+ fields: form. Cross-field validation: always form. |
| Toast or inline message? | Success: toast. Error: inline near the problem. System-wide: banner. |
| Dropdown or radio? | 5 or fewer visible options: radio. More than 5 or tight space: dropdown. Needs search: combobox. |
| Table or cards? | Comparing rows of data: table. Visual previews or varied content: cards. Mobile: cards or list. |
| Pagination or infinite scroll? | Finding specific items or deep linking: pagination. Casual browsing: infinite scroll. Both: load-more button. |
| Wizard or single form? | Over 7 fields with step dependencies: wizard. Under 7 or no dependencies: single form with sections. |
| Delete confirm or undo? | Reversible with no side effects: undo toast. Irreversible or has side effects: confirm dialog. |
| Auto-save or manual save? | Collaborative or long-form content: auto-save. Transactional or sensitive data: manual save with dirty tracking. |
| Tabs or sidebar? | 6 or fewer peer sections: tabs. 7+ or nested hierarchy: sidebar. Mobile: bottom nav for top-level, tabs for sub-sections. |
