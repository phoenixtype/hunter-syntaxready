/**
 * Mobile browser safety utilities
 *
 * Detects mobile browsers and problematic user agents that may have
 * issues with complex animations, large bundles, or memory-intensive operations.
 */

// Detect if we're on a mobile browser that might have stack overflow issues
export function isMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

  return isMobile;
}

// Detect specifically problematic browsers that had stack overflow issues
export function isProblematicMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();

  // iPhone Safari and Chrome mobile specifically had the stack overflow
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);
  const isAndroidChrome = /android.*chrome/i.test(userAgent);
  const isMobileSafari = /safari/i.test(userAgent) && /mobile/i.test(userAgent);

  return isIOS || isAndroidChrome || isMobileSafari;
}

// Check if device has limited memory (heuristic based on user agent and hardware)
export function hasLimitedMemory(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();

  // Old Android versions, old iOS, or specific low-memory indicators
  const oldAndroid = /android [1-5]/i.test(userAgent);
  const oldIOS = /os [1-9]_/i.test(userAgent);
  const lowMemoryIndicators = /lite|go|mini/i.test(userAgent);

  return oldAndroid || oldIOS || lowMemoryIndicators;
}

// Master function to determine if we should use reduced functionality
export function shouldUseReducedMode(): boolean {
  return isMobileBrowser() || hasLimitedMemory();
}

// Disable framer-motion animations on problematic browsers
export function shouldDisableAnimations(): boolean {
  return isProblematicMobileBrowser() || hasLimitedMemory();
}

// Log mobile browser info for debugging
export function logMobileBrowserInfo(): void {
  if (typeof window === 'undefined') return;

  console.log('[MOBILE SAFETY]', {
    userAgent: window.navigator.userAgent,
    isMobile: isMobileBrowser(),
    isProblematic: isProblematicMobileBrowser(),
    hasLimitedMemory: hasLimitedMemory(),
    shouldUseReducedMode: shouldUseReducedMode(),
    shouldDisableAnimations: shouldDisableAnimations(),
  });
}