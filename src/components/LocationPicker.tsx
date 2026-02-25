import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

const COUNTRIES = [
  "USA", "Canada", "UK", "Australia", "Germany", "France",
  "Ireland", "Netherlands", "Singapore", "India", "New Zealand", "Other",
];

const US_STATES = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" }, { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" },
  { value: "DC", label: "Dist. of Columbia" }, { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" }, { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" }, { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" }, { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" }, { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" }, { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" }, { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" }, { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" }, { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" }, { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" }, { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" }, { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" }, { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" }, { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" }, { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" }, { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" }, { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

const CA_PROVINCES = [
  { value: "AB", label: "Alberta" }, { value: "BC", label: "British Columbia" },
  { value: "MB", label: "Manitoba" }, { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland and Labrador" }, { value: "NS", label: "Nova Scotia" },
  { value: "NT", label: "Northwest Territories" }, { value: "NU", label: "Nunavut" },
  { value: "ON", label: "Ontario" }, { value: "PE", label: "Prince Edward Island" },
  { value: "QC", label: "Quebec" }, { value: "SK", label: "Saskatchewan" },
  { value: "YT", label: "Yukon" },
];

interface LocationPickerProps {
  locations: string[];
  onChange: (locations: string[]) => void;
}

const LocationPicker = ({ locations, onChange }: LocationPickerProps) => {
  const [country, setCountry] = useState("USA");
  const [stateOrProvince, setStateOrProvince] = useState("");
  const [city, setCity] = useState("");

  const showSubdivision = country === "USA" || country === "Canada";
  const subdivisions = country === "USA" ? US_STATES : CA_PROVINCES;
  const subdivisionPlaceholder = country === "USA" ? "State" : "Province";

  const handleCountryChange = (val: string) => {
    setCountry(val);
    setStateOrProvince("");
  };

  const addLocation = () => {
    const parts = [city.trim(), stateOrProvince, country].filter(Boolean);
    const formatted = parts.join(", ");
    if (!formatted || locations.includes(formatted)) return;
    onChange([...locations, formatted]);
    setCity("");
    setStateOrProvince("");
  };

  const removeLocation = (loc: string) => {
    onChange(locations.filter(l => l !== loc));
  };

  const canAdd = city.trim().length > 0 && locations.length < 10;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* Country */}
        <Select value={country} onValueChange={handleCountryChange}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* State / Province (USA + Canada only) */}
        {showSubdivision && (
          <Select value={stateOrProvince} onValueChange={setStateOrProvince}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder={subdivisionPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {subdivisions.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* City */}
        <Input
          value={city}
          onChange={e => setCity(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (canAdd) addLocation(); } }}
          placeholder="City"
          className="flex-1 min-w-[120px] h-9 text-sm"
        />

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
