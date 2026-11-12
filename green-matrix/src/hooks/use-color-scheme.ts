/**
 * The app is pinned to the light theme (design decision): system dark mode
 * is intentionally ignored so the background always renders light.
 */
export function useColorScheme(): 'light' {
  return 'light';
}
