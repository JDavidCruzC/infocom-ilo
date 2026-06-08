import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

/**
 * Time input optimizado para la grilla:
 * - Edición local; commit solo onBlur o Enter (sin lag).
 * - Click sobre el input abre el picker nativo (mostrar reloj).
 * - Muestra HH:MM en formato 24h legible.
 */
export function TimeCellInput({ value, onCommit, disabled, label }: Props) {
  const [local, setLocal] = useState(value || "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== ref.current) setLocal(value || "");
  }, [value]);

  const commit = () => {
    const v = local || "";
    if (v !== (value || "")) onCommit(v);
  };

  return (
    <input
      ref={ref}
      type="time"
      value={local}
      aria-label={label}
      disabled={disabled}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
      onClick={() => {
        const el = ref.current as any;
        if (el && typeof el.showPicker === "function") {
          try { el.showPicker(); } catch { /* ignored */ }
        }
      }}
      className="h-6 w-full text-[11px] px-1 text-center rounded border border-primary/20 bg-background text-foreground font-mono [color-scheme:dark] dark:[color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 cursor-pointer"
    />
  );
}
