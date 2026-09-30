'use client';

/**
 * Local UI primitives for the reviews module, matching the shared
 * component API in CONTRACTS.md so they can be swapped for the shell's
 * components/ui versions later without changing call sites.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

// ---------------------------------------------------------------- Button ---
type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-600 disabled:bg-brand-300',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-brand-600 disabled:text-slate-400',
  tertiary:
    'text-brand-700 hover:bg-brand-50 focus-visible:ring-brand-600 disabled:text-slate-400',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 disabled:bg-red-300',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Card ---
export function Card({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white shadow-card ${className}`}
    >
      {children}
    </section>
  );
}

// ----------------------------------------------------------------- Badge ---
type BadgeTone = 'neutral' | 'brand' | 'amber' | 'red' | 'green';

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  brand: 'bg-brand-50 text-brand-700',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  green: 'bg-green-100 text-green-800',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// ------------------------------------------------- Input/Textarea/Select ---
interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
  id?: string;
}

function FieldWrapper({
  label,
  error,
  hint,
  id,
  children,
}: FieldProps & { children: ReactNode }) {
  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

const fieldClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-500';

export function Input({
  label,
  error,
  hint,
  id,
  className = '',
  ...rest
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const inputId = id ?? rest.name;
  return (
    <FieldWrapper label={label} error={error} hint={hint} id={inputId}>
      <input
        id={inputId}
        className={`${fieldClass} ${error ? 'border-red-500' : ''} ${className}`}
        {...rest}
      />
    </FieldWrapper>
  );
}

export function Textarea({
  label,
  error,
  hint,
  id,
  className = '',
  ...rest
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const inputId = id ?? rest.name;
  return (
    <FieldWrapper label={label} error={error} hint={hint} id={inputId}>
      <textarea
        id={inputId}
        className={`${fieldClass} ${error ? 'border-red-500' : ''} ${className}`}
        {...rest}
      />
    </FieldWrapper>
  );
}

export function Select({
  label,
  error,
  hint,
  id,
  className = '',
  children,
  ...rest
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const inputId = id ?? rest.name;
  return (
    <FieldWrapper label={label} error={error} hint={hint} id={inputId}>
      <select
        id={inputId}
        className={`${fieldClass} ${error ? 'border-red-500' : ''} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}

// ----------------------------------------------------------------- Modal ---
export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div>{children}</div>
        {actions && (
          <div className="mt-6 flex justify-end gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ EmptyState ---
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <div
        aria-hidden="true"
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-500"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 12h6m-6 4h6M9 8h1m4-5H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-slate-600">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ------------------------------------------------------- Spinner/Skeleton ---
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-slate-200 ${className}`}
    />
  );
}

// ------------------------------------------------------------ FileUploader ---
export interface SelectedFile {
  file: File;
  error?: string;
}

export function FileUploader({
  accept,
  maxMB,
  multiple = false,
  onFiles,
  label,
}: {
  accept: string;
  maxMB: number;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [picked, setPicked] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const acceptList = accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const validate = useCallback(
    (files: File[]): { valid: File[]; error: string | null } => {
      const valid: File[] = [];
      for (const file of files) {
        const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
        const typeOk =
          acceptList.length === 0 ||
          acceptList.includes(ext) ||
          acceptList.includes(file.type.toLowerCase());
        if (!typeOk) {
          return {
            valid: [],
            error: `"${file.name}" is not an accepted file type. Accepted: ${accept}.`,
          };
        }
        if (file.size > maxMB * 1024 * 1024) {
          return {
            valid: [],
            error: `"${file.name}" is too large. Maximum size is ${maxMB} MB.`,
          };
        }
        valid.push(file);
      }
      return { valid, error: null };
    },
    [accept, acceptList, maxMB],
  );

  const handleFiles = useCallback(
    (list: FileList | File[]) => {
      const arr = Array.from(list);
      const files = multiple ? arr : arr.slice(0, 1);
      const { valid, error: err } = validate(files);
      setError(err);
      if (err) return;
      setPicked(valid);
      onFiles(valid);
    },
    [multiple, onFiles, validate],
  );

  const removeFile = (index: number) => {
    const next = picked.filter((_, i) => i !== index);
    setPicked(next);
    onFiles(next);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      {label && (
        <p className="mb-1 block text-sm font-medium text-slate-700">{label}</p>
      )}
      <div
        role="button"
        tabIndex={0}
        aria-label={label ?? 'Upload files'}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
          dragging ? 'border-brand-600 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400'
        }`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mb-2 text-slate-400">
          <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-sm font-medium text-slate-700">
          Drag and drop {multiple ? 'files' : 'a file'} here, or{' '}
          <span className="text-brand-700 underline">browse</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Accepted: {accept} · Max {maxMB} MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {picked.length > 0 && (
        <ul className="mt-3 space-y-2">
          {picked.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                aria-label={`Remove ${file.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- Toast ---
type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<{ toast: (message: string, tone?: ToastTone) => void }>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const toastStyles: Record<ToastTone, string> = {
  success: 'bg-green-700',
  error: 'bg-red-700',
  info: 'bg-slate-800',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-lg px-4 py-3 text-sm text-white shadow-lg ${toastStyles[t.tone]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
