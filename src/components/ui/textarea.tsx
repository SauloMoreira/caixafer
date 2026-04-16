import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] font-[family-name:var(--font-ui)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-faint)] transition-colors focus-visible:outline-none focus-visible:border-[var(--color-accent)] focus-visible:ring-[3px] focus-visible:ring-[rgba(184,115,51,0.12)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
