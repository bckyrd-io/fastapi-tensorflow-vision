/**
 * Haptics helper (web). No-op — browsers have no haptic hardware.
 * Kept as a platform-specific file so callers never branch on Platform.OS.
 */
export const Haptics = {
  light() {},
  medium() {},
  success() {},
  error() {},
  selection() {},
};
