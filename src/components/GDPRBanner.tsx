import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Cookie, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface ConsentSettings {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

const DEFAULT_CONSENT: ConsentSettings = {
  necessary: true, // Always required
  analytics: false,
  marketing: false,
  preferences: false
};

export function GDPRBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [consent, setConsent] = useState<ConsentSettings>(DEFAULT_CONSENT);

  useEffect(() => {
    // Check if user has already given consent
    const savedConsent = localStorage.getItem('hunter_gdpr_consent');
    const consentTimestamp = localStorage.getItem('hunter_gdpr_timestamp');

    if (!savedConsent || !consentTimestamp) {
      setShowBanner(true);
    } else {
      // Check if consent is older than 1 year (re-consent required)
      const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
      if (parseInt(consentTimestamp) < oneYearAgo) {
        setShowBanner(true);
      } else {
        setConsent(JSON.parse(savedConsent));
      }
    }
  }, []);

  const saveConsent = (consentSettings: ConsentSettings) => {
    localStorage.setItem('hunter_gdpr_consent', JSON.stringify(consentSettings));
    localStorage.setItem('hunter_gdpr_timestamp', Date.now().toString());
    setConsent(consentSettings);
    setShowBanner(false);
    setShowSettings(false);

    // Apply consent settings
    applyConsentSettings(consentSettings);

    toast.success('Privacy preferences saved');
  };

  const applyConsentSettings = (settings: ConsentSettings) => {
    // Apply analytics consent
    if (window.gtag) {
      window.gtag('consent', 'update', {
        'analytics_storage': settings.analytics ? 'granted' : 'denied',
        'ad_storage': settings.marketing ? 'granted' : 'denied'
      });
    }

    // Apply other consent settings as needed
    if (!settings.analytics) {
      // Disable analytics tracking
      document.cookie = '_ga=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = '_gid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
  };

  const handleAcceptAll = () => {
    const fullConsent = {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true
    };
    saveConsent(fullConsent);
  };

  const handleRejectAll = () => {
    saveConsent(DEFAULT_CONSENT);
  };

  const handleSaveSettings = () => {
    saveConsent(consent);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* GDPR Banner */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 bg-background/95 backdrop-blur-md border-t border-border">
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <Cookie className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="font-semibold text-sm">We value your privacy</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    We use cookies and similar technologies to provide, protect, and improve our services.
                    By clicking "Accept All", you consent to our use of cookies for analytics and marketing.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={handleAcceptAll}>
                    Accept All
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleRejectAll}>
                    Reject All
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowSettings(true)}
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    Customize
                  </Button>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowBanner(false)}
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Privacy Settings</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowSettings(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Necessary Cookies</h4>
                      <p className="text-xs text-muted-foreground">Required for basic functionality</p>
                    </div>
                    <div className="text-xs text-muted-foreground">Always On</div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Analytics Cookies</h4>
                      <p className="text-xs text-muted-foreground">Help us improve our service</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={consent.analytics}
                      onChange={(e) => setConsent(prev => ({ ...prev, analytics: e.target.checked }))}
                      className="rounded border-input"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Marketing Cookies</h4>
                      <p className="text-xs text-muted-foreground">Personalized ads and content</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={consent.marketing}
                      onChange={(e) => setConsent(prev => ({ ...prev, marketing: e.target.checked }))}
                      className="rounded border-input"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium">Preference Cookies</h4>
                      <p className="text-xs text-muted-foreground">Remember your settings</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={consent.preferences}
                      onChange={(e) => setConsent(prev => ({ ...prev, preferences: e.target.checked }))}
                      className="rounded border-input"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveSettings} className="w-full" size="sm">
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

// Export consent checker for other components to use
export function hasAnalyticsConsent(): boolean {
  try {
    const consent = localStorage.getItem('hunter_gdpr_consent');
    if (!consent) return false;
    const settings = JSON.parse(consent) as ConsentSettings;
    return settings.analytics;
  } catch {
    return false;
  }
}

export default GDPRBanner;