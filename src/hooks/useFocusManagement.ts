import { useEffect, useRef } from 'react';

interface FocusManagementOptions {
  /** Auto focus the first focusable element when component mounts */
  autoFocus?: boolean;
  /** Trap focus within the container */
  trapFocus?: boolean;
  /** Restore focus to the previously focused element when component unmounts */
  restoreFocus?: boolean;
}

/**
 * Hook for managing focus in modals, dialogs, and other interactive components
 * Provides accessibility compliance for keyboard navigation
 */
export function useFocusManagement(options: FocusManagementOptions = {}) {
  const {
    autoFocus = true,
    trapFocus = true,
    restoreFocus = true
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Get all focusable elements within a container
  const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
    const selectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable]:not([contenteditable="false"])'
    ];

    return Array.from(container.querySelectorAll(selectors.join(', '))) as HTMLElement[];
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Store the currently focused element
    if (restoreFocus) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }

    // Auto focus first element
    if (autoFocus) {
      const focusableElements = getFocusableElements(containerRef.current);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }

    // Focus trap handler
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!trapFocus || event.key !== 'Tab' || !containerRef.current) return;

      const focusableElements = getFocusableElements(containerRef.current);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab: Focus previous element
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: Focus next element
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Escape key handler
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        // Allow parent components to handle escape
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleEscape);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleEscape);

      // Restore focus to previously focused element
      if (restoreFocus && previousFocusRef.current) {
        try {
          previousFocusRef.current.focus();
        } catch (error) {
          // Element may no longer exist or be focusable
          console.warn('Failed to restore focus:', error);
        }
      }
    };
  }, [autoFocus, trapFocus, restoreFocus]);

  return containerRef;
}

/**
 * Hook for managing focus on route changes
 * Announces page changes to screen readers
 */
export function useRouteAnnouncement(pageTitle: string) {
  useEffect(() => {
    // Announce page change to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'assertive');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = `Navigated to ${pageTitle}`;

    document.body.appendChild(announcement);

    // Clean up after announcement
    const timer = setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    };
  }, [pageTitle]);
}