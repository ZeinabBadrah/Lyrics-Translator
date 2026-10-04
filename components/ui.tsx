/**
 * Small shared presentation primitives.
 *
 * Deliberately not a component library: just enough to stop every page
 * reinventing the same Tailwind class strings, and to keep focus rings and
 * disabled states consistent without anyone having to remember them.
 */
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const controlBase =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm " +
  "placeholder:text-muted disabled:opacity-60 " +
  focusRing;

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:opacity-90",
  secondary: "border border-border bg-surface hover:bg-background",
  danger: "border border-danger text-danger hover:bg-danger/10",
  ghost: "text-muted hover:text-foreground",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${focusRing} ${className}`}
    />
  );
}

export function TextInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlBase} ${className}`} />;
}

export function TextArea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${controlBase} ${className}`} />;
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlBase} ${className}`} />;
}

/**
 * Labels a control and, when given, ties a hint and an error message to it via
 * aria-describedby so screen readers announce them with the field.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

type AlertTone = "success" | "error" | "info";

const alertTones: Record<AlertTone, string> = {
  success: "border-accent/40 bg-accent/10",
  error: "border-danger/40 bg-danger/10 text-danger",
  info: "border-border bg-surface",
};

export function Alert({
  tone = "info",
  children,
}: {
  tone?: AlertTone;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${alertTones[tone]}`}
    >
      {children}
    </div>
  );
}

export function PageHeading({
  title,
  description,
}: {
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && (
        <p className="text-sm/6 text-muted">{description}</p>
      )}
    </div>
  );
}
