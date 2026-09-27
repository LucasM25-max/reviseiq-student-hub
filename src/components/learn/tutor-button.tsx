/**
 * "I don't get this" — the AI tutor entry point, shipped disabled.
 *
 * Doc 01 §3 puts a tutor on every block and the roadmap puts it in Phase 10, which leaves
 * a choice: hide it until then, or show it and say so. Showing it is better. It tells a
 * student the option is coming, it keeps the layout honest about where it will live, and
 * a disabled control with a reason attached is not a dark pattern — a control that looks
 * live and does nothing would be.
 *
 * `disabled` rather than hidden also means the tab order, the spacing and the mobile
 * layout are all being exercised now, so Phase 10 turns it on rather than finding out
 * then that there is nowhere to put it.
 */
export function TutorButton() {
  return (
    <p className="text-sm">
      <button
        type="button"
        disabled
        aria-describedby="tutor-coming-soon"
        className="cursor-not-allowed rounded-md border border-dashed border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted-foreground)] opacity-70"
      >
        I don&rsquo;t get this
      </button>
      <span id="tutor-coming-soon" className="ml-2 text-xs text-[var(--muted-foreground)]">
        The AI tutor arrives in a later release.
      </span>
    </p>
  );
}
