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
  return (
    <div className="animate-fade-in">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger
          className="flex w-full items-center justify-between px-[18px] py-2 text-left transition-colors hover:bg-[var(--color-surface-alt)] focus-visible:outline-none"
        >
          <p className="editorial-section-label">{section.title}</p>
          <ChevronRight
            className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-90')}
            style={{ color: 'var(--color-text-faint)' }}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'editorial-nav-item flex min-w-0 items-center gap-3 text-sm',
                    isActive && 'is-active'
                  )
                }
              >
                <item.icon className="h-[16px] w-[16px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
