// Platform detection utilities
// Provides cross-platform device and OS detection for UI adaptations

export interface PlatformInfo {
  /** Whether the current platform is macOS */
  isMac: boolean;
  /** Whether the current device is a desktop (has keyboard) */
  isDesktop: boolean;
  /** Whether the current device is a mobile phone */
  isMobile: boolean;
  /** Whether the current device is a tablet */
  isTablet: boolean;
  /** The appropriate modifier key symbol/text for shortcuts */
  modifierKey: string;
  /** The platform name (macos, windows, linux, ios, android, unknown) */
  platform: string;
}

/**
 * Detects platform and device information from user agent
 * @returns PlatformInfo object with detection results
 */
export function getPlatformInfo(): PlatformInfo {
  // Server-side rendering fallback
  if (typeof window === 'undefined') {
    return {
      isMac: false,
      isDesktop: true,
      isMobile: false,
      isTablet: false,
      modifierKey: 'CTRL',
      platform: 'unknown'
    };
  }

  const userAgent = navigator.userAgent.toLowerCase();

  // Platform detection
  const isMac = userAgent.includes('mac');
  const isWindows = userAgent.includes('windows');
  const isLinux = userAgent.includes('linux') && !userAgent.includes('android');
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);
  const isAndroid = userAgent.includes('android');

  // Device type detection
  const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent) || (isIOS && !userAgent.includes('iphone'));
  const isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent) && !isTablet;

  // Desktop is anything that's not mobile or tablet
  const isDesktop = !isMobile && !isTablet;

  // Determine platform name
  let platform = 'unknown';
  if (isMac) platform = 'macos';
  else if (isWindows) platform = 'windows';
  else if (isLinux) platform = 'linux';
  else if (isIOS) platform = 'ios';
  else if (isAndroid) platform = 'android';

  // Modifier key for shortcuts
  const modifierKey = isMac ? '⌘' : 'CTRL';

  return {
    isMac,
    isDesktop,
    isMobile,
    isTablet,
    modifierKey,
    platform
  };
}

/**
 * Hook for using platform info in React components
 * @returns PlatformInfo object
 */
export function usePlatformInfo(): PlatformInfo {
  // In a real implementation, this could use useState/useEffect for SSR compatibility
  // For now, we'll just return the detection result
  return getPlatformInfo();
}