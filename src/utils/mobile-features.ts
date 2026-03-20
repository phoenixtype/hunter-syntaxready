import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Mobile-specific feature utilities for Hunter AI
 */

export class MobileFeatures {
  static async initialize() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      // Configure status bar
      await StatusBar.setStyle({ style: Style.Default });
      await StatusBar.setBackgroundColor({ color: '#ffffff' });

      // Configure keyboard
      await Keyboard.setResizeMode({ mode: KeyboardResize.Body });

      // Hide splash screen after initialization
      setTimeout(async () => {
        await SplashScreen.hide();
      }, 2000);

      console.log('✅ Mobile features initialized');
    } catch (error) {
      console.warn('⚠️ Failed to initialize some mobile features:', error);
    }
  }

  static async setStatusBarColor(color: string) {
    if (Capacitor.isNativePlatform()) {
      try {
        await StatusBar.setBackgroundColor({ color });
      } catch (error) {
        console.warn('Failed to set status bar color:', error);
      }
    }
  }

  static async hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'light') {
    if (Capacitor.isNativePlatform()) {
      try {
        const impactStyle = {
          light: ImpactStyle.Light,
          medium: ImpactStyle.Medium,
          heavy: ImpactStyle.Heavy
        }[style];

        await Haptics.impact({ style: impactStyle });
      } catch (error) {
        console.warn('Failed to trigger haptic feedback:', error);
      }
    }
  }

  static async vibrate(duration = 100) {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.vibrate({ duration });
      } catch (error) {
        console.warn('Failed to vibrate:', error);
      }
    }
  }

  static isNative() {
    return Capacitor.isNativePlatform();
  }

  static getPlatform() {
    return Capacitor.getPlatform();
  }

  static isIOS() {
    return Capacitor.getPlatform() === 'ios';
  }

  static isAndroid() {
    return Capacitor.getPlatform() === 'android';
  }

  // Safe area utilities for different devices
  static getSafeAreaInsets() {
    if (typeof window !== 'undefined' && 'CSS' in window && CSS.supports) {
      return {
        top: CSS.supports('padding-top: env(safe-area-inset-top)')
          ? 'env(safe-area-inset-top)' : '0px',
        bottom: CSS.supports('padding-bottom: env(safe-area-inset-bottom)')
          ? 'env(safe-area-inset-bottom)' : '0px',
        left: CSS.supports('padding-left: env(safe-area-inset-left)')
          ? 'env(safe-area-inset-left)' : '0px',
        right: CSS.supports('padding-right: env(safe-area-inset-right)')
          ? 'env(safe-area-inset-right)' : '0px',
      };
    }
    return { top: '0px', bottom: '0px', left: '0px', right: '0px' };
  }

  // Optimize for mobile performance
  static async optimizePerformance() {
    if (!Capacitor.isNativePlatform()) return;

    // Disable animations on low-end devices
    const isLowEnd = await this.isLowEndDevice();
    if (isLowEnd) {
      document.documentElement.style.setProperty('--animation-duration', '0ms');
      console.log('🐌 Low-end device detected, animations disabled for performance');
    }

    // Optimize images for mobile
    this.optimizeImages();
  }

  private static async isLowEndDevice(): Promise<boolean> {
    // Simple heuristic - in a real app you might check device info
    return navigator.hardwareConcurrency < 4 ||
           ((navigator as any).deviceMemory && (navigator as any).deviceMemory < 4);
  }

  private static optimizeImages() {
    // Lazy load images and reduce quality on mobile
    const images = document.querySelectorAll('img[data-mobile-optimize]');
    images.forEach((img) => {
      img.setAttribute('loading', 'lazy');
      if (window.devicePixelRatio > 2) {
        // Reduce image quality on high DPI displays
        const src = img.getAttribute('src');
        if (src && !src.includes('?quality=')) {
          img.setAttribute('src', `${src}?quality=80`);
        }
      }
    });
  }

  // App lifecycle management
  static onAppStateChange(callback: (isActive: boolean) => void) {
    if (!Capacitor.isNativePlatform()) return;

    document.addEventListener('visibilitychange', () => {
      callback(!document.hidden);
    });

    // Handle native app state changes
    if ('addEventListener' in window) {
      window.addEventListener('pause', () => callback(false));
      window.addEventListener('resume', () => callback(true));
    }
  }
}