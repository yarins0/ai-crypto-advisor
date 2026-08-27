/** Shown while the boot refresh decides whether there is a session to restore. */
export function FullPageSpinner() {
  return (
    <div role="status" aria-label="Loading" className="flex min-h-dvh items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
    </div>
  );
}
