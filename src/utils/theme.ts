export type ThemeMode = 'dark' | 'light';

export const LEADER_THEME_KEY = 'chordbook_leader_theme_v1';
export const MEMBER_THEME_KEY = 'chordbook_member_theme_v1';

export function loadThemePreference(storageKey: string): ThemeMode {
  try {
    const val = localStorage.getItem(storageKey);
    if (val === 'light' || val === 'dark') {
      return val;
    }
  } catch {
    // Ignore storage errors
  }
  return 'dark';
}

export function saveThemePreference(storageKey: string, theme: ThemeMode): void {
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // Ignore storage errors
  }
}

export function applyDocumentTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  if (theme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }
}
