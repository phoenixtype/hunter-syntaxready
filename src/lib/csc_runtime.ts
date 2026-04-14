/**
 * Runtime loader for country-state-city data.
 *
 * Why this exists: importing the `country-state-city` npm package inlines
 * a 7.7MB city.json file as a giant JS array literal into the main bundle.
 * iOS Safari's JS parser recurses on deeply-nested literals and blows its
 * stack during module parse, throwing `RangeError: Maximum call stack size
 * exceeded` before any app code runs.
 *
 * Instead we serve the JSON files as static assets from /data/csc/ and
 * fetch them at runtime. JSON.parse is iterative, so 7.7MB parses fine on
 * every browser. Data is cached in-memory after first fetch, and browsers
 * cache the HTTP response so subsequent loads are free.
 */

export interface CSCCountry {
  name: string;
  isoCode: string;
  flag: string;
  phonecode: string;
  currency: string;
  latitude: string;
  longitude: string;
}

export interface CSCState {
  name: string;
  isoCode: string;
  countryCode: string;
  latitude: string;
  longitude: string;
}

export interface CSCCity {
  name: string;
  countryCode: string;
  stateCode: string;
  latitude: string;
  longitude: string;
}

// Raw city row format in city.json: [name, countryCode, stateCode, lat, lng]
type RawCityRow = [string, string, string, string, string];

let countriesPromise: Promise<CSCCountry[]> | null = null;
let statesPromise: Promise<CSCState[]> | null = null;
let citiesPromise: Promise<RawCityRow[]> | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export function loadCountries(): Promise<CSCCountry[]> {
  if (!countriesPromise) {
    countriesPromise = fetchJson<CSCCountry[]>("/data/csc/country.json");
  }
  return countriesPromise;
}

function loadStates(): Promise<CSCState[]> {
  if (!statesPromise) {
    statesPromise = fetchJson<CSCState[]>("/data/csc/state.json");
  }
  return statesPromise;
}

function loadCities(): Promise<RawCityRow[]> {
  if (!citiesPromise) {
    citiesPromise = fetchJson<RawCityRow[]>("/data/csc/city.json");
  }
  return citiesPromise;
}

export async function getStatesOfCountry(countryCode: string): Promise<CSCState[]> {
  const all = await loadStates();
  return all.filter((s) => s.countryCode === countryCode);
}

function rowToCity(row: RawCityRow): CSCCity {
  return {
    name: row[0],
    countryCode: row[1],
    stateCode: row[2],
    latitude: row[3],
    longitude: row[4],
  };
}

export async function getCitiesOfCountry(countryCode: string): Promise<CSCCity[]> {
  const all = await loadCities();
  return all.filter((r) => r[1] === countryCode).map(rowToCity);
}

export async function getCitiesOfState(
  countryCode: string,
  stateCode: string,
): Promise<CSCCity[]> {
  const all = await loadCities();
  return all.filter((r) => r[1] === countryCode && r[2] === stateCode).map(rowToCity);
}
