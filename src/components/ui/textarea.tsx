import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const CTRL_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\uFEFF]/g;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, onPaste, ...props }, ref) => {
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const raw = e.clipboardData.getData("text");
    const clean = raw.replace(CTRL_REGEX, "").normalize("NFKC");
    if (clean !== raw) {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const next = target.value.slice(0, start) + clean + target.value.slice(end);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(target, next);
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }
    onPaste?.(e);
  };

  return (
    <textarea
      onPaste={handlePaste}
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
