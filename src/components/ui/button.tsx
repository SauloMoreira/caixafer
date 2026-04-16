import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-medium font-[family-name:var(--font-ui)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary = outlined accent (editorial)
        default:
          "bg-transparent border-[1.5px] border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]",
        // Destructive = outlined danger
        destructive:
          "bg-transparent border-[1.5px] border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]",
        // Outline = same as primary outlined accent
        outline:
          "bg-transparent border-[1.5px] border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]",
        // Secondary / Ghost = subtle bege surface
        secondary:
          "bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:border-[var(--color-border-soft)]",
        ghost:
          "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text-primary)]",
        link: "text-[var(--color-accent)] underline-offset-4 hover:underline",
        // Success outlined (used in "finalizar venda", "enviar whatsapp")
        success:
          "bg-transparent border-[1.5px] border-[var(--color-success)] text-[var(--color-success-text)] hover:bg-[var(--color-success-bg)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
