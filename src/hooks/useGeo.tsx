import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Currency = 'NGN' | 'USD';

interface GeoContextValue {
  country: string;
  isNigeria: boolean;
  currency: Currency;
  isLoading: boolean;
}

const GeoContext = createContext<GeoContextValue>({
  country: '',
  isNigeria: false,
  currency: 'USD',
  isLoading: true,
});

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

async function detectCountry(): Promise<string> {
  // 1. Check cached cookie
  const cached = getCookie('hunter-country');
  if (cached) return cached;

  // 2. Try Vercel serverless function
  try {
    const res = await fetch('/api/detect-country');
    if (res.ok) {
      const { country_code } = await res.json();
      if (country_code) {
        setCookie('hunter-country', country_code, 1);
        return country_code;
      }
    }
  } catch {
    // Vercel function unavailable, try fallback
  }

  // 3. Fallback: Supabase edge function
  try {
    const { data, error } = await supabase.functions.invoke('detect-country');
    if (!error && data?.country_code) {
      setCookie('hunter-country', data.country_code, 1);
      return data.country_code;
    }
  } catch {
    // Both detection methods failed
  }

  // 4. Default
  return 'US';
}

export function GeoProvider({ children }: { children: ReactNode }) {
  const [country, setCountry] = useState<string>(() => getCookie('hunter-country') || '');
  const [isLoading, setIsLoading] = useState(!getCookie('hunter-country'));

  useEffect(() => {
    if (country) return;
    detectCountry().then((code) => {
      setCountry(code);
      setIsLoading(false);
    });
  }, [country]);

  const isNigeria = country === 'NG';
  const currency: Currency = isNigeria ? 'NGN' : 'USD';

  return (
    <GeoContext.Provider value={{ country, isNigeria, currency, isLoading }}>
      {children}
    </GeoContext.Provider>
  );
}

export function useGeo() {
  return useContext(GeoContext);
}
