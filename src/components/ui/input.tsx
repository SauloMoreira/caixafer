import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] font-[family-name:var(--font-ui)] text-[var(--color-text-primary)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[var(--color-text-faint)] transition-colors focus-visible:outline-none focus-visible:border-[var(--color-accent)] focus-visible:ring-[3px] focus-visible:ring-[rgba(184,115,51,0.12)] disabled:cursor-not-allowed disabled:opacity-50 md:text-[13px]",
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
