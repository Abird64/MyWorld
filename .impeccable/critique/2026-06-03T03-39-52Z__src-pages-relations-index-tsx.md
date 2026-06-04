---
target: 联系人
total_score: 22
p0_count: 2
p1_count: 2
timestamp: 2026-06-03T03-39-52Z
slug: src-pages-relations-index-tsx
---
## UX Design Review: Relations Page ("联系人")

**Target files**: `shijie/src/pages/Relations/index.tsx` (882 lines), `shijie/src/components/relations/BirthdayBar.tsx` (77 lines)  
**Context**: Tauri 2 desktop app, "夜萤" (Night Firefly) dark theme, accent #4CAF76

---

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | **2** | Auto-save in detail panel has zero visual feedback — no spinner, no checkmark, no "saved" indicator, no error state |
| 2 | Match Between System and Real World | **3** | Contact card metaphor works well; birthday section maps to real calendar concepts |
| 3 | User Control and Freedom | **2** | Auto-save cannot be undone; delete has no confirmation; "完成" button merely closes with no agency |
| 4 | Consistency and Standards | **3** | Birthday day picker is month-aware in create form but always shows 31 days in detail panel — same feature, different behavior |
| 5 | Error Prevention | **2** | No phone/email validation; no duplicate detection; comma delimiter in nicknames causes silent data corruption; delete has no confirmation |
| 6 | Recognition Rather Than Recall | **3** | Group pills and contact method icons are recognizable; tag input behavior (Enter to add) is undiscoverable |
| 7 | Flexibility and Efficiency of Use | **2** | No keyboard shortcuts; no batch operations; no sort controls; no custom groups; search is name/nickname only |
| 8 | Aesthetic and Minimalist Design | **3** | Clean, restrained, consistent; cards are information-dense but scannable; birthday bar adds visual rhythm |
| 9 | Help Users Recognize, Diagnose, and Recover from Errors | **1** | Error handling is `String(e)` in a toast — could show `[object Object]` or Rust backtrace text; no inline validation; no retry; no undo for delete |
| 10 | Help and Documentation | **1** | No tooltips, no onboarding flow, no contextual help; tag input, lunar/solar toggle, and auto-save behavior are all undiscoverable |

**Total: 22/40 — Acceptable band** (functional but fragile)

---

### Anti-Patterns Verdict

**LLM assessment**: MEDIUM-LOW AI slop risk. The design avoids most classic AI tells: no gradient text, no glassmorphism, no excessive animation. The color palette is cohesive and restrained. The birthday bar is a genuinely human touch. However, the search-bar + filter-pills + card-grid layout is the single most common AI-generated pattern in 2026, and the inline-everything-edit with silent auto-save is a pattern AI consistently generates because it sounds smart but fails users in practice. The grid of cards with first-char avatar circles is a strong AI tell.

**Deterministic scan**: The `detect.mjs` CLI scan returned no findings (exit code 0, clean). This confirms the page avoids the most egregious mechanical anti-patterns (gradient text, side-stripe borders, tracked eyebrow text, etc.), which aligns with the LLM assessment. The slop risk here is structural (layout template, interaction model), not cosmetic.

**Visual overlays**: Not available — no live browser session was started for this desktop Tauri app.

---

### Overall Impression

The Relations page is a competent CRUD interface elevated by a single emotionally intelligent feature (the birthday bar). It works, but it doesn't yet feel designed. The biggest gap is trust: silent auto-save, no delete confirmation, and raw error strings make every edit feel like a gamble. The page succeeds at being useful but falls short of being confident.

**Single biggest opportunity**: Add a view/edit mode distinction to the detail panel. Let users *see* their contacts beautifully before they *edit* them anxiously.

---

### What's Working

1. **Birthday reminder bar is the soul of this page.** It transforms a database CRUD interface into something that cares about human relationships. The horizontal scroll with countdown badges ("3天后", "今天", age tag in warning color) creates genuine moments of delight.

2. **Group color system is restrained and distinctive.** Six earthy, muted tones (#C17F59 family, #D4A84B friend, #6B8BA4 classmate, #5A9468 colleague, #3478A0 teacher) create visual personality without competing for attention. The semi-transparent badge backgrounds (0.19 alpha) let the colors breathe.

3. **Auto-save architecture is directionally correct.** Debounced 800ms persistence in a detail panel is the right power-user pattern for a desktop app. The implementation is incomplete (no status indicator, no error handling), but the architectural instinct is sound.

---

### Priority Issues

#### P0 — Data loss risk / user trust

**[P0] Issue 1: Auto-save has no status indicator of any kind.**
- **Why it matters**: Users type edits, close the panel, and silently lose data. If auto-save fails, they never know. This destroys trust in the entire app.
- **Fix**: Add a status indicator (e.g., "已保存" with a checkmark that fades after 2s, a spinner during save, a red "保存失败" with retry button on error). Fire a save on panel close if there are pending changes.
- **Suggested command**: `/impeccable harden 联系人详情面板`

**[P0] Issue 2: Delete has no confirmation.**
- **Why it matters**: One misclick permanently deletes a contact with all their methods and history. No undo. A toast says "已删除" after it's too late.
- **Fix**: Add a confirmation dialog ("确定删除 [name] 的联系人信息?"), or soft-delete with undo toast.
- **Suggested command**: `/impeccable harden 联系人删除`

#### P1 — Data integrity / functional inconsistency

**[P1] Issue 3: Birthday day picker is inconsistent between create and edit.**
- **Why it matters**: Create form uses `daysInMonth()` to compute valid days (e.g., Feb shows 28/29 days). Detail panel always shows 31 days. Users can save invalid dates like Feb 30 through the edit panel, corrupting their data.
- **Fix**: Extract `daysInMonth` logic to a shared utility, use it in both places.
- **Suggested command**: `/impeccable polish 联系人生日选择器`

**[P1] Issue 4: Comma delimiter in nicknames silently corrupts data.**
- **Why it matters**: Nicknames containing commas get permanently split into multiple tags on save. No escape mechanism exists.
- **Fix**: Use a non-comma delimiter, add escape mechanism, or forbid commas in tags with inline validation.
- **Suggested command**: `/impeccable harden 联系人昵称输入`

#### P2 — Error experience

**[P2] Issue 5: All error messages are raw exception strings.**
- **Why it matters**: `showToast(String(e))` can render Rust backtraces, JSON strings, or `[object Object]` to the user. This is confusing and erodes trust.
- **Fix**: Map known error types to user-friendly messages. Show "操作失败，请重试" for unknown errors. Log the raw error to console.
- **Suggested command**: `/impeccable clarify 联系人错误提示`

#### P3 — UX friction / feature gaps

**[P3] Issue 6: Create form is a 7-section wall with no progressive disclosure.**
- **Why it matters**: "I just wanted to save a phone number" meets "fill out this census form." Optional fields (birthday, contact methods, notes) should be collapsed by default.
- **Fix**: Core create flow: name (required) + one contact method + optional group. Everything else behind "展开更多."
- **Suggested command**: `/impeccable distill 联系人创建表单`

**[P3] Issue 7: BirthdayBar colors contradict the page's group color system.**
- **Why it matters**: `nameColor()` generates vibrant colors (#ff6b6b, #51cf66, #339af0) that clash with the earthy group palette. Same contact has unrelated colors in card grid vs birthday bar.
- **Fix**: Use the contact's group color as the birthday bar avatar color, falling back to a single accent color.
- **Suggested command**: `/impeccable colorize 生日提醒条`

**[P3] Issue 8: The "完成" button in the detail panel is semantically broken.**
- **Why it matters**: It doesn't save (auto-save allegedly already happened). It just closes. Users who edit and immediately press "完成" (< 800ms) lose their edits but think they "completed" the save.
- **Fix**: Either (a) add view/edit mode toggle so "完成" means "done viewing," or (b) rename to "关闭" / "返回", or (c) flush pending save on close.
- **Suggested command**: `/impeccable clarify 联系人详情面板`

---

### Persona Red Flags

**Alex (Power User)**
- No keyboard shortcuts: can't press `/` to focus search, `n` to new contact, `Esc` to close panel
- No batch operations: can't select multiple contacts to delete, regroup, or export
- No sort controls: contacts appear in creation order only
- Search is name/nickname only — can't search by phone, email, or notes
- Cannot create custom groups: six groups are hardcoded
- Auto-save cannot be disabled or its debounce interval adjusted

**Jordan (First-Timer)**
- Empty state says "暂无联系人" with no CTA or guidance. FAB is the only way forward and is not universally understood
- Taps FAB, faces 7 input sections with no clear priority. The lunar calendar toggle and three-input birthday control are intimidating
- Tag input behavior is undiscoverable: placeholder says "输入后回车添加，可多个" but there's no visual affordance (no "+" badge, no chip preview on typing)
- "完成" button creates false confidence: Jordan edits a field, immediately presses it, and the edit is silently lost

**Sam (Accessibility)**
- Contact cards are `<div onClick>` — not focusable, not keyboard-activatable
- Search `<input>` has no `<label>` or `aria-label`
- FAB button has no `aria-label`, no text content for screen readers beyond the Plus icon
- Toast is a plain `<div>` with no `role="alert"` or `aria-live="polite"` — screen readers won't announce it
- BirthdayBar avatar colors likely fail WCAG AA contrast ratio against white text
- Overlay backdrop does not trap focus — pressing Tab inside the create modal cycles focus to elements behind the overlay

**Riley (Stress Tester)**
- Rapid edits can fire competing `saveEdit()` calls with no request sequencing or cancellation
- 300ms `initGuard` window: opening two contacts within 300ms can block auto-save for the second contact
- No validation on contact method values: "test@example.com, another@example.com" accepted as email
- Invalid dates savable through detail panel (Feb 30, leap-day edge case after year change)
- Empty name field shows stale avatar char from old name
- Rapid create/delete cycles could cause store state conflicts if promises resolve out of order

---

### Minor Observations

1. Toast position is unusual for desktop — top-center is mobile convention; bottom-center or bottom-right is more standard
2. No differentiated empty state for "no search results" vs "no contacts at all"
3. Contact cards show method icons and type labels but NOT the actual value — the most useful info is hidden one click away
4. Avatar in detail panel uses `editName` not `selectedContact.name` — clearing the name shows a stale first character
5. Birthday bar's "即将到来" label communicates urgency that doesn't match 25+ day countdowns
6. `newGroupName` stores the Chinese label, not the id — works now but blocks future custom groups
7. FAB button has fixed `bottom-[72px]` assuming a specific tab bar height
8. No loading state on FAB during create — fast double-tap can create duplicates
9. "添加联系方式" always defaults to `method_type: 'phone'` with no smart default based on existing methods
10. No visual hierarchy distinction between required and optional fields in the create form

---

### Questions to Consider

1. **What if the contact card IS the interface?** Right now, tapping a card opens a full form panel where every field is immediately editable. This treats the contact book like a database editor, not a relationship tool. What if tapping a card opened a "view" mode showing the contact's full profile with beautiful typography, and an explicit "编辑" button switched to edit mode?

2. **What if contacts were sorted by "last interaction" instead of creation date?** The people you most recently interacted with are the ones you're most likely to need again. A recency-based default sort would make the page feel alive rather than archival.

3. **What if the birthday bar were the hero, not a thin strip?** It's the most emotionally resonant feature on the page and gets the least visual weight. What if upcoming birthdays received a dedicated, visually rich section at the top with quick actions like "发送祝福"?
