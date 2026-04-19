# Semantic Parser — Known Issues & Edge Cases

Documented during Paso A3.1 analysis of `server/services/semantic-parser.js`.
These are NOT bugs to fix now — they document current behavior for future work.

---

## 1. Header swallows finding keywords

- **Lines:** 174 vs 218
- **Current behavior:** `## ⚠️ ADVERTENCIA: Root login habilitado` is detected as `text_block` (header priority at position 5) instead of `finding` (position 8). The finding keyword and emoji are present but the header regex matches first.
- **Expected behavior:** Lines with `##` + severity keywords should produce a `finding` block, or at minimum a `text_block` with severity metadata.
- **Priority:** Media
- **Note:** Documentado en Paso A3.1. Resolucion planificada post-RRL.

---

## 2. summary_card status evaluates entire response, not just synthesis section

- **Lines:** 166
- **Current behavior:** `detectOverallStatus(text)` receives the full AI response text, not just the lines inside the `## Sintesis` section. If the response mentions "critico" anywhere (e.g., in a finding about a non-critical server), the summary card gets `status: 'critical'` even if the synthesis says "todo en orden".
- **Expected behavior:** `detectOverallStatus` should evaluate only the highlights/content within the synthesis section.
- **Priority:** Media
- **Note:** Documentado en Paso A3.1. Resolucion planificada post-RRL.

---

## 3. recommendation.priority always hardcoded to 'medium'

- **Lines:** 255
- **Current behavior:** All recommendation blocks get `priority: 'medium'` regardless of context. A line like "CRITICO: se recomienda reiniciar inmediatamente" still gets medium priority.
- **Expected behavior:** Priority should be inferred from severity keywords in the recommendation text (critical/high/medium/low).
- **Priority:** Baja
- **Note:** Documentado en Paso A3.1. Resolucion planificada post-RRL.

---

## 4. extractOptions regex too permissive

- **Lines:** 364
- **Current behavior:** The regex `^[-*\d.)\]]\s*(.+)` matches any line starting with `-`, `*`, digit, `)`, or `]`. After a question, a descriptive line like `- El servidor esta bien` would be captured as an option even if it's not meant to be one.
- **Expected behavior:** Options should only be extracted from lines that follow a question and look like discrete choices, not descriptive bullet points.
- **Priority:** Baja
- **Note:** Documentado en Paso A3.1. Resolucion planificada post-RRL.

---

## 5. Malformed table falls through silently

- **Lines:** 127-145
- **Current behavior:** If `parseTable()` returns `null` (empty headers or rows), the parser does NOT advance `i` — the same lines get re-evaluated by subsequent heuristics. A malformed table (e.g., `| only header |` with no data rows) becomes one or more `text_block`s instead of failing explicitly.
- **Expected behavior:** Acceptable as-is (graceful degradation). But the double-evaluation of lines could produce unexpected block sequences.
- **Priority:** Baja
- **Note:** Documentado en Paso A3.1. Resolucion planificada post-RRL.

---

## 6. ACTION markers can duplicate recommendations

- **Lines:** 246 + 301-315
- **Current behavior:** If Claude's response contains both an inline recommendation and an ACTION marker with the same text (e.g., `Se recomienda actualizar OpenSSL. [ACTION: Actualizar OpenSSL]`), two `recommendation` blocks are created — one from the inline pattern match and one from the ACTION pre-pass.
- **Expected behavior:** ACTION markers should either replace inline recommendations or be deduplicated.
- **Priority:** Baja
- **Note:** Documentado en Paso A3.1. Resolucion planificada post-RRL.

---

## 7. Diagnostic report claims `data` wrapper and `metadata` field — neither exists

- **Lines:** All block construction (66-315)
- **Current behavior:** All block fields are at the root level (`{ id, type, title, tags, severity, actions, ...typeSpecificFields }`). There is no `data: { ... }` sub-object wrapping type-specific fields. There is no `metadata: { source, timestamp }` field.
- **Expected behavior:** The diagnostic report (`docs/rrl-diagnostic-report.md` section 1) describes `data: { ... }` and `metadata: { source: 'parsed', timestamp }` but the actual code does not produce these. The diagnostic should be corrected.
- **Priority:** Baja (documentation-only)
- **Note:** Documentado en Paso A3.1. Resolucion planificada post-RRL.

---

## 8. question_prompt skips lines consumed as options

- **Lines:** 213
- **Current behavior:** After creating a `question_prompt`, the parser advances `i += 1 + options.length`. If `extractOptions` consumed lines that would also match another pattern (e.g., a list item that contains a finding keyword), those lines are silently skipped.
- **Expected behavior:** Acceptable as-is — options should belong to the question. But edge cases where option text contains severity keywords could mask a finding.
- **Priority:** Baja
- **Note:** Documentado en Paso A3.1. Resolucion planificada post-RRL.

---

## 10. Percentage metrics never extracted — regex \\b after % bug

- **Lines:** 383
- **Current behavior:** The first regex pattern in `extractMetricsFromLine` ends with `\b` after the unit group `(%%|%|GB|...)`. Since `%` is a non-word character, `\b` requires the next character to be a word character — but `%` at end-of-string or followed by space/pipe means `\b` never matches. Result: "CPU: 45%" returns 0 metrics. Only non-`%` units like GB, MB, cores work.
- **Expected behavior:** Percentage metrics like "CPU: 45%", "RAM: 92%" should be extracted. Replace `\b` with a lookahead or remove it for non-word units.
- **Priority:** Alta — percentage metrics are the most common server metric format and none of them work.
- **Note:** Discovered during A3.3 test implementation. Resolucion planificada post-RRL.

---

## 11. detectSeverity keyword check shadows emoji check

- **Lines:** 407-413
- **Current behavior:** `detectSeverity` checks `SEVERITY_MAP` keywords (lines 407-409) BEFORE checking emojis (lines 410-413). If text contains both a keyword and a higher-severity emoji (e.g., "❌ Something failed"), the keyword wins. "failed" → 'high' shadows ❌ → 'critical'.
- **Expected behavior:** Emojis should take priority over keywords, or the highest severity between keywords and emojis should be returned.
- **Priority:** Media
- **Note:** Discovered during A3.3 test implementation. Resolucion planificada post-RRL.

---

## 9. Metric detection requires both METRIC_LABELS and a digit

- **Lines:** 265
- **Current behavior:** A line must match `METRIC_LABELS` (cpu, ram, disco, etc.) AND contain a digit to enter metric detection. A line like "CPU usage is high" (no digit) won't trigger it. A line like "Valor: 42%" (has digit but no metric label) won't trigger it either.
- **Expected behavior:** Current behavior is reasonable as a conservative filter. However, metrics embedded in tables or code blocks are handled by their respective detectors first (higher priority), so this only catches standalone metric lines.
- **Priority:** Baja
- **Note:** Documentado en Paso A3.1. Resolucion planificada post-RRL.

---

## 12. question_prompt endsWith fails with markdown bold

- **Lines:** 197
- **Current behavior:** `endsWith('?')` fails when question ends in "**?**" because the string literally ends in "**", not "?". question_prompt is never generated for bold-formatted questions.
- **Expected behavior:** Strip markdown bold before checking endsWith, or regex-match `/\?\s*\*?\*?\s*$/`.
- **Priority:** Alta — detected in smoke test 2026-04-19
- **Note:** Fix prepared for sprint B0.

---

## 13. extractOptions breaks on blank line between question and options

- **Lines:** ~365-375
- **Current behavior:** extractOptions stops iterating when it hits a blank line, so questions formatted with "Responde:\n\n- SI..." (natural style) fail to find options. Defaults are used.
- **Expected behavior:** Skip blank lines and "prompt lines" (Responde:, Options:, etc.) before starting to collect options.
- **Priority:** Alta — detected in smoke test 2026-04-19
- **Note:** Fix prepared for sprint B0. This and bug #12 often occur together.
