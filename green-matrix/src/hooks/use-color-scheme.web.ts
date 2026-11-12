/**
 * The app is pinned to the light theme (design decision): system dark mode
 * is intentionally ignored so the background always renders light.
 *
 * (Static-render safe by definition — no client hydration needed.)
 */
export function useColorScheme(): 'light' {
  return 'light';
}
