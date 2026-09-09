# /functional-design

**End-to-end UI/UX creation skill for Claude Code** — from requirements discovery to working component code.

Every top frontend/UX skill operates in visual design, design intelligence, or design process. None covers **Functional UX Architecture**: the discipline that says "before you pick a font or write a component, let's figure out what this application actually needs to *do*." This skill fills that gap — and then designs the visuals, generates a preview, and builds the code.

## What It Does

One invocation. Eight phases. Working UI.

| Phase | What Happens | Output |
|-------|-------------|--------|
| **1. Functional Discovery** | Interrogation-first protocol — 13 mandatory questions before any design | Requirements brief |
| **2. Architecture Mapping** | Screen inventory, navigation tree, data flow, state management | Architecture document |
| **3. Behavioral Specification** | State machines, user flows, empty/error/loading states, responsive behavior | Behavioral specs per component |
| **4. Interaction Design** | Microinteractions, error flows, compound state machines, transition intents | Interaction specs |
| **5. Validation & Handoff** | Nielsen's 10 heuristics audit, Norman's 7 stages check, QA checklist | Validated spec + handoff package |
| **6. Visual Design System** | Detect existing theme or generate tokens — colors, typography, spacing, motion | Design system document |
| **7. Preview** | Self-contained HTML preview of all views in all states | Reviewable .html file |
| **8. Component Implementation** | Framework-detected, design-system-applied, all-states-implemented code | Working project files |

## The Problem It Solves

Most UI skills help you make things **look good**. This skill ensures they **work right**.

Without functional design, you get:
- Happy-path-only UIs (no empty states, no error handling, no loading skeletons)
- Components with undiscovered states and broken transitions
- Forms where nobody specified when validation fires
- "Responsive" that just stacks columns instead of adapting functionality
- Error messages that say "Something went wrong" with no recovery path

With this skill, every component ships with its complete state machine, every view handles empty/loading/error, and the visual design serves the function — not the other way around.

## Installation

### Claude Code (recommended)

```bash
# Clone to your global skills directory
git clone https://github.com/MCKRUZ/functional-design.git ~/.claude/skills/functional-design
```

Or copy the files manually into `~/.claude/skills/functional-design/`.

### Other AI coding tools

Copy `SKILL.md` and the `references/` directory into your tool's skill/instruction directory. The skill uses standard markdown — no tool-specific syntax.

## Usage

```
/functional-design
```

The skill will walk you through all 8 phases. For large features, it runs incrementally (confirming each phase). For small features, it can combine phases.

### Modes

- **Full mode** (default): Phases 1-8, from discovery to working code
- **Spec-only mode**: Phases 1-5 only, produces a functional specification
- **Build from spec**: If a spec already exists, skip to Phase 6-8 (design + build)

### Framework Support

Phase 8 auto-detects your project's framework and styling approach:

| Framework | Styling | Detected From |
|-----------|---------|--------------|
| React | Tailwind CSS | `package.json` + `tailwind.config` |
| React | CSS Modules | `package.json` + `.module.css` files |
| Angular | SCSS | `package.json` + `angular.json` |
| Vue | Tailwind / CSS | `package.json` + config files |
| Svelte | Tailwind / CSS | `package.json` + config files |
| Next.js | Any | `next` in dependencies |
| Vanilla | CSS | No framework detected |

If your project has an existing design system (Tailwind config, CSS variables, component library), the skill adopts it and fills gaps — it never overwrites your established patterns.

## File Structure

```
functional-design/
├── SKILL.md                              # Core 8-phase workflow (552 lines)
├── README.md                             # This file
└── references/
    ├── INTERACTION-PATTERNS.md           # 50+ UI pattern decision trees (637 lines)
    ├── STATE-SPECIFICATIONS.md           # State machine templates (659 lines)
    ├── USER-FLOW-TEMPLATES.md            # Flow mapping frameworks (652 lines)
    ├── DATA-FLOW-PATTERNS.md             # Data architecture patterns (413 lines)
    ├── EMPTY-ERROR-LOADING.md            # Non-happy state specifications (367 lines)
    ├── VISUAL-DESIGN-SYSTEM.md           # Design tokens & component styling (583 lines)
    └── COMPONENT-GENERATION.md           # Framework-aware code templates (1,178 lines)
```

**Total: 5,041 lines** of UI/UX architecture knowledge + implementation templates.

Reference files are loaded on-demand during the relevant phase — they don't consume context until needed.

## What Makes This Different

### vs. Visual design skills (Bencium, Anthropic frontend-design, UI/UX Pro Max)
Those skills choose colors, fonts, and spacing. This skill figures out what the application needs to *do* first, then designs visuals that serve the function.

### vs. Design process skills (Owl-Listener, Lean UX)
Those skills run design workshops and produce design documents. This skill produces **working code** — state machines become components, edge cases become implemented states.

### vs. Component libraries (shadcn, Radix, Material)
Libraries give you building blocks. This skill gives you the **blueprint** — which blocks to use, in what states, with what data, handling what errors — and then assembles them.

### vs. Code generation (v0, Bolt, Lovable)
Those tools generate UI from a screenshot or description. This skill generates UI from a **complete functional specification** — so the result handles every state, not just the happy path.

## Design Principles

| Principle | Source |
|-----------|--------|
| Interrogation-first protocol | Adapted from Bencium's Design Thinking Protocol |
| State machine modeling for every component | Adapted from Owl-Listener's interaction-design plugin |
| 7 Stages of Action validation | Don Norman, "Design of Everyday Things" |
| Microinteraction specs (Trigger/Rules/Feedback/Loops) | Dan Saffer, "Microinteractions" |
| Nielsen's 10 Heuristics as audit framework | Jakob Nielsen |
| Non-happy states as first-class specs | Original — the #1 gap in existing skills |
| Decision memory / existing system detection | Adapted from Dammyjay93/interface-design |

## Compatibility

Works with any AI coding tool that supports skill/instruction files:
- Claude Code
- Cursor
- Windsurf
- Codex
- Claude.ai (Projects)
- Any tool that reads markdown instruction files

## License

MIT
