import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      duration={4000}
      offset={16}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] border-l-[3px] border-l-[var(--color-text-muted)] rounded-lg shadow-[0_4px_12px_-4px_rgba(0,0,0,0.08)] font-[family-name:var(--font-ui)] text-[13px]",
          description: "text-[var(--color-text-muted)] text-[12px]",
          actionButton: "bg-[var(--color-accent)] text-white",
          cancelButton: "bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]",
          success: "!border-l-[var(--color-success)]",
          error: "!border-l-[var(--color-danger)]",
          warning: "!border-l-[var(--color-warning)]",
          info: "!border-l-[var(--color-accent)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
