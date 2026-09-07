---
name: figma-intake
description: Load when a Figma MCP server is available and you need to capture a design before access expires. One-pass capture into the design brief (metadata, context, variables, screenshots); never re-query Figma during implementation; fall back to design-from-screenshot if MCP access fails.
license: MIT
metadata:
  sources:
    - https://www.figma.com/developers/api (Figma API concepts — file keys, nodes)
  version: "1.0.0"
compatibility: Any Figma MCP server; pairs with design-transfer brief contract
---

# Figma Intake — One-Pass MCP Capture

> Treat Figma MCP access as ephemeral. Capture everything needed into the design brief in one pass, then disconnect mentally — implement from the brief only.

## Preferences

- Fill [design-brief-template.md](../design-transfer/references/design-brief-template.md) during capture
- Use [token-extraction.md](../design-transfer/references/token-extraction.md) so variables and styles are complete
- Capture order: **metadata → design context → variables → screenshots of key states**
- Save to the brief **immediately** after each successful tool result
- No Figma re-queries during implementation
- On auth/quota/tool failure → switch to `design-from-screenshot` with whatever images you already have
- Vendor-neutral wording: any Figma MCP server; map to that server’s tool names locally

## Core Principles

- **One pass:** assume the next call may fail.
- **Brief over session:** durable files beat chat memory and live nodes.
- **Goals, not vendor lock-in:** describe what to obtain; adapt tool names to the connected MCP.
- **Graceful degradation:** partial capture + screenshots still beats a blocked session.

---

## 1) Before You Call Tools

1. Confirm a Figma MCP server is connected and authenticated.
2. Collect the file URL / file key and target node ids (frames, components).
3. Create the brief file and an `assets/` folder in the project (or agreed path).
4. List required states: default, empty, error, hover/focus if critical, each breakpoint frame.

---

## 2) One-Pass Capture Order

Execute in order. After each step, write results into the brief before continuing.

### 1. Metadata

- File key, file name, node ids, page name, capture date.
- Record MCP server identity only as a note (not a hard dependency).

### 2. Design context

- Obtain structural/context output for the target node(s): hierarchy, layout hints, component names, annotations.
- Translate into brief **layout structure** and **component inventory**.
- Prefer the primary frame(s) for the screen — avoid crawling the entire file.

### 3. Variables / tokens

- Pull local variables and styles (color, spacing, radius, type) when the server exposes them.
- Map into the brief token tables using role names.
- If variables are missing, extract from context/screenshots and mark `~`.

### 4. Screenshots of key states

- Export or screenshot each required frame/state to `assets/`.
- Name files clearly (`home-desktop.png`, `home-mobile.png`, `checkout-error.png`).
- List every file in the brief reference-images table.

**Stop capture when** the brief has metadata, structure, tokens (exact or `~`), and reference images for claimed breakpoints/states.

---

## 3) Save-to-Brief-Immediately Rule

| Bad | Good |
|-----|------|
| Keep results only in chat | Append to `design-brief.md` after each tool success |
| “I’ll remember the hex” | Write `--color-accent: #…` into the token table now |
| Screenshot later | Write image files before the next MCP call |

If the session dies mid-pass, you still have a partial brief + assets instead of nothing.

---

## 4) During Implementation

- Load `design-transfer` and work from the brief + `assets/` only.
- **Do not** call Figma MCP to “double-check” spacing or colors while coding.
- If a gap appears, either (a) update the brief from saved assets via `design-from-screenshot`, or (b) schedule a new intake pass — do not interleave live MCP with apply.

---

## 5) Fallback When Access Fails

Triggers: auth expired, rate limit, tool error, missing permissions, empty responses.

1. Keep any partial brief and assets already written.
2. Load `design-from-screenshot`.
3. Use saved screenshots/exports as the raster source; mark tokens `~` as needed.
4. Continue with `design-transfer` once the brief is complete enough to implement.

Never block the whole transfer on restoring MCP access.

---

## 6) Vendor-Neutral Tool Mapping

MCP servers differ. Map by **goal**, not by one vendor’s function name:

| Goal | Typical capability |
|------|--------------------|
| Metadata | File/node identity, names |
| Design context | Structured layout/code hints for a node |
| Variables | Color/spacing/type variables or styles |
| Screenshots | Image export or frame screenshot |

Use whichever tools the connected server documents. Do not invent calls for tools that are not listed.

---

## 7) Done Checklist

- [ ] Brief metadata filled (file key, nodes, date)
- [ ] Layout structure + component inventory written
- [ ] Tokens table filled (variables preferred; else `~`)
- [ ] Key-state images on disk and listed
- [ ] Constraints noted (stack, a11y, out of scope)
- [ ] Ready for `design-transfer` without further MCP calls
