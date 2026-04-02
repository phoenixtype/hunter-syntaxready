/**
 * Mobile App Initialization for Hunter AI
 *
 * ⚠️ IMPORTANT: ALL Capacitor plugin imports MUST be dynamic (inside
 * isNativePlatform checks). Static top-level imports of @capacitor/* will
 * throw on mobile browsers (Safari / Chrome mobile) because the native
 * bridge is absent, crashing the entire React app before it renders.
 */

// Only import Capacitor/core which is safe — it detects the platform without
// requiring the native bridge.  Everything else is lazy-loaded.
import { Capacitor } from '@capacitor/core';

export class HunterAIMobile {
  private static initialized = false;

  static async initialize() {
    // On mobile web browsers: bail out immediately — no native bridge available.
    if (this.initialized || !Capacitor.isNativePlatform()) return;

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
    if (!Capacitor.isNativePlatform()) return;

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
    if (!Capacitor.isNativePlatform()) return;

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
    if (!Capacitor.isNativePlatform()) return;

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
      await fetch('/api/push-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform: Capacitor.getPlatform() })
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
    if (!Capacitor.isNativePlatform()) return;
    const { MobileFeatures } = await import('./utils/mobile-features');
    await MobileFeatures.hapticFeedback(style);
  }

  static async vibrate(duration = 100) {
    if (!Capacitor.isNativePlatform()) return;
    const { MobileFeatures } = await import('./utils/mobile-features');
    await MobileFeatures.vibrate(duration);
  }

  static isNative() {
    return Capacitor.isNativePlatform();
  }

  static getPlatform() {
    return Capacitor.getPlatform();
  }

  static async setStatusBarColor(color: string) {
    if (!Capacitor.isNativePlatform()) return;
    const { MobileFeatures } = await import('./utils/mobile-features');
    await MobileFeatures.setStatusBarColor(color);
  }
}