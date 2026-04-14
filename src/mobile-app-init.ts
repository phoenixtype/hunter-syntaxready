/**
 * Mobile App Initialization for Hunter AI
 *
 * ⚠️ IMPORTANT: ALL Capacitor plugin imports MUST be dynamic (inside
 * isNativePlatform checks). Static top-level imports of @capacitor/* will
 * throw on mobile browsers (Safari / Chrome mobile) because the native
 * bridge is absent, crashing the entire React app before it renders.
 *
 * Even `@capacitor/core` can fail on some mobile browsers where the
 * Capacitor global is partially injected but the bridge is absent.
 * We lazy-import it and fall back gracefully.
 */

try { (globalThis as { __HUNTER_STEP__?: (n: string) => void }).__HUNTER_STEP__?.('mobile-app-init:body-start'); } catch { /* ignore */ }

/** Safely check if Capacitor native platform is available */
async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    // @capacitor/core failed to load — we're on a plain web browser
    return false;
  }
}

/** Returns the platform string, or 'web' if Capacitor is unavailable */
async function getPlatformSafe(): Promise<string> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
}

export class HunterAIMobile {
  private static initialized = false;

  static async initialize() {
    if (this.initialized) return;

    // On mobile web browsers: bail out immediately — no native bridge available.
    const isNative = await isNativePlatform();
    if (!isNative) return;

    console.log('🚀 Initializing Hunter AI Mobile App...');

    try {
      const { MobileFeatures } = await import('./utils/mobile-features');
      await MobileFeatures.initialize();

      this.setupAppLifecycle();
      await this.setupPushNotifications();
      await MobileFeatures.optimizePerformance();
      this.addMobileCSS();

      this.initialized = true;
      console.log('✅ Hunter AI Mobile App initialized successfully!');
    } catch (error) {
      console.error('❌ Failed to initialize mobile app:', error);
    }
  }

  private static setupAppLifecycle() {
    // Dynamic import — only runs in native context
    import('@capacitor/app').then(({ App }) => {
      App.addListener('appUrlOpen', (event) => {
        console.log('🔗 App opened via URL:', event.url);
        this.handleDeepLink(event.url);
      });

      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });
    }).catch(() => { /* silent — native only */ });

    import('./utils/mobile-features').then(({ MobileFeatures }) => {
      MobileFeatures.onAppStateChange((isActive) => {
        if (isActive) {
          window.dispatchEvent(new CustomEvent('app:refresh'));
        } else {
          window.dispatchEvent(new CustomEvent('app:pause'));
        }
      });
    }).catch(() => { /* silent */ });
  }

  private static async setupPushNotifications() {
    const isNative = await isNativePlatform();
    if (!isNative) return;

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      const permission = await PushNotifications.requestPermissions();
      if (permission.receive === 'granted') {
        await PushNotifications.register();
        console.log('✅ Push notifications registered');
      }

      PushNotifications.addListener('registration', (token) => {
        console.log('📱 Push registration token:', token.value);
        this.sendTokenToServer(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('❌ Push registration failed:', error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('📨 Push notification received:', notification);
        this.handlePushNotification(notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('👆 Push action:', action);
        this.handleNotificationAction(action);
      });
    } catch (error) {
      console.warn('⚠️ Push notifications setup failed:', error);
    }
  }

  private static addMobileCSS() {
    import('./utils/mobile-features').then(({ MobileFeatures }) => {
      const platform = MobileFeatures.getPlatform();
      const body = document.body;

      body.classList.add('mobile-app');
      body.classList.add(`platform-${platform}`);

      if (MobileFeatures.isIOS()) body.classList.add('ios');
      else if (MobileFeatures.isAndroid()) body.classList.add('android');

      const safeArea = MobileFeatures.getSafeAreaInsets();
      const root = document.documentElement;
      root.style.setProperty('--safe-area-inset-top', safeArea.top);
      root.style.setProperty('--safe-area-inset-bottom', safeArea.bottom);
      root.style.setProperty('--safe-area-inset-left', safeArea.left);
      root.style.setProperty('--safe-area-inset-right', safeArea.right);
    }).catch(() => { /* silent */ });
  }

  private static handleDeepLink(url: string) {
    try {
      const urlObj = new URL(url);
      window.history.pushState({}, '', urlObj.pathname);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (error) {
      console.error('Failed to handle deep link:', error);
    }
  }

  private static async sendTokenToServer(token: string) {
    try {
      const platform = await getPlatformSafe();
      await fetch('/api/push-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform })
      });
    } catch (error) {
      console.error('❌ Failed to register push token:', error);
    }
  }

  private static handlePushNotification(notification: any) {
    const { title, body, data } = notification;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, { body, data } as NotificationOptions);
      });
    }
  }

  private static handleNotificationAction(action: any) {
    const { actionId, notification } = action;
    const url = notification.data?.url || '/dashboard';
    if (actionId === 'dismiss') return;
    this.handleDeepLink(url);
  }

  // Public utilities
  static async hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'light') {
    const isNative = await isNativePlatform();
    if (!isNative) return;
    const { MobileFeatures } = await import('./utils/mobile-features');
    await MobileFeatures.hapticFeedback(style);
  }

  static async vibrate(duration = 100) {
    const isNative = await isNativePlatform();
    if (!isNative) return;
    const { MobileFeatures } = await import('./utils/mobile-features');
    await MobileFeatures.vibrate(duration);
  }

  static isNative() {
    // Synchronous check — use the global if available, otherwise false
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cap = (window as any).Capacitor;
      return cap?.isNativePlatform?.() ?? false;
    } catch {
      return false;
    }
  }

  static getPlatform() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cap = (window as any).Capacitor;
      return cap?.getPlatform?.() ?? 'web';
    } catch {
      return 'web';
    }
  }

  static async setStatusBarColor(color: string) {
    const isNative = await isNativePlatform();
    if (!isNative) return;
    const { MobileFeatures } = await import('./utils/mobile-features');
    await MobileFeatures.setStatusBarColor(color);
  }
}