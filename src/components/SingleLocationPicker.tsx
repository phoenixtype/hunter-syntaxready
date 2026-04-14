import { useState, useMemo, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { parseLocationString, buildLocationString } from "@/lib/location_data";
import { CountryCombobox } from "@/components/CountryCombobox";
import {
  loadCountries,
  getStatesOfCountry,
  getCitiesOfCountry,
  getCitiesOfState,
  type CSCCountry,
  type CSCState,
  type CSCCity,
} from "@/lib/csc_runtime";

interface SingleLocationPickerProps {
  value: string;
  onChange: (val: string) => void;
}

const SingleLocationPicker = ({ value, onChange }: SingleLocationPickerProps) => {
  const [allCountries, setAllCountries] = useState<CSCCountry[]>([]);
  const [states, setStates] = useState<CSCState[]>([]);
  const [cityPool, setCityPool] = useState<CSCCity[]>([]);

  const [countryCode, setCountryCode] = useState<string>("");
  const [stateCode, setStateCode] = useState<string>(() => parseLocationString(value).state || "");
  const [city, setCity] = useState(() => parseLocationString(value).city);
  const [cityQuery, setCityQuery] = useState(() => parseLocationString(value).city);
  const [showDropdown, setShowDropdown] = useState(false);

  const lastEmittedRef = useRef<string>(value);

  // Load country list once
  useEffect(() => {
    let cancelled = false;
    loadCountries().then((list) => {
      if (cancelled) return;
      setAllCountries(list);
      const p = parseLocationString(value);
      if (p.country) {
        const match = list.find(c => c.name === p.country || c.isoCode === p.country);
        if (match) setCountryCode(match.isoCode);
      }
    }).catch((err) => console.error("[SingleLocationPicker] countries load failed:", err));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load states whenever country changes
  useEffect(() => {
    if (!countryCode) { setStates([]); return; }
    let cancelled = false;
    getStatesOfCountry(countryCode).then((s) => {
      if (!cancelled) setStates(s);
    }).catch((err) => console.error("[SingleLocationPicker] states load failed:", err));
    return () => { cancelled = true; };
  }, [countryCode]);

  // Load city pool when country/state changes
  useEffect(() => {
    if (!countryCode) { setCityPool([]); return; }
    let cancelled = false;
    const loader = stateCode
      ? getCitiesOfState(countryCode, stateCode)
      : getCitiesOfCountry(countryCode);
    loader.then((c) => {
      if (!cancelled) setCityPool(c);
    }).catch((err) => console.error("[SingleLocationPicker] cities load failed:", err));
    return () => { cancelled = true; };
  }, [countryCode, stateCode]);

  const hasStates = states.length > 0;

  const citySuggestions = useMemo(() => {
    if (!cityQuery || cityQuery.length < 2) return [];
    return cityPool
      .filter(c => c.name.toLowerCase().startsWith(cityQuery.toLowerCase()))
      .slice(0, 10);
  }, [cityQuery, cityPool]);

  // Re-sync internal state when value changes externally (e.g. async profile load)
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    if (allCountries.length === 0) return; // Wait for countries to load
    const p = parseLocationString(value);
    const newCountryCode = allCountries.find(c => c.name === p.country || c.isoCode === p.country)?.isoCode || "";
    setCountryCode(newCountryCode);
    setStateCode(p.state || "");
    setCity(p.city);
    setCityQuery(p.city);
    lastEmittedRef.current = value;
  }, [value, allCountries]);

  // Push a new formatted string upstream whenever internal parts change
  useEffect(() => {
    const countryName = allCountries.find(c => c.isoCode === countryCode)?.name || countryCode;
    const stateName = states.find(s => s.isoCode === stateCode)?.name || stateCode;
    const formatted = buildLocationString(city || "", stateName || "", countryName || "");
    if (formatted !== value) {
      lastEmittedRef.current = formatted;
      onChange(formatted);
    }
  }, [city, stateCode, countryCode, states, allCountries]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCountryChange = (iso: string) => {
    setCountryCode(iso);
    setStateCode("");
    setCity("");
    setCityQuery("");
  };

  const handleStateChange = (iso: string) => {
    setStateCode(iso);
    setCity("");
    setCityQuery("");
  };

  const selectCity = (name: string) => {
    setCity(name);
    setCityQuery(name);
    setShowDropdown(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 w-full">
        {/* Country — searchable combobox */}
        <CountryCombobox
          value={countryCode}
          onChange={handleCountryChange}
          className="flex-1 min-w-[150px]"
          inputClassName="h-10 text-sm"
        />

        {/* State / Province */}
        {hasStates && (
          <Select value={stateCode} onValueChange={handleStateChange}>
            <SelectTrigger className="flex-1 min-w-[130px] h-10 text-sm">
              <SelectValue placeholder="State / Province" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {states.map(s => (
                <SelectItem key={s.isoCode} value={s.isoCode}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* City — combobox with fuzzy suggestions */}
        <div className="relative flex-1 min-w-[130px]">
          <Input
            value={cityQuery}
            onChange={e => { setCityQuery(e.target.value); setCity(e.target.value); setShowDropdown(true); }}
            onFocus={() => cityQuery.length >= 2 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="City"
            className="h-10 text-sm"
          />
          {showDropdown && citySuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-modal max-h-52 overflow-y-auto">
              {citySuggestions.map(c => (
                <button
                  key={`${c.name}-${c.stateCode}`}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); selectCity(c.name); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {value && (
        <p className="text-xs text-muted-foreground">
          Formatted as: <span className="text-foreground font-medium">{value}</span>
        </p>
      )}
    </div>
  );
};

export default SingleLocationPicker;
