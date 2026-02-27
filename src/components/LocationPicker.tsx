import { useState, useMemo } from "react";
import { Country, State, City } from "country-state-city";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { CountryCombobox } from "@/components/CountryCombobox";

const ALL_COUNTRIES = Country.getAllCountries();

interface LocationPickerProps {
  locations: string[];
  onChange: (locations: string[]) => void;
}

const LocationPicker = ({ locations, onChange }: LocationPickerProps) => {
  const [countryCode, setCountryCode] = useState("US");
  const [stateCode, setStateCode] = useState("");
  const [city, setCity] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const states = useMemo(() => State.getStatesOfCountry(countryCode), [countryCode]);
  const hasStates = states.length > 0;

  const citySuggestions = useMemo(() => {
    if (!cityQuery || cityQuery.length < 2) return [];
    const source = stateCode
      ? City.getCitiesOfState(countryCode, stateCode)
      : City.getCitiesOfCountry(countryCode) || [];
    return source
      .filter(c => c.name.toLowerCase().startsWith(cityQuery.toLowerCase()))
      .slice(0, 10);
  }, [cityQuery, countryCode, stateCode]);

  const handleCountryChange = (iso: string) => {
    setCountryCode(iso);
    setStateCode("");
    setCity("");
    setCityQuery("");
  };

  const addLocation = () => {
    const countryName = ALL_COUNTRIES.find(c => c.isoCode === countryCode)?.name || countryCode;
    const stateName = states.find(s => s.isoCode === stateCode)?.name || stateCode;
    const parts = [city.trim(), stateName, countryName].filter(Boolean);
    const formatted = parts.join(", ");
    if (!formatted || locations.includes(formatted)) return;
    onChange([...locations, formatted]);
    setCity("");
    setCityQuery("");
    setStateCode("");
  };

  const removeLocation = (loc: string) => onChange(locations.filter(l => l !== loc));

  const canAdd = (city.trim().length > 0 || !hasStates) && locations.length < 10 && countryCode;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* Country — searchable combobox */}
        <CountryCombobox
          value={countryCode}
          onChange={handleCountryChange}
          className="w-[175px]"
          inputClassName="h-9 text-sm"
        />

        {/* State / Province */}
        {hasStates && (
          <Select value={stateCode} onValueChange={v => { setStateCode(v); setCity(""); setCityQuery(""); }}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
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

        {/* City — combobox */}
        <div className="relative flex-1 min-w-[110px]">
          <Input
            value={cityQuery}
            onChange={e => { setCityQuery(e.target.value); setCity(e.target.value); setShowDropdown(true); }}
            onFocus={() => cityQuery.length >= 2 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (canAdd) addLocation(); } }}
            placeholder="City"
            className="h-9 text-sm"
          />
          {showDropdown && citySuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
              {citySuggestions.map(c => (
                <button
                  key={`${c.name}-${c.stateCode}`}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    setCity(c.name);
                    setCityQuery(c.name);
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addLocation}
          disabled={!canAdd}
          className="h-9 px-3 shrink-0"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />Add
        </Button>
      </div>

      {/* Location tags */}
      {locations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {locations.map(loc => (
            <Badge key={loc} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
              {loc}
              <button
                type="button"
                onClick={() => removeLocation(loc)}
                className="ml-0.5 hover:text-destructive transition-colors"
                aria-label={`Remove ${loc}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {locations.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add up to 10 locations. Jobs will be searched in all specified areas.
        </p>
      )}
    </div>
  );
};

export default LocationPicker;
