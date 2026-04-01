import { NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import type { NavSection } from './sidebar-config';

interface SidebarSectionProps {
  currentPath: string;
  isFirst?: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  section: NavSection;
}

export function SidebarSection({ currentPath, isFirst = false, onOpenChange, open, section }: SidebarSectionProps) {
  const isSectionActive = section.items.some((item) => item.to === currentPath);

  return (
    <div className="animate-fade-in">
      {!isFirst && <div className="mx-4 mb-3 h-px bg-sidebar-border/60" />}

      <div className="rounded-[1.5rem] border border-sidebar-border/70 bg-card/70 p-2 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-sidebar-border hover:bg-card/90">
        <Collapsible open={open} onOpenChange={onOpenChange}>
          <CollapsibleTrigger
            className={cn(
              'flex w-full items-center justify-between rounded-[1.1rem] px-3 py-3 text-left transition-all duration-200 hover:bg-sidebar-accent/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2',
              isSectionActive && 'bg-sidebar-accent/50'
            )}
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-muted-foreground/80">
                {section.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/75">
                {section.items.length} {section.items.length === 1 ? 'atalho' : 'atalhos'}
              </p>
            </div>

            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sidebar-border/70 bg-background/80 text-muted-foreground transition-all duration-200',
                open && 'border-sidebar-ring/40 bg-sidebar-accent/80 text-primary'
              )}
            >
              <ChevronRight className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-90')} />
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="mt-2 space-y-1 rounded-[1.1rem] border border-sidebar-border/60 bg-background/70 p-2">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'group flex min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 active:scale-[0.99]',
                      isActive
                        ? 'border border-sidebar-ring/20 bg-sidebar-accent text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-sidebar-accent/45 hover:text-foreground'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-transparent bg-muted/40 transition-all duration-200 group-hover:bg-sidebar-accent/70',
                          isActive && 'border-sidebar-ring/15 bg-sidebar-accent/90 text-primary'
                        )}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate leading-tight">{item.label}</span>
                      </div>
                      <span
                        className={cn(
                          'h-2 w-2 shrink-0 rounded-full bg-transparent transition-all duration-200',
                          isActive && 'bg-primary shadow-sm'
                        )}
                      />
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}