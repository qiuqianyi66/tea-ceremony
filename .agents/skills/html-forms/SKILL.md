---
name: html-forms
description: Use for HTML forms, input types, native validation, autocomplete, labels/fieldsets, FormData, and submit patterns. Load when building or reviewing forms, auth fields, checkout, or filters.
license: MIT
metadata:
  sources:
    - https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form (MDN form)
    - https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete (MDN autocomplete)
    - https://html.spec.whatwg.org/multipage/forms.html (HTML Living Standard — Forms)
  version: "1.0.0"
compatibility: Modern evergreen browsers (Baseline 2024)
---

# HTML Forms — Inputs & Validation

> Prefer native controls and constraint validation. Label every field. Let the browser help before adding custom JS.

## Preferences

- Explicit `<label for>` (or wrap) for every control — never placeholder-as-label
- Correct `type` (`email`, `tel`, `url`, `number`, `date`, `search`, …) over plain `text`
- `autocomplete` tokens on auth, address, and payment fields
- Native `required`, `min`/`max`, `pattern`, `minlength`/`maxlength` before custom validators
- `FormData` (or `new FormData(form)`) for reading values — avoid hand-rolling field maps
- `<fieldset>` + `<legend>` for related groups (radios, address blocks)

## Core Principles

- **Accessible by default:** visible labels, associated errors, keyboard-friendly controls.
- **Native first:** constraint validation API before reinventing toast-only errors.
- **Submit is a form job:** use `<button type="submit">`; preventDefault only when handling async.
- **Security basics:** `autocomplete` for UX; never put secrets in hidden fields expecting privacy.

---

## 1) Form Skeleton

```html
<form id="login" action="/api/login" method="post" novalidate>
  <div>
    <label for="email">Email</label>
    <input
      id="email"
      name="email"
      type="email"
      autocomplete="username"
      required
      inputmode="email"
      aria-describedby="email-hint"
    >
    <p id="email-hint">Work email preferred</p>
  </div>

  <div>
    <label for="password">Password</label>
    <input
      id="password"
      name="password"
      type="password"
      autocomplete="current-password"
      required
      minlength="8"
    >
  </div>

  <button type="submit">Sign in</button>
</form>
```

- Every control that sends data needs a stable `name`.
- Use `novalidate` only when you fully replace native UI with custom error rendering — still call `checkValidity()`.
- Prefer `inputmode` to hint mobile keyboards without changing value semantics.

---

## 2) Input Types & Constraints

| Type | Use for |
|------|---------|
| `email` | Email addresses |
| `tel` | Phone numbers |
| `url` | Absolute URLs |
| `number` | Numeric quantities (`min`/`max`/`step`) |
| `date` / `datetime-local` | Calendar values |
| `search` | Search boxes |
| `checkbox` / `radio` | Booleans / exclusive choices |
| `file` | Uploads (`accept`, `multiple`) |

```html
<label for="qty">Quantity</label>
<input id="qty" name="qty" type="number" min="1" max="99" step="1" required value="1">

<label for="sku">SKU</label>
<input id="sku" name="sku" type="text" pattern="[A-Z]{3}-\d{4}" title="Format: ABC-1234" required>
```

- `pattern` is for simple formats; show expected format in `title` or adjacent hint.
- Do not use `type="number"` for IDs, ZIP codes, or credit cards — leading zeros and formatting break.

---

## 3) Labels, Fieldsets, Choices

```html
<fieldset>
  <legend>Shipping speed</legend>
  <label><input type="radio" name="speed" value="standard" checked> Standard</label>
  <label><input type="radio" name="speed" value="express"> Express</label>
</fieldset>

<label for="country">Country</label>
<select id="country" name="country" autocomplete="country" required>
  <option value="" disabled selected>Select…</option>
  <option value="UA">Ukraine</option>
  <option value="PL">Poland</option>
</select>
```

- Radios sharing a `name` belong in one fieldset with a legend.
- First empty `<option>` for required selects should be `disabled` so users must choose.
- Prefer wrapping short labels; use `for`/`id` when layout separates label and control.

---

## 4) Autocomplete

```html
<input name="given-name" autocomplete="given-name" required>
<input name="family-name" autocomplete="family-name" required>
<input name="address-line1" autocomplete="address-line1" required>
<input name="postal-code" autocomplete="postal-code" required>
<input name="cc-number" autocomplete="cc-number" inputmode="numeric">
```

- Use standard tokens (`username`, `current-password`, `new-password`, `one-time-code`, address/payment tokens).
- `autocomplete="off"` is unreliable for login — use correct tokens instead.
- For signup password: `autocomplete="new-password"`.

---

## 5) FormData & Submit

```js
const form = document.querySelector('#login')

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!form.reportValidity()) return

  const data = new FormData(form)
  const payload = Object.fromEntries(data.entries())

  const response = await fetch(form.action, {
    method: form.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Login failed')
})
```

- `FormData` includes successful controls only (checked radios/checkboxes, named fields).
- Use `form.elements.namedItem('email')` for single-field access.
- Disable the submit button while pending; re-enable on settle.
- For multipart uploads, send `FormData` directly — do not set `Content-Type` manually.

---

## 6) Final Self-Check

- Every control has a visible associated label.
- Types, constraints, and autocomplete match the data.
- Related radios/checkboxes are grouped with fieldset/legend.
- Submit uses native validation (`reportValidity`) or equivalent custom messaging.
- Values read via FormData / form elements — not ad-hoc DOM scraping.
- See `html-a11y` for error announcement and focus after failed validation.
