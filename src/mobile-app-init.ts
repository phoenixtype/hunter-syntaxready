import { MobileFeatures } from './utils/mobile-features';
import { App } from '@capacitor/app';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * Mobile App Initialization for Hunter AI
 * Sets up all mobile-specific features and optimizations
 */

export class HunterAIMobile {
  private static initialized = false;

  static async initialize() {
    if (this.initialized || !Capacitor.isNativePlatform()) return;

    console.log('🚀 Initializing Hunter AI Mobile App...');

    try {
      // Initialize core mobile features
      await MobileFeatures.initialize();

      // Set up app lifecycle handlers
      this.setupAppLifecycle();

      // Configure push notifications
      await this.setupPushNotifications();

      // Optimize performance for mobile
      await MobileFeatures.optimizePerformance();

      // Add mobile-specific CSS classes
      this.addMobileCSS();

      this.initialized = true;
      console.log('✅ Hunter AI Mobile App initialized successfully!');

    } catch (error) {
      console.error('❌ Failed to initialize mobile app:', error);
    }
  }

  private static setupAppLifecycle() {
    // Handle app state changes
    MobileFeatures.onAppStateChange((isActive) => {
      if (isActive) {
        console.log('📱 App became active');
        // Refresh data when app becomes active
        this.refreshAppData();
      } else {
        console.log('📱 App went to background');
        // Cleanup or pause operations
        this.pauseBackgroundOperations();
      }
    });

    // Handle app URL opens (deep links)
    App.addListener('appUrlOpen', (event) => {
      console.log('🔗 App opened via URL:', event.url);
      this.handleDeepLink(event.url);
    });

    // Handle back button on Android
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        // Show exit confirmation or minimize app
        App.exitApp();
      }
    });
  }

  private static async setupPushNotifications() {
    try {
      // Request permission
      const permission = await PushNotifications.requestPermissions();

      if (permission.receive === 'granted') {
        await PushNotifications.register();
        console.log('✅ Push notifications registered');
      }

      // Handle registration
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('📱 Push registration token:', token.value);
        // Send token to your server
        this.sendTokenToServer(token.value);
      });

      // Handle registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('❌ Push registration failed:', error);
      });

      // Handle incoming notifications
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('📨 Push notification received:', notification);
        this.handlePushNotification(notification);
      });

      // Handle notification actions
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('👆 Push notification action performed:', action);
        this.handleNotificationAction(action);
      });

    } catch (error) {
      console.warn('⚠️ Push notifications setup failed:', error);
    }
  }

  private static addMobileCSS() {
    const platform = MobileFeatures.getPlatform();
    const body = document.body;

    // Add platform-specific classes
    body.classList.add('mobile-app');
    body.classList.add(`platform-${platform}`);

    if (MobileFeatures.isIOS()) {
      body.classList.add('ios');
    } else if (MobileFeatures.isAndroid()) {
      body.classList.add('android');
    }

    // Add safe area CSS variables
    const safeArea = MobileFeatures.getSafeAreaInsets();
    const root = document.documentElement;

    root.style.setProperty('--safe-area-inset-top', safeArea.top);
    root.style.setProperty('--safe-area-inset-bottom', safeArea.bottom);
    root.style.setProperty('--safe-area-inset-left', safeArea.left);
    root.style.setProperty('--safe-area-inset-right', safeArea.right);

    // Add mobile-specific styles
    const mobileStyles = `
      .mobile-app {
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
      }

      .mobile-app .safe-area-top {
        padding-top: var(--safe-area-inset-top);
      }

      .mobile-app .safe-area-bottom {
        padding-bottom: var(--safe-area-inset-bottom);
      }

      .mobile-app input, .mobile-app textarea {
        -webkit-user-select: text;
      }

      /* Smooth scrolling on iOS */
      .ios .scrollable {
        -webkit-overflow-scrolling: touch;
      }

      /* Hide scrollbars on mobile */
      .mobile-app ::-webkit-scrollbar {
        display: none;
      }

      .mobile-app {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = mobileStyles;
    document.head.appendChild(styleSheet);
  }

  private static refreshAppData() {
    // Trigger React Query refetch for critical data
    window.dispatchEvent(new CustomEvent('app:refresh'));
  }

  private static pauseBackgroundOperations() {
    // Pause non-essential operations when app is backgrounded
    window.dispatchEvent(new CustomEvent('app:pause'));
  }

  private static handleDeepLink(url: string) {
    // Parse and handle deep links
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      // Navigate to the appropriate route
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));

    } catch (error) {
      console.error('Failed to handle deep link:', error);
    }
  }

  private static async sendTokenToServer(token: string) {
    try {
      // Send push token to your backend
      const response = await fetch('/api/push-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          platform: MobileFeatures.getPlatform()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to register push token');
      }

      console.log('✅ Push token registered with server');
    } catch (error) {
      console.error('❌ Failed to register push token:', error);
    }
  }

  private static handlePushNotification(notification: any) {
    // Handle foreground notifications
    const { title, body, data } = notification;

    // Show in-app notification or toast
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          data,
          actions: [
            {
              action: 'view',
              title: 'View'
            },
            {
              action: 'dismiss',
              title: 'Dismiss'
            }
          ]
        });
      });
    }
  }

  private static handleNotificationAction(action: any) {
    const { actionId, notification } = action;

    switch (actionId) {
      case 'view':
        // Navigate to relevant screen
        this.handleDeepLink(notification.data?.url || '/dashboard');
        break;
      case 'dismiss':
        // Just dismiss, no action needed
        break;
      default:
        // Default action (tap notification)
        this.handleDeepLink(notification.data?.url || '/dashboard');
    }
  }

  // Utility methods for the app to use
  static async hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'light') {
    await MobileFeatures.hapticFeedback(style);
  }

  static async vibrate(duration = 100) {
    await MobileFeatures.vibrate(duration);
  }

  static isNative() {
    return MobileFeatures.isNative();
  }

  static getPlatform() {
    return MobileFeatures.getPlatform();
  }

  static async setStatusBarColor(color: string) {
    await MobileFeatures.setStatusBarColor(color);
  }
}

// Auto-initialize when the module is loaded
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    HunterAIMobile.initialize();
  });
}