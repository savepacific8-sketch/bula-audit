import { useEffect } from 'react';

/**
 * Applies the 'dark' class to <html> based on the OS prefers-color-scheme.
 * Listens for live changes (e.g. switching OS theme).
 */
export function useSystemDarkMode() {
  useEffect(() => {
    const apply = (dark) => {
      document.documentElement.classList.toggle('dark', dark);
    };

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches);

    const handler = (e) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
}