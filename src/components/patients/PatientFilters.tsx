import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "../ui/Button";
import { Search } from "../ui/Search";
import { cn } from "../../lib/utils";

export type PatientFilter = "all" | "new" | "returning";

const options: { key: PatientFilter; label: string }[] = [
  { key: "all", label: "All patients" },
  { key: "new", label: "New patients" },
  { key: "returning", label: "Returning patients" },
];

export function PatientFilters({
  active,
  onChange,
  counts,
  search,
  onSearchChange,
}: {
  active: PatientFilter;
  onChange: (filter: PatientFilter) => void;
  counts: Record<PatientFilter, number>;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeOption = options.find((o) => o.key === active) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3">
      <div className="relative" ref={containerRef}>
        <Button
          variant="outline"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {activeOption.label}
          <ChevronDown size={14} strokeWidth={2.5} />
        </Button>

        {open && (
          <div
            role="listbox"
            className="absolute left-0 z-30 mt-1.5 w-52 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-1 shadow-lg"
          >
            {options.map((option) => (
              <button
                key={option.key}
                type="button"
                role="option"
                aria-selected={active === option.key}
                onClick={() => {
                  onChange(option.key);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-[13px] font-semibold transition-colors hover:bg-[var(--color-canvas)]",
                  active === option.key
                    ? "text-[var(--color-teal)]"
                    : "text-[var(--color-ink)]",
                )}
              >
                {option.label}
                <span className="text-[11.5px] font-bold text-[var(--color-muted)]">
                  {counts[option.key]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Search
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search patients"
        className="w-full sm:w-56"
      />
    </div>
  );
}
