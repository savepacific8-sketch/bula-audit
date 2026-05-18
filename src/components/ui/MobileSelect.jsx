/**
 * MobileSelect — vaul Bottom Sheet on mobile, Radix Select on desktop.
 *
 * Usage (pass plain <option> children as the item source):
 *   <MobileSelect value={v} onValueChange={fn} placeholder="…">
 *     <option value="a">Option A</option>
 *     <option value="b">Option B</option>
 *   </MobileSelect>
 */

import { useState, useEffect } from 'react';
import * as React from 'react';
import { Drawer } from 'vaul';
import { ChevronDown, Check } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}

export function MobileSelect({
  value,
  onValueChange,
  placeholder = 'Select…',
  disabled,
  className,
  triggerClassName,
  children,
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // Parse items from <option> children
  const items = React.Children.toArray(children).map((child) => ({
    value: child.props.value,
    label: child.props.children,
  }));

  const selectedLabel = items.find((i) => i.value === value)?.label;

  if (!isMobile) {
    // ── Desktop: standard Radix Select ──────────────────────────
    return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={cn(triggerClassName, className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // ── Mobile: vaul bottom sheet ────────────────────────────────
  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm',
            'focus:outline-none focus:ring-1 focus:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            triggerClassName,
            className
          )}
        >
          <span className={cn('truncate', !selectedLabel && 'text-muted-foreground')}>
            {selectedLabel || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-card border-t border-border outline-none">
          {/* Drag handle */}
          <div className="mx-auto mt-3 mb-1 h-1.5 w-10 rounded-full bg-muted-foreground/30" />

          <div className="overflow-y-auto max-h-[60vh] pb-2">
            {items.map((item) => {
              const isSelected = item.value === value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    onValueChange?.(item.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium transition-colors',
                    'border-b border-border last:border-0',
                    isSelected
                      ? 'text-primary bg-primary/5'
                      : 'text-foreground hover:bg-muted/60 active:bg-muted'
                  )}
                >
                  <span>{item.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Cancel */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full px-5 py-4 text-sm font-semibold text-muted-foreground border-t border-border active:bg-muted"
          >
            Cancel
          </button>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}