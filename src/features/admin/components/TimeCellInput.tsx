import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

interface Props {
  value: string;
  onCommit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Time input optimizado para la grilla de asistencias:
 * - Editar es local (no dispara la mutación en cada tecla → sin lag).
 * - Hace commit solo onBlur o al presionar Enter.
 * - Botón de reloj para abrir el selector nativo del navegador.
 */
export function TimeCellInput({ value, onCommit, disabled, placeholder }: Props) {
  const [local, setLocal] = useState(value || "");
  const ref = useRef<HTMLInputElement>(null);

  // Sync cuando cambia desde afuera (refetch) y no estamos editando
  useEffect(() => {
    if (document.activeElement !== ref.current) setLocal(value || "");
  }, [value]);

  const commit = () => {
    const v = local || "";
    if (v !== (value || "")) onCommit(v);
  };

  return (
    <div className="relative flex items-center w-full">
      <input
        ref={ref}
        type="time"
        value={local}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") { e.currentTarget.blur(); }
        }}
        className="h-5 w-full text-[10px] p-0.5 pr-4 text-center rounded border border-primary/20 bg-background [color-scheme:dark] dark:[color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
      />
      <button
        type="button"
        disabled={disabled}
        tabIndex={-1}
        onClick={() => {
          const el = ref.current as any;
          if (el && typeof el.showPicker === "function") el.showPicker();
          else el?.focus();
        }}
        className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30"
        title="Abrir selector de hora"
      >
        <Clock className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
