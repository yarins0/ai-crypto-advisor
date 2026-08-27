interface TextFieldProps {
  id: string;
  label: string;
  type: 'text' | 'email' | 'password';
  value: string;
  autoComplete: string;
  error?: string;
  onChange: (value: string) => void;
}

export function TextField({
  id,
  label,
  type,
  value,
  autoComplete,
  error,
  onChange,
}: TextFieldProps) {
  const errorId = `${id}-error`;
  const borderClass = error ? 'border-red-500' : 'border-slate-700';

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-300">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : errorId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        // min-h-11 keeps the tap target at 44px. text-base is load-bearing on
        // mobile: iOS Safari zooms into any input below 16px on focus.
        className={`min-h-11 w-full rounded-lg border ${borderClass} bg-surface-raised px-3 text-base text-slate-100 outline-none placeholder:text-slate-500 focus:border-slate-400`}
      />
      {error === undefined ? null : (
        <p id={errorId} className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
