import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

interface DialogProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

/**
 * Wrapper over the native dialog element. showModal is what supplies the focus
 * trap, the Escape handler, the backdrop and the inerting of everything behind
 * it, so none of that is reimplemented here — the alternative is a focus-trap
 * dependency and a keydown listener that has to be right on every browser.
 */
export function Dialog({ isOpen, title, children, onClose }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Every group renders its own dialog, so a fixed id would be duplicated.
  const titleId = useId();

  // Driven by an effect rather than rendered conditionally: showModal is what
  // puts the element into the top layer, and a dialog that is merely mounted
  // has none of the behaviour above.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      // Fires for Escape and for close() alike, so the parent's open state
      // cannot drift from the element's.
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-raised backdrop:bg-canvas/70 motion-safe:animate-rise-in"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id={titleId} className="text-base font-semibold text-ink">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
        >
          ✕
        </button>
      </header>
      <div className="max-h-[60vh] overflow-y-auto px-5 py-5">{children}</div>
    </dialog>
  );
}
