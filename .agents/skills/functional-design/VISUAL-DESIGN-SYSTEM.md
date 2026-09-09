# Visual Design System Reference

How to detect, adopt, or generate a complete visual design system for any project.
Framework-agnostic: tokens and patterns apply to any frontend stack.
The COMPONENT-GENERATION.md reference handles framework-specific code output.

---

## 1. Project Detection

Before generating anything, detect what already exists. Adopting an existing system
is always faster and more consistent than replacing it.

### Detection Steps

1. **Tailwind config** — Read `tailwind.config.ts` or `tailwind.config.js`.
   - Look for `theme.extend.colors` (custom color tokens).
   - Look for `theme.extend.fontFamily` (custom fonts).
   - Look for `theme.extend.spacing` (custom spacing scale).
   - Look for `theme.extend.borderRadius`, `boxShadow`, `animation`, `keyframes`.
   - If a `preset` is referenced, read that file too.

2. **Global styles** — Read `index.css`, `globals.css`, `styles.css`, or equivalent.
   - Look for CSS custom properties (`--color-*`, `--spacing-*`, `--font-*`).
   - Look for `@layer base`, `@layer components`, `@layer utilities` blocks.
   - Look for imported font families (`@import`, `@font-face`).
   - Look for dark mode selectors (`.dark`, `[data-theme="dark"]`, `@media (prefers-color-scheme: dark)`).

3. **Existing components** — Read 3-5 core components (Button, Card, Input, Badge, Layout).
   - Identify established patterns: variant props, size props, color usage.
   - Note border radius consistency (or lack thereof).
   - Note spacing patterns (consistent padding values or ad-hoc).
   - Note color usage (tokens or hard-coded hex values).

4. **Package dependencies** — Read `package.json`.
   - UI library present? (shadcn/ui, Radix, Headless UI, PrimeNG, Angular Material, MUI, Chakra)
   - Icon library? (Lucide, Heroicons, Phosphor, Material Icons)
   - Animation library? (Framer Motion, GSAP, Angular Animations)

### Decision Matrix

| Detection Result | Action |
|---|---|
| Tailwind config with custom tokens + consistent components | ADOPT fully. Document what exists. Fill gaps only. |
| Tailwind config with partial tokens | ADOPT tokens. Extend missing categories using the same naming convention. |
| UI library installed (shadcn, MUI, etc.) | ADOPT library defaults. Override only where the project already diverges. |
| Global CSS variables but no Tailwind | ADOPT variable naming scheme. Map to the system below. |
| No design system detected | GENERATE from scratch using sections 2-8 below. |

### What to Preserve When Adopting

- Every custom color token name (even if you would name it differently).
- Existing border-radius values (do not normalize to your preference).
- Component variant names (primary/secondary/destructive vs. filled/outlined/text).
- Established spacing rhythm (if they use 5px base instead of 4px, keep it).
- Font choices already loaded and in use.

---

## 2. Color System Generation

### Surface Hierarchy (5 Levels)

Surface levels create visual depth. In dark themes they replace shadows entirely.
In light themes they supplement shadows.

**Dark Theme Surfaces**

| Token | Hex Range | Usage |
|---|---|---|
| `surface-0` | `#09090b` - `#0a0a0f` | Page background, deepest layer |
| `surface-1` | `#111118` - `#131320` | Card backgrounds, primary containers |
| `surface-2` | `#1a1a24` - `#1c1c28` | Nested cards, secondary containers, table headers |
| `surface-3` | `#222230` - `#24242f` | Hover states, active rows, elevated elements |
| `surface-4` | `#2a2a38` - `#2d2d3a` | Prominent elements, selected states, tooltips |

**Light Theme Surfaces**

| Token | Hex Range | Usage |
|---|---|---|
| `surface-0` | `#ffffff` | Page background |
| `surface-1` | `#f9fafb` - `#fafafa` | Card backgrounds, primary containers |
| `surface-2` | `#f3f4f6` - `#f4f4f5` | Nested cards, secondary containers, table headers |
| `surface-3` | `#e5e7eb` - `#e4e4e7` | Hover states, active rows |
| `surface-4` | `#d1d5db` - `#d4d4d8` | Prominent elements, selected states |

**Rules**
- Each step: 3-5% luminance difference. Enough to distinguish, not enough to jar.
- Test adjacent levels side-by-side. If you cannot tell them apart on a calibrated monitor, increase the step.
- Surface tokens are the ONLY background colors for layout. Components use surface tokens, never arbitrary grays.
- Page background is always `surface-0`. Cards sit on `surface-1`. Nested elements go up from there.

### Accent Color

One primary accent color. Not two. Not a gradient palette. One.

| Token | Derivation | Usage |
|---|---|---|
| `accent` | Base hue (e.g., `#6366f1` indigo) | Primary buttons, active nav, links, focus rings |
| `accent-hover` | 1-2 Tailwind stops lighter (`#818cf8`) | Hover state for accent elements |
| `accent-muted` | Base at 10-15% opacity (`#6366f1` / 12%) | Active nav background, selected row highlight, tag background |
| `accent-text` | Must pass 4.5:1 on `surface-0` | Text colored with accent (links, active labels) |

**Rules**
- Test `accent` on `surface-0` AND `surface-4`. Must have 4.5:1 contrast ratio on both.
- `accent-hover` must be visually distinct from `accent` (not just 1% lighter).
- `accent-muted` must be visible but not dominant. If it screams, reduce opacity.
- If the project has an established brand color, use it. Do not invent a new one.

### Semantic Colors

Semantic colors communicate status. They are never decorative.

| Semantic | Base | Muted (15% opacity) | Hover | Text |
|---|---|---|---|---|
| `success` | `#10b981` | `#10b981` / 15% | `#34d399` | `#10b981` (dark) / `#059669` (light) |
| `warning` | `#f59e0b` | `#f59e0b` / 15% | `#fbbf24` | `#f59e0b` (dark) / `#d97706` (light) |
| `error` | `#ef4444` | `#ef4444` / 15% | `#f87171` | `#ef4444` (dark) / `#dc2626` (light) |
| `info` | `#3b82f6` | `#3b82f6` / 15% | `#60a5fa` | `#3b82f6` (dark) / `#2563eb` (light) |

**Rules**
- Semantic colors appear on badges, alerts, form validation, status indicators. Nowhere else.
- Muted variants are backgrounds, never text colors.
- Text variants must pass 4.5:1 contrast on the surface they sit on.
- Never use green for a brand CTA just because "green means go."

### Border Colors

| Token | Dark Theme | Light Theme | Usage |
|---|---|---|---|
| `border-default` | `#ffffff` at 8-12% | `#000000` at 8-12% | Card edges, section dividers |
| `border-light` | `#ffffff` at 5-6% | `#000000` at 5-6% | Inner divisions, table row separators |
| `border-focus` | `accent` | `accent` | Focus rings, active field borders |
| `border-error` | `error` | `error` | Form validation borders |

**Rules**
- Borders in dark themes do the work that shadows do in light themes.
- `border-default` must be visible but subtle. Squint test: you should notice the edge, not the border itself.
- Never use gray hex values for borders. Use white/black with opacity so they adapt to any surface level.

### Color Anti-Patterns

- **Rainbow syndrome**: more than 1 accent + 4 semantics means you have a palette, not a system.
- **Semantic misuse**: using `error` red for a sale badge or `success` green for brand identity.
- **Insufficient surface contrast**: adjacent levels that look identical on low-quality monitors.
- **Hard-coded hex**: `bg-[#1a1a2e]` scattered through components instead of `bg-surface-1`.
- **Meaning drift**: the same color meaning different things in different components.

---

## 3. Typography Scale

### Font Families

| Token | Stack | Usage |
|---|---|---|
| `font-sans` | Inter, system-ui, -apple-system, sans-serif | All UI text |
| `font-mono` | JetBrains Mono, Fira Code, ui-monospace, monospace | Code, data values, IDs, timestamps |

**Rules**
- Maximum 2 families. One sans, one mono. No serif unless the project is editorial.
- If the project already loads a custom font, use it. Do not add Inter on top of it.
- Always include system fallbacks. Fonts fail to load.
- Load only weights you actually use (typically 400, 500, 600, maybe 700).

### Size Scale

| Token | Size | Line Height | Usage |
|---|---|---|---|
| `text-xs` | 0.75rem (12px) | 1rem (16px) | Captions, metadata, badge text, timestamps |
| `text-sm` | 0.875rem (14px) | 1.25rem (20px) | Body text, table cells, form labels, nav items |
| `text-base` | 1rem (16px) | 1.5rem (24px) | Default body, button text, input text |
| `text-lg` | 1.125rem (18px) | 1.75rem (28px) | Section headers, prominent body text |
| `text-xl` | 1.25rem (20px) | 1.75rem (28px) | Page subtitles, card titles |
| `text-2xl` | 1.5rem (24px) | 2rem (32px) | Page titles, KPI values |
| `text-3xl` | 1.875rem (30px) | 2.25rem (36px) | Hero numbers, dashboard metrics |

**Rules**
- Maximum 4 different sizes on any single screen. If you need 5, rethink the hierarchy.
- `text-sm` is the workhorse of data-heavy UI. Default to it for tables and forms.
- `text-base` is the workhorse of content UI. Default to it for reading.
- Never go below `text-xs` (12px). Accessibility floor.

### Weight Scale

| Token | Value | Usage |
|---|---|---|
| `font-normal` | 400 | Body text, table cells, descriptions |
| `font-medium` | 500 | Labels, nav items, subtle emphasis, form labels |
| `font-semibold` | 600 | Headings, KPI values, button text, column headers |
| `font-bold` | 700 | Hero numbers only. Use sparingly. |

**Rules**
- If everything is bold, nothing is bold. Reserve 700 for one or two elements per screen.
- Combine weight changes with size changes for clear hierarchy. Weight alone is too subtle.
- 500 is the most underused weight. It is perfect for labels and navigation.

### Line Heights

| Token | Value | Usage |
|---|---|---|
| `leading-tight` | 1.25 | Headings, single-line labels, KPI values |
| `leading-normal` | 1.5 | Body text, multi-line content |
| `leading-relaxed` | 1.75 | Long-form reading (rare in app UI) |

### Typography Anti-Patterns

- More than 4 font sizes on one view.
- Bold on everything (hierarchy collapse).
- Monospace for non-data content (labels, descriptions, buttons).
- Mixed casing conventions (Title Case nav with sentence case headings).
- Text below 12px for any reason.
- Custom letter-spacing on body text (leave it alone; adjust only on uppercase labels).

---

## 4. Spacing System

### Base Unit: 4px

| Tailwind | Pixels | Rem |
|---|---|---|
| `0.5` | 2px | 0.125rem |
| `1` | 4px | 0.25rem |
| `1.5` | 6px | 0.375rem |
| `2` | 8px | 0.5rem |
| `3` | 12px | 0.75rem |
| `4` | 16px | 1rem |
| `5` | 20px | 1.25rem |
| `6` | 24px | 1.5rem |
| `8` | 32px | 2rem |
| `10` | 40px | 2.5rem |
| `12` | 48px | 3rem |
| `16` | 64px | 4rem |

### Usage Rules

| Context | Spacing | Tailwind |
|---|---|---|
| Component internal padding | 12-16px | `p-3` to `p-4` |
| Between related elements | 8-12px | `gap-2` to `gap-3` |
| Between unrelated sections | 24-32px | `gap-6` to `gap-8` |
| Page horizontal margins | 16-24px | `px-4` to `px-6` |
| Page top padding | 24-32px | `pt-6` to `pt-8` |
| Grid gap | 16-24px | `gap-4` to `gap-6` |
| Icon to text | 8px | `gap-2` |
| Stacked form fields | 16px | `space-y-4` |

**Rules**
- Consistent spacing WITHIN a component. Vary spacing BETWEEN components to create grouping.
- If two elements are related, use tighter spacing. If they are independent, use wider spacing.
- Gestalt proximity principle: spacing communicates relationship more reliably than borders or boxes.
- When in doubt, use more space, not less.

### Density Modes

| Mode | Internal Padding | Gaps | Best For |
|---|---|---|---|
| **Compact** | Reduce by 1 step (p-2 instead of p-3) | Tighter (gap-1 to gap-2) | Data tables, admin dashboards, power user tools |
| **Comfortable** | Default scale | Default scale | Standard applications, mixed content |
| **Spacious** | Increase by 1 step (p-4 instead of p-3) | Generous (gap-4 to gap-6) | Consumer apps, marketing pages, onboarding flows |

Pick ONE density for the project and stick with it. Do not mix densities on the same page
unless there is a clear container boundary (e.g., a compact table inside a comfortable page).

---

## 5. Component Styling Anatomy

Define these properties for every component. Missing states cause visual bugs.

### Button

| Property | Primary | Secondary | Danger | Ghost |
|---|---|---|---|---|
| Background | `accent` | `surface-2` | `error` | `transparent` |
| Text | white | default text | white | default text |
| Border | none | `border-default` | none | none |
| Hover bg | `accent-hover` | `surface-3` | `error-hover` | `surface-1` |
| Active bg | darken accent 5% | `surface-4` | darken error 5% | `surface-2` |
| Focus | 2px ring, `accent`, 2px offset | same | same | same |
| Disabled | 40-50% opacity, `not-allowed` cursor | same | same | same |
| Loading | spinner beside or replacing text, pointer-events-none | same | same | same |

**Sizes**

| Size | Padding | Font | Min Height |
|---|---|---|---|
| sm | `px-2.5 py-1` | `text-xs` | 28px |
| md | `px-3.5 py-2` | `text-sm` | 36px |
| lg | `px-5 py-2.5` | `text-base` | 44px |

**Rules**
- Border radius: consistent across all buttons. `rounded-md` (6px) is the safe default.
- Transition: `transition-colors duration-150`.
- Primary button: maximum ONE per visible viewport area. It is the single clear CTA.
- Icon-only buttons: square aspect ratio, same height as text buttons, tooltip required.

### Card

| Property | Value |
|---|---|
| Background | `surface-1` (one level above page) |
| Border | `border-default` |
| Border radius | `rounded-lg` (8px) |
| Padding | `p-4` to `p-6` |
| Hover (if clickable) | `surface-2` bg or `border-accent` |
| Selected | `accent` border, `accent-muted` bg |
| Header | Optional. Separated by `border-light` bottom border. `pb-4` on header, `pt-4` on body. |
| Footer | Optional. Separated by `border-light` top border. `pt-4` on footer. |
| KPI variant | Accent left border (3-4px), rest default borders. |

### Badge / Tag

| Property | Status Badge | Tag |
|---|---|---|
| Background | `semantic-muted` (15% opacity) | `surface-2` or `accent-muted` |
| Text | `semantic-text` | default or `accent-text` |
| Border radius | `rounded-full` | `rounded-md` |
| Size sm | `text-xs px-2 py-0.5` | `text-xs px-2 py-0.5` |
| Size md | `text-xs px-2.5 py-1` | `text-xs px-2.5 py-1` |
| Dot indicator | Optional. 6px circle, pulse animation for active states. | Not applicable. |
| Interactivity | Read-only. Never clickable. | Optional dismiss button (x icon). |

### Table

| Property | Value |
|---|---|
| Header bg | `surface-2` |
| Header text | `text-xs font-semibold uppercase tracking-wide` in muted color |
| Row bg | `surface-1` (or transparent on `surface-1` cards) |
| Row hover | `surface-2` |
| Row selected | `accent-muted` bg |
| Cell padding | `px-4 py-3` |
| Row border | `border-light` bottom |
| Sort indicator | chevron icon, active column in default text color, inactive in muted |
| Numeric columns | Right-aligned |
| Text columns | Left-aligned |
| Icon columns | Center-aligned |
| Empty state | Centered message spanning all columns (see Empty State anatomy) |

### Form Elements

| Property | Value |
|---|---|
| Input bg | `surface-0` (dark) or `white` (light) |
| Input border | `border-default`, `border-focus` on focus, `border-error` on error |
| Input radius | `rounded-md` |
| Input padding | Match button padding for visual alignment beside buttons |
| Label | `text-sm font-medium`, above the field, `mb-1.5` gap |
| Help text | `text-xs` in muted color, below the field, `mt-1.5` gap |
| Error text | `text-xs` in `error-text` color, replaces help text, `mt-1.5` gap |
| Error state | `border-error` + `error-muted` bg (optional) + error text below |
| Disabled | Muted bg, 50% opacity text, `not-allowed` cursor |
| Focus | 2px ring in `accent`, 2px offset |
| Sizes | Match button sizes: sm/md/lg with same height for inline alignment |

### Navigation

| Property | Value |
|---|---|
| Active item | `accent-muted` bg + `accent-text` color (or accent left border 3px) |
| Hover item | `surface-2` bg |
| Inactive item | Muted text color |
| Icon size | 20px (5 Tailwind units) |
| Icon-to-text gap | `gap-2` (8px) |
| Item padding | `px-3 py-2` |
| Section divider | `border-light` with `my-2` margin |
| Mobile | Full-screen overlay or slide-in drawer from left, 300ms transition |

### Skeleton Loading

| Property | Value |
|---|---|
| Background | `surface-2` |
| Animation | Shimmer (gradient sweep left to right, 1.5s, infinite) or pulse (opacity 50-100%, 2s, infinite) |
| Text block | `h-4 rounded` matching line height of text it replaces |
| Avatar | Circle matching avatar size |
| Card | Full card shape with internal skeleton blocks |
| Table row | Row-width bars matching column widths |

**Rules**
- Skeletons match the EXACT layout of loaded content. Same widths, heights, positions.
- Vary skeleton block widths slightly (80%, 60%, 90%) to look organic, not robotic.
- Never show skeleton for more than 3 seconds. If loading takes longer, switch to a progress indicator.

### Empty State

| Property | Value |
|---|---|
| Layout | Centered in content area, `py-12` vertical padding minimum |
| Icon | Muted color, 48-64px, relevant to the content type |
| Heading | `text-lg font-semibold`, default text color |
| Description | `text-sm`, muted text color, max-width `20rem` for readability |
| CTA | Primary button below description, `mt-4` gap |

**Rules**
- Never show raw "No data" or empty containers. Always explain what would be here and how to populate it.
- The CTA should be the most obvious action to resolve the empty state.
- If the empty state is due to filters, show a "Clear filters" action.

---

## 6. Dark Theme Patterns

- **Depth**: Surface levels, not shadows. Shadows are invisible on dark backgrounds.
- **Separation**: Borders do the work. Subtle, consistent, omnipresent.
- **Muted backgrounds**: 10-15% opacity of semantic colors for grouping and status indication.
- **Text opacity**: Primary text at 87% white (`#e0e0e0` - `#ebebf0`). Secondary at 60%. Disabled at 38%.
- **No pure white**: Use `#f8fafc` or `#f1f5f9` instead of `#ffffff`. Pure white is harsh.
- **Hover direction**: Lighten backgrounds on hover, never darken. Darken looks like disabled.
- **Focus visibility**: Accent outline stands out naturally. Dark themes make focus rings easier to see.
- **Image treatment**: Consider `brightness-90` or subtle overlay on user images to match dark context.
- **Scrollbar styling**: Style scrollbars to match surface levels. Default scrollbars break immersion.

---

## 7. Light Theme Patterns

- **Depth**: Shadows are primary. `shadow-sm` for cards, `shadow-md` for dropdowns, `shadow-lg` for modals.
- **Separation**: White surfaces against light gray backgrounds. Borders optional when shadow provides enough separation.
- **Surfaces**: `#ffffff` cards on `#f9fafb` page backgrounds.
- **Text colors**: Primary `#111827` (gray-900). Secondary `#6b7280` (gray-500). Disabled `#9ca3af` (gray-400).
- **Accent adjustment**: Accent colors need to be slightly darker than dark theme variants to maintain contrast on white.
- **Hover direction**: Darken backgrounds slightly or add shadow.
- **Focus visibility**: Accent outline needs higher contrast. Consider a shadow-based focus ring as fallback.
- **Borders**: Lighter and more optional than dark theme. Use when shadows are insufficient.

---

## 8. Motion Design

### Functional Motion (Required)

Every interactive element must have motion feedback. Instant state changes feel broken.

| Type | Duration | Easing | Examples |
|---|---|---|---|
| State change | 150-200ms | ease-out | Button press, toggle, checkbox, badge update |
| Enter | 200-300ms | ease-out | Modal open, drawer slide, dropdown appear, toast enter |
| Exit | 150-200ms | ease-in | Modal close, toast dismiss, dropdown close |
| Move | 200-300ms | ease-in-out | List reorder, sort transition, layout shift |
| Loading | infinite | linear | Skeleton shimmer, spinner rotation |

### Decorative Motion (Optional)

Use decorative motion to add personality. But each instance must justify its existence.

| Type | Duration | When to Use |
|---|---|---|
| Page transition | 200ms crossfade | SPA route changes (only if framework supports) |
| Staggered reveal | 30-50ms delay per item | First load of a grid/list, never on filter/sort |
| Micro-celebration | 300ms scale-bounce | Major success actions (account created, payment complete), never routine saves |
| Attention pulse | 2s infinite pulse | Unread badges, active process indicators |

### Easing Reference

| Name | CSS Value | Usage |
|---|---|---|
| ease-out | `cubic-bezier(0, 0, 0.2, 1)` | Elements entering (appearing, expanding) |
| ease-in | `cubic-bezier(0.4, 0, 1, 1)` | Elements exiting (disappearing, collapsing) |
| ease-in-out | `cubic-bezier(0.4, 0, 0.2, 1)` | Elements moving (repositioning, resizing) |
| linear | `linear` | Continuous animations (spin, shimmer) |

### Duration Scale

| Token | Range | Usage |
|---|---|---|
| `instant` | 0-100ms | Micro-feedback: button press, checkbox toggle, ripple |
| `fast` | 100-200ms | State changes: hover, focus, badge update, tooltip |
| `standard` | 200-300ms | Enter/exit: modal, drawer, toast, dropdown |
| `slow` | 300-500ms | Complex transitions: page enter, staggered list reveal |

**Hard ceiling: 500ms. No UI transition should ever exceed this.**

### Motion Anti-Patterns

- Animating every element on page load. Pick 1-2 hero elements, let the rest appear instantly.
- Transitions longer than 500ms. Users perceive them as lag, not polish.
- Bouncy/elastic easing on professional data UI. Save spring physics for consumer/gaming apps.
- Blocking animations where the user must wait for completion before interacting.
- Inconsistent durations for the same transition type across the app.
- Scroll-triggered animations. Performance cost, accessibility issues, and most users scroll past them.
- Animating layout properties (width, height, top, left). Use transform and opacity only.

---

## 9. Design System Output Template

When the skill generates a design system for a project, output it in this format.

````markdown
## Design System: [Project Name]

### Detection Results
- Framework: [React/Angular/Vue/Svelte/vanilla]
- Styling: [Tailwind/CSS Modules/Styled-Components/Vanilla CSS]
- Existing theme: [Yes - adopted / No - generated fresh]
- Mode: [Dark / Light / Both]
- Density: [Compact / Comfortable / Spacious]

### Color Tokens

#### Surfaces
| Token | Dark | Light | Usage |
|---|---|---|---|
| `surface-0` | #09090b | #ffffff | Page background |
| `surface-1` | #111118 | #f9fafb | Card background |
| `surface-2` | #1a1a24 | #f3f4f6 | Nested containers, hover |
| `surface-3` | #222230 | #e5e7eb | Active states |
| `surface-4` | #2a2a38 | #d1d5db | Elevated elements |

#### Accent
| Token | Dark | Light | Usage |
|---|---|---|---|
| `accent` | [hex] | [hex] | Primary CTA, active states |
| `accent-hover` | [hex] | [hex] | Hover on accent elements |
| `accent-muted` | [hex/opacity] | [hex/opacity] | Backgrounds, selected rows |
| `accent-text` | [hex] | [hex] | Links, active labels |

#### Semantic
| Token | Base | Muted | Hover | Text |
|---|---|---|---|---|
| `success` | #10b981 | 15% opacity | #34d399 | [dark/light variant] |
| `warning` | #f59e0b | 15% opacity | #fbbf24 | [dark/light variant] |
| `error` | #ef4444 | 15% opacity | #f87171 | [dark/light variant] |
| `info` | #3b82f6 | 15% opacity | #60a5fa | [dark/light variant] |

#### Borders
| Token | Dark | Light |
|---|---|---|
| `border-default` | rgba(255,255,255,0.10) | rgba(0,0,0,0.10) |
| `border-light` | rgba(255,255,255,0.05) | rgba(0,0,0,0.05) |
| `border-focus` | [accent] | [accent] |
| `border-error` | [error] | [error] |

### Typography
- Sans: [font stack]
- Mono: [font stack]
- Scale: xs (12px), sm (14px), base (16px), lg (18px), xl (20px), 2xl (24px), 3xl (30px)
- Weights: normal (400), medium (500), semibold (600), bold (700)

### Spacing
- Base unit: 4px
- Density: [Compact/Comfortable/Spacious]
- Component padding: [value]
- Section gap: [value]
- Grid gap: [value]

### Component Patterns
[Summary of component styling decisions specific to this project. Reference section 5
for the full anatomy. Note any deviations from defaults.]

### Motion
| Type | Duration | Easing |
|---|---|---|
| State change | 150ms | ease-out |
| Enter | 250ms | ease-out |
| Exit | 150ms | ease-in |
| Move | 250ms | ease-in-out |
| Loading | infinite | linear |
````

---

## Quick Reference: Contrast Checking

Before finalizing any color combination, verify:

| Text Size | Minimum Contrast Ratio (WCAG AA) |
|---|---|
| Normal text (< 18px) | 4.5:1 |
| Large text (>= 18px bold or >= 24px) | 3:1 |
| UI components (borders, icons) | 3:1 |

Test these combinations at minimum:
- Primary text on `surface-0`
- Primary text on `surface-1`
- Secondary (muted) text on `surface-0`
- `accent-text` on `surface-0`
- `accent-text` on `surface-1`
- White text on `accent` background
- Each semantic text color on its muted background
