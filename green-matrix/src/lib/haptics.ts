/**
 * Haptics helper (native). Platform-specific file per Code with Beto's rules:
 * Metro resolves haptics.web.ts on web instead of Platform.OS checks.
 * Haptics are fired once per user action, never in loops.
 */
import * as ExpoHaptics from 'expo-haptics';

/** Silent no-op wrapper so calls never throw (e.g. simulators without feedback). */
function fire(promise: Promise<void>) {
  promise.catch(() => {});
}

export const Haptics = {
  /** Subtle tap for press feedback on buttons/rows. */
  light() {
    fire(ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light));
  },
  /** Stronger feedback for important actions (toggles, submits). */
  medium() {
    fire(ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium));
  },
  /** Positive result (login ok, trigger fired, saved). */
  success() {
    fire(ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success));
  },
  /** Warning result (validation, API error). */
  error() {
    fire(ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error));
  },
  /** Selection change (tabs, segmented controls). */
  selection() {
    fire(ExpoHaptics.selectionAsync());
  },
};
