---
name: design
description: The design session in Paper (Opus 5.5 high). Three directions of the defining screen, then the component sheet that becomes the design system; or one screen in the existing system; or Mobbin references. Use only when the owner types /design.
disable-model-invocation: true
---

# Design

You design in **Paper** with the owner. Load Paper's guide first (`get_guide({ topic: "paper-mcp-instructions" })`). Call `get_font_family_info` before your first type styling.

**Modes:**
- `/design directions <notes>`: the full flow below.
- `/design <screen> [notes]`: one screen in the existing system.
- `/design refs <what>`: Mobbin references only.

**Inputs:** the Linear spec (product, flows, real copy and data) and the owner's notes. With an external designer's Figma or Paper file, their file is the design. Skip step 1. Check their component sheet: create it if it's missing, fill gaps in their style if it's incomplete.

## 1. Directions

Draw three directions of the screen that defines the app, each at **1440px and 390px**: six artboards.
- The directions differ in structure, density and type, not just colour.
- Use real copy and realistic data from the spec, never lorem ipsum.
- Use **Mobbin only when the owner asks** (see below).

## 2. Pick and extend

1. The owner picks a direction, and you edit it together.
2. Extend the winner to the other key screens.

## 3. The component sheet (the design system)

One Paper page holds:
- **Tokens:**
  - colour, type, spacing and radius, using shadcn's semantic names (`--color-background`, `--color-primary`, …);
  - paired light/dark values if the app has dark mode (decided per app);
  - shadow and motion as notes.
- **Every shadcn/ui component.** AI elements are included only for apps with AI interfaces.
  - Give full variants and states to buttons, form controls, cards, tables, tabs, dialogs and sheets, menus and popovers, toasts and alerts, sidebar and navigation, badges, avatars, pagination and skeletons.
  - Draw simple components once, in one compact block.
- **App patterns**, drawn once:
  - page header;
  - form layout (label, field, help, error, spacing, save);
  - data table with search, filters, sorting and pagination;
  - empty, loading and error states;
  - stat card;
  - confirmation dialog;
  - others the app needs.
- **Mobile versions only where things differ:** dialog → drawer, sidebar → sheet, table → cards or scroll, navigation.
- **Dark mode:** draw the key components dark if the app has it, not a second sheet.

**Sizes:** a design's own consistency decides.
- **Our designs:** spacing, sizes and font sizes use even pixels. 4px is the usual step, and half-steps (14, 18, 22) are welcome. Odd values are slips.
- **Always as drawn:** radii, line height, letter spacing, hairlines and repeated control heights.
- **An external designer's consistent system** is kept as it is. Only clear outliers against their own usage get fixed.

## 4. Close

Write a **Design** section into the Linear spec:
- the source (Paper file and page, or Figma URL);
- the key frames, by artboard name;
- the component sheet page;
- the themes;
- the direction rules (at most 10 lines; these become `web-ui.md`'s Direction section);
- shadow and motion notes;
- open questions.

**On a fresh app** (no `docs/internals/web-ui.md`), the Design section names **the UI foundation as the first ticket** (Opus high). It holds:
1. every component on the sheet, restyled through tokens and variants;
2. the app patterns, as components;
3. the app shell and the data hooks;
4. `docs/internals/web-ui.md`: the Direction (at most 10 lines), the variant rules, the sizing rule, and the reference screen's name;
5. shadcn lint as errors;
6. the dev-only `/_system` preview page;
7. one reference screen;
8. one contrast check. Every snap is listed once in the PR.

End by naming the next command, usually `/to-tickets <spec>`. Each screen ticket names its frame.

## Mobbin (only when the owner asks)

- Search with the Mobbin MCP yourself, because you need to see the images.
- Return a short list in chat. For each:
  - the product;
  - the screen or flow;
  - the canonical Mobbin URL (image URLs expire);
  - what to take from it: the pattern, not the look.
- Then add 2–3 lines on the recurring pattern.
- Make a Paper references page only on request. Save nothing unless the owner says so.

## Never

- Files in the repo, or exported images.
- Mobbin unprompted.
- Taste the owner didn't ask for.
- Changing a real drawn size by judgment. Any change beyond fixing a slip is the owner's call.
