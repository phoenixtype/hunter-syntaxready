import { useState, useMemo } from "react";
import { Country } from "country-state-city";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";

const ALL_COUNTRIES = Country.getAllCountries();

interface CountryComboboxProps {
  value: string; // ISO code e.g. "US"
  onChange: (iso: string) => void;
  className?: string;
  inputClassName?: string;
}

export function CountryCombobox({ value, onChange, className, inputClassName }: CountryComboboxProps) {
  const selected = useMemo(() => ALL_COUNTRIES.find(c => c.isoCode === value), [value]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_COUNTRIES.slice(0, 25);
    return ALL_COUNTRIES.filter(c =>
      c.name.toLowerCase().startsWith(q) ||
      c.isoCode.toLowerCase() === q
    ).slice(0, 15);
  }, [query]);

  const handleFocus = () => {
    setQuery(selected?.name ?? "");
    setOpen(true);
  };

  const handleBlur = () => setTimeout(() => setOpen(false), 150);

  const displayValue = open ? query : selected ? `${selected.flag} ${selected.name}` : "";

  return (
    <div className={`relative ${className ?? ""}`}>
      <Input
        value={displayValue}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Search country…"
        className={inputClassName}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(c => (
            <button
              key={c.isoCode}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                onChange(c.isoCode);
                setQuery("");
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors"
            >
              <span className="shrink-0">{c.flag}</span>
              <span className="flex-1 truncate">{c.name}</span>
              {c.isoCode === value && <Check className="w-3.5 h-3.5 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
