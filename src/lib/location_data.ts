/** Helpers for the country-state-city library. */

/** Parse a "City, State, Country" string back into its parts. */
export function parseLocationString(saved: string): { country: string; state: string; city: string } {
  if (!saved) return { country: "", state: "", city: "" };
  const parts = saved.split(",").map(s => s.trim());
  if (parts.length >= 3) return { city: parts[0], state: parts[1], country: parts[2] };
  if (parts.length === 2) return { city: parts[0], state: "", country: parts[1] };
  return { city: saved, state: "", country: "" };
}

/** Build "City, State, Country" from parts, omitting empty segments. */
export function buildLocationString(city: string, state: string, country: string): string {
  return [city.trim(), state.trim(), country.trim()].filter(Boolean).join(", ");
}
