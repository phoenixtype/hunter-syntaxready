import { useState, useMemo, useEffect } from "react";
import { Country, State, City } from "country-state-city";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { parseLocationString, buildLocationString } from "@/lib/location_data";
import { CountryCombobox } from "@/components/CountryCombobox";

interface SingleLocationPickerProps {
  value: string;
  onChange: (val: string) => void;
}

const ALL_COUNTRIES = Country.getAllCountries();

const SingleLocationPicker = ({ value, onChange }: SingleLocationPickerProps) => {
  const parsed = useMemo(() => parseLocationString(value), []);

  const [countryCode, setCountryCode] = useState<string>(() => {
    if (!parsed.country) return "";
    const match = ALL_COUNTRIES.find(c => c.name === parsed.country || c.isoCode === parsed.country);
    return match?.isoCode || "";
  });
  const [stateCode, setStateCode] = useState<string>(() => parsed.state || "");
  const [city, setCity] = useState(parsed.city);
  const [cityQuery, setCityQuery] = useState(parsed.city);
  const [showDropdown, setShowDropdown] = useState(false);

  const states = useMemo(() => (countryCode ? State.getStatesOfCountry(countryCode) : []), [countryCode]);
  const hasStates = states.length > 0;

  const citySuggestions = useMemo(() => {
    if (!cityQuery || cityQuery.length < 2) return [];
    const source = stateCode
      ? City.getCitiesOfState(countryCode, stateCode)
      : countryCode
      ? City.getCitiesOfCountry(countryCode) || []
      : [];
    return source
      .filter(c => c.name.toLowerCase().startsWith(cityQuery.toLowerCase()))
      .slice(0, 10);
  }, [cityQuery, countryCode, stateCode]);

  // Push a new formatted string upstream whenever parts change
  useEffect(() => {
    const countryName = ALL_COUNTRIES.find(c => c.isoCode === countryCode)?.name || countryCode;
    const stateName = states.find(s => s.isoCode === stateCode)?.name || stateCode;
    onChange(buildLocationString(city, stateName, countryName));
  }, [city, stateCode, countryCode]);

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
      <div className="flex flex-wrap gap-2">
        {/* Country — searchable combobox */}
        <CountryCombobox
          value={countryCode}
          onChange={handleCountryChange}
          className="w-[180px]"
          inputClassName="h-10 text-sm"
        />

        {/* State / Province */}
        {hasStates && (
          <Select value={stateCode} onValueChange={handleStateChange}>
            <SelectTrigger className="w-[155px] h-10 text-sm">
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
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
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
