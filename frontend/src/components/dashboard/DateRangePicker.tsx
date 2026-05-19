import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar, ChevronDown } from 'lucide-react';

export interface DateRange {
  from: string;
  to: string;
  label: string;
}

const PRESETS: DateRange[] = [
  {
    label: 'Current month',
    from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  },
  {
    label: 'Previous month',
    from: format(startOfMonth(subDays(startOfMonth(new Date()), 1)), 'yyyy-MM-dd'),
    to: format(endOfMonth(subDays(startOfMonth(new Date()), 1)), 'yyyy-MM-dd'),
  },
  {
    label: 'Last 7 days',
    from: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  },
  {
    label: 'Last 28 days',
    from: format(subDays(new Date(), 28), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  },
];

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="gh-btn gap-2"
      >
        <Calendar className="w-3.5 h-3.5" />
        <span>{value.label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gh-fg-muted" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-60 bg-gh-canvas-subtle border border-gh-border rounded-md shadow-2xl py-1">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  onChange(preset);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gh-canvas transition-colors ${
                  value.label === preset.label ? 'text-gh-accent-emphasis font-medium' : 'text-gh-fg'
                }`}
              >
                {preset.label}
                <span className="block text-xs text-gh-fg-muted mt-0.5">
                  {preset.from} → {preset.to}
                </span>
              </button>
            ))}

            <div className="border-t border-gh-border mt-1 pt-2 px-3 pb-2 space-y-2">
              <p className="text-xs text-gh-fg-muted font-medium">Custom range</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gh-fg-subtle mb-0.5">From</label>
                  <input
                    type="date"
                    value={value.from}
                    onChange={(e) =>
                      onChange({ ...value, label: 'Custom range', from: e.target.value })
                    }
                    className="gh-input w-full text-xs py-1"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gh-fg-subtle mb-0.5">To</label>
                  <input
                    type="date"
                    value={value.to}
                    onChange={(e) =>
                      onChange({ ...value, label: 'Custom range', to: e.target.value })
                    }
                    className="gh-input w-full text-xs py-1"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { PRESETS };
