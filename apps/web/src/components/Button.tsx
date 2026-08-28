import type { ReactNode } from 'react';

interface ButtonProps {
  type: 'button' | 'submit';
  children: ReactNode;
  isPending?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
}

/** Fills its container; callers size it by sizing the element around it. */
export function Button({
  type,
  children,
  isPending = false,
  isDisabled = false,
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={isPending || isDisabled}
      onClick={onClick}
      // aria-busy rather than swapping the label for a spinner: replacing the
      // text would make a screen reader announce the button as a new control.
      aria-busy={isPending}
      className="min-h-11 w-full rounded-md bg-accent px-4 text-base font-semibold text-canvas transition duration-150 ease-settle hover:opacity-90 disabled:opacity-60 motion-safe:active:scale-[0.98] motion-safe:disabled:active:scale-100"
    >
      {children}
    </button>
  );
}
