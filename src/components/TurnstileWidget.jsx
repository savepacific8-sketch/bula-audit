import { useEffect, useRef, useCallback } from 'react';

const SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '')
  .trim()
  .replace(/^["']|["']$/g, '');

/**
 * Cloudflare Turnstile CAPTCHA. Hidden when VITE_TURNSTILE_SITE_KEY is unset (local dev).
 * Pass `resetKey` from parent and increment it after a failed login to get a fresh token.
 */
export default function TurnstileWidget({ onToken, onError, resetKey = 0 }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);

  onTokenRef.current = onToken;
  onErrorRef.current = onError;

  const renderWidget = useCallback(() => {
    if (!SITE_KEY || !containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current != null) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        /* ignore */
      }
      widgetIdRef.current = null;
    }
    onTokenRef.current?.(null);
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      appearance: 'always',
      callback: (token) => onTokenRef.current?.(token),
      'expired-callback': () => onTokenRef.current?.(null),
      'error-callback': () => {
        onTokenRef.current?.(null);
        onErrorRef.current?.('CAPTCHA failed to load. Refresh and try again.');
      },
    });
  }, []);

  useEffect(() => {
    if (!SITE_KEY) return;

    const existing = document.querySelector('script[data-turnstile]');
    if (existing && window.turnstile) {
      renderWidget();
      return () => {
        if (widgetIdRef.current != null && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            /* ignore */
          }
        }
      };
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = '1';
    script.onload = () => renderWidget();
    script.onerror = () =>
      onErrorRef.current?.('Could not load security check. Check your connection.');
    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current != null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
      }
    };
  }, [renderWidget, resetKey]);

  if (!SITE_KEY) return null;

  return <div ref={containerRef} className="flex justify-center min-h-[65px]" />;
};
