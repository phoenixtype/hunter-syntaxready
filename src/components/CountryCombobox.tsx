import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";
import { loadCountries, type CSCCountry } from "@/lib/csc_runtime";

interface CountryComboboxProps {
  value: string; // ISO code e.g. "US"
  onChange: (iso: string) => void;
  className?: string;
  inputClassName?: string;
}

export function CountryCombobox({ value, onChange, className, inputClassName }: CountryComboboxProps) {
  const [countries, setCountries] = useState<CSCCountry[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadCountries().then((list) => {
      if (!cancelled) setCountries(list);
    }).catch((err) => {
      console.error("[CountryCombobox] Failed to load countries:", err);
    });
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(() => countries.find(c => c.isoCode === value), [countries, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries.slice(0, 25);
    return countries.filter(c =>
      c.name.toLowerCase().startsWith(q) ||
      c.isoCode.toLowerCase() === q
    ).slice(0, 15);
  }, [query, countries]);

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
        placeholder={countries.length === 0 ? "Loading…" : "Search country…"}
        className={inputClassName}
        autoComplete="off"
        disabled={countries.length === 0}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-modal max-h-52 overflow-y-auto">
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
