import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded text-[10px] font-medium uppercase tracking-[0.06em] px-2 py-[3px] border transition-colors font-[family-name:var(--font-ui)]",
  {
    variants: {
      variant: {
        // Pago / Ativo / Aberto
        default:
          "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[#b3e6cc]",
        success:
          "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[#b3e6cc]",
        // Pendente / Fiado
        warning:
          "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[#fcd48a]",
        // Cancelado / Erro
        destructive:
          "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[#f5b8b8]",
        danger:
          "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[#f5b8b8]",
        // Neutro / Rascunho
        secondary:
          "bg-[var(--color-accent-bg)] text-[var(--color-accent)] border-[#e2d9cc]",
        outline:
          "bg-transparent text-[var(--color-text-secondary)] border-[var(--color-border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
