"use client";

import type { ReactNode } from "react";

// Form controls of the public registration form (spec 031): 16 px text,
// tap targets of at least 44 px, errors right at the field.

export function fieldId(name: string): string {
  return `f-${name.replace(/\./g, "-")}`;
}

const INPUT =
  "min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base aria-invalid:border-status-late";

function ErrorText({ name, message }: { name: string; message?: string }) {
  return message ? (
    <p id={`${fieldId(name)}-error`} role="alert" className="text-sm font-medium text-status-late">
      {message}
    </p>
  ) : null;
}

function Label({ htmlFor, required, children }: { htmlFor?: string; required?: boolean; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="font-medium">
      {children}
      {required ? (
        <span className="text-status-late" aria-hidden>
          {" "}
          *
        </span>
      ) : null}
    </label>
  );
}

function Hint({ id, children }: { id: string; children?: ReactNode }) {
  return children ? (
    <p id={id} className="text-sm text-muted">
      {children}
    </p>
  ) : null;
}

function describedBy(name: string, hint: boolean, error: boolean): string | undefined {
  const ids = [hint ? `${fieldId(name)}-hint` : null, error ? `${fieldId(name)}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id ? `${id}-title` : undefined}
      className="flex flex-col gap-5 rounded-md border border-line bg-surface p-4 desk:p-6"
    >
      <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

type TextProps = {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  type?: "text" | "email" | "tel" | "url";
  autoComplete?: string;
  maxLength?: number;
  placeholder?: string;
};

export function TextField({
  name,
  label,
  value,
  onChange,
  error,
  hint,
  required,
  type = "text",
  autoComplete,
  maxLength,
  placeholder,
}: TextProps) {
  const id = fieldId(name);
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Hint id={`${id}-hint`}>{hint}</Hint>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete ?? "off"}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={type === "tel" ? "tel" : type === "email" ? "email" : undefined}
        aria-required={required || undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(name, Boolean(hint), Boolean(error))}
        className={INPUT}
      />
      <ErrorText name={name} message={error} />
    </div>
  );
}

export function TextArea({
  name,
  label,
  value,
  onChange,
  error,
  hint,
  required,
  maxLength,
  footer,
}: Omit<TextProps, "type" | "autoComplete" | "placeholder"> & { footer?: ReactNode }) {
  const id = fieldId(name);
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <Hint id={`${id}-hint`}>{hint}</Hint>
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        rows={4}
        aria-required={required || undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(name, Boolean(hint), Boolean(error))}
        className={`${INPUT} min-h-28`}
      />
      {footer}
      <ErrorText name={name} message={error} />
    </div>
  );
}

type Option<T extends string> = { value: T; label: string };

/** Radio buttons in a fieldset; each row is a 44 px tap target. */
export function Choice<T extends string>({
  name,
  label,
  options,
  value,
  onChange,
  error,
  hint,
  required,
}: {
  name: string;
  label: string;
  options: readonly Option<T>[];
  value: T | "";
  onChange: (value: T) => void;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
}) {
  const id = fieldId(name);
  return (
    <fieldset
      id={id}
      tabIndex={-1}
      aria-invalid={Boolean(error)}
      aria-describedby={describedBy(name, Boolean(hint), Boolean(error))}
      className="flex flex-col gap-1"
    >
      <legend className="mb-1 font-medium">
        {label}
        {required ? (
          <span className="text-status-late" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </legend>
      <Hint id={`${id}-hint`}>{hint}</Hint>
      <div className="flex flex-col">
        {options.map((option) => (
          <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 py-1">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="size-5 shrink-0 accent-primary"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <ErrorText name={name} message={error} />
    </fieldset>
  );
}

export function YesNo({
  name,
  label,
  value,
  onChange,
  error,
  hint,
}: {
  name: string;
  label: string;
  value: "" | "yes" | "no";
  onChange: (value: "yes" | "no") => void;
  error?: string;
  hint?: ReactNode;
}) {
  return (
    <Choice
      name={name}
      label={label}
      options={[
        { value: "yes", label: "Ja" },
        { value: "no", label: "Nein" },
      ]}
      value={value}
      onChange={onChange}
      error={error}
      hint={hint}
      required
    />
  );
}

/** Checkboxes with a limit; the others are disabled once it is reached. */
export function MultiChoice<T extends string>({
  name,
  label,
  options,
  values,
  onChange,
  max,
  error,
  hint,
  required,
}: {
  name: string;
  label: string;
  options: readonly T[];
  values: readonly T[];
  onChange: (values: T[]) => void;
  max: number;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
}) {
  const id = fieldId(name);
  const full = values.length >= max;
  return (
    <fieldset
      id={id}
      tabIndex={-1}
      aria-invalid={Boolean(error)}
      aria-describedby={describedBy(name, Boolean(hint), Boolean(error))}
      className="flex flex-col gap-1"
    >
      <legend className="mb-1 font-medium">
        {label}
        {required ? (
          <span className="text-status-late" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </legend>
      <Hint id={`${id}-hint`}>{hint}</Hint>
      <div className="grid grid-cols-1 desk:grid-cols-2 desk:gap-x-4">
        {options.map((option) => {
          const checked = values.includes(option);
          return (
            <label
              key={option}
              className={`flex min-h-11 items-center gap-3 py-1 ${!checked && full ? "text-muted" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                name={name}
                value={option}
                checked={checked}
                disabled={!checked && full}
                onChange={() => onChange(checked ? values.filter((value) => value !== option) : [...values, option])}
                className="size-5 shrink-0 accent-primary"
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
      <ErrorText name={name} message={error} />
    </fieldset>
  );
}

export function Confirm({
  name,
  checked,
  onChange,
  error,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  children: ReactNode;
}) {
  const id = fieldId(name);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
        <input
          id={id}
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span>
          {children}
          <span className="text-status-late" aria-hidden>
            {" "}
            *
          </span>
        </span>
      </label>
      <ErrorText name={name} message={error} />
    </div>
  );
}

export function NumberField({
  name,
  label,
  value,
  onChange,
  error,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const id = fieldId(name);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => event.target.select()}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${INPUT} w-24`}
      />
      <ErrorText name={name} message={error} />
    </div>
  );
}
