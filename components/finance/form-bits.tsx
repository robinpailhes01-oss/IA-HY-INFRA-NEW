"use client";

import { cn } from "@/lib/utils";

// Petites pièces de formulaire propres à l'espace Finance (dialogues de
// dépense, de revenu, de réservation, de solde).

/**
 * Le montant, en grand : c'est la seule chose qu'on vient vraiment saisir.
 * Clavier numérique sur téléphone (inputMode="decimal"), € collé au chiffre,
 * Entrée valide le formulaire.
 */
export function AmountField({
  id,
  value,
  onChange,
  onSubmit,
  label = "Montant",
  hint,
  autoFocus = true,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  label?: string;
  hint?: React.ReactNode;
  autoFocus?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="vitre-inset group/amount flex cursor-text flex-col gap-1 rounded-[22px] px-5 py-4 transition-shadow focus-within:shadow-[inset_0_1px_2px_rgba(11,37,69,0.04),0_0_0_4px_rgba(47,127,224,0.12)]"
    >
      <span className="t-label text-ink-3">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          // L'autofocus ouvre le clavier numérique dès l'ouverture sur
          // téléphone : un geste de moins pour l'action la plus fréquente.
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="0"
          className="n-kpi-lead w-full min-w-0 bg-transparent text-foreground outline-none placeholder:text-ink-3/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-[22px] font-medium text-ink-3">€</span>
      </span>
      {hint && <span className="t-caption text-ink-3">{hint}</span>}
    </label>
  );
}

/**
 * Choix unique en pilules qui passent à la ligne — plus rapide qu'un menu
 * déroulant au pouce : toutes les options sont visibles, un seul geste.
 */
export function ChoicePills<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-11 items-center rounded-full border px-3.5 text-[13px] font-medium tracking-[-0.01em] outline-none transition-[background-color,color,box-shadow,border-color] duration-200 focus-visible:ring-4 focus-visible:ring-ocean/20 sm:h-9",
              active
                ? "border-transparent bg-navy text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_6px_14px_-8px_rgba(11,37,69,0.6)]"
                : "border-[rgba(11,37,69,0.1)] bg-white/70 text-ink-2 hover:bg-white hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Un champ libellé : le libellé au-dessus, en phrase, astérisque océan si requis. */
export function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid min-w-0 gap-1.5", className)}>
      <span className="t-label text-ink-2">
        {label}
        {required && <span className="text-ocean"> *</span>}
      </span>
      {children}
      {hint && <span className="t-caption text-ink-3">{hint}</span>}
    </label>
  );
}

/** Une section de formulaire long : un sur-titre, puis ses champs. */
export function FormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("grid min-w-0 gap-3", className)}>
      <legend className="t-eyebrow mb-3 text-ink-3">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Une ligne entière cliquable avec un interrupteur — « Acompte encaissé ».
 * Toute la ligne fait 44 px de haut : on ne vise pas une case de 16 px au
 * pouce.
 */
export function ToggleRow({
  checked,
  onChange,
  label,
  aside,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="group/toggle flex min-h-11 items-center gap-3 rounded-full pr-2 outline-none focus-visible:ring-4 focus-visible:ring-ocean/20"
      >
        <span
          aria-hidden
          className={cn(
            "relative inline-flex h-[24px] w-[42px] shrink-0 items-center rounded-full shadow-[inset_0_1px_2px_rgba(11,37,69,0.12)] transition-colors duration-200",
            checked ? "bg-success" : "bg-[rgba(11,37,69,0.14)]",
          )}
        >
          <span
            className={cn(
              "block size-[20px] rounded-full bg-white shadow-[0_1px_3px_rgba(11,37,69,0.3)] transition-transform duration-300 [transition-timing-function:var(--ease-ios)]",
              checked ? "translate-x-[20px]" : "translate-x-[2px]",
            )}
          />
        </span>
        <span className="text-[14px] font-medium text-foreground">{label}</span>
      </button>
      {aside && <span className="ml-auto text-right">{aside}</span>}
    </div>
  );
}

/** Un montant dans une ligne de formulaire : chiffres alignés, € à droite. */
export function EuroInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <span className={cn("relative block", className)}>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="n-inline h-11 w-full min-w-0 rounded-full border border-[rgba(11,37,69,0.1)] bg-white/75 pr-9 pl-4 text-[15px] text-foreground shadow-[inset_0_1px_2px_rgba(11,37,69,0.04)] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground focus-visible:border-ocean/50 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-ocean/12 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[13px] text-ink-3">
        €
      </span>
    </span>
  );
}
