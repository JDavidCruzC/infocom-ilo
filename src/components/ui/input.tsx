import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Defensive paste sanitizer: strips control characters and zero-width
 * unicode from any text/email/search/url/tel input. Does NOT touch
 * number, file, color, password (UX preserved) or already-customized
 * inputs that handle their own onPaste.
 */
const SANITIZE_TYPES = new Set([undefined, "text", "email", "search", "url", "tel"]);
const CTRL_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\uFEFF]/g;

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onPaste, ...props }, ref) => {
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (SANITIZE_TYPES.has(type as string | undefined)) {
        const raw = e.clipboardData.getData("text");
        const clean = raw.replace(CTRL_REGEX, "").normalize("NFKC");
        if (clean !== raw) {
          e.preventDefault();
          const target = e.currentTarget;
          const start = target.selectionStart ?? target.value.length;
          const end = target.selectionEnd ?? target.value.length;
          const next = target.value.slice(0, start) + clean + target.value.slice(end);
          // emulate native input event so React state updates
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          setter?.call(target, next);
          target.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      onPaste?.(e);
    };

    return (
      <input
        type={type}
        onPaste={handlePaste}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
