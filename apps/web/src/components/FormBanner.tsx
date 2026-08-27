interface FormBannerProps {
  message: string;
}

/** Form-level failure. `role="alert"` so it is announced when it appears. */
export function FormBanner({ message }: FormBannerProps) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200"
    >
      {message}
    </p>
  );
}
