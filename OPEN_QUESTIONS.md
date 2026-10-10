# UI Overlay Redesign — Open Questions

Scoped to the `ui-overlay-redesign` project. Questions needing Newton's decision before or during the build.

- [ ] **Electron vs Tauri for the desktop overlay shell.** The new UI needs a transparent, always-on-top, click-through-except-toolbars desktop window. Today's real desktop shell (`apps/khameleon-shell`, built for Cross-App Control) is Electron. Electron supports transparent/click-through windows natively (`transparent: true`, `setIgnoreMouseEvents`). Tauri would mean a second native-shell stack alongside the existing one. Leaning toward reusing the existing Electron shell unless there's a reason not to — flagging as open per the brief's own instruction, not deciding unilaterally.
- [ ] **Automatic task detection (planned build, not yet scoped).** Newton wants Khameleon to recognise real work tasks on screen (e.g. a reconciliation moving numbers from Excel into a web app) and offer to capture them as skills, not only capture when asked. Explicitly kept in mind on 2026-10-10 during gap review Q3. This is a large, separate capability (screen observation + pattern recognition), excluded from the redesign's sample pass by the original brief. Needs its own plan once the redesign is settled. "Capture when asked" (Capture & Extract toolbar) comes first.
- [x] **Palette conflict** — resolved 2026-10-10: both palettes (soft blue/white and dark teal) ship as a user choice. See `DECISIONS.md`.
- [ ] **Go / no-go on Phase 3 implementation** — gap review is done (`docs/gap-review.md`); Newton decides whether to implement.
