import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { recordPageView } from '../services/apiClient';
import { trackGooglePageView, trackMetaPageView } from '../utils/metaPixel';

const safeStorageId = (storage, key) => {
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const value = crypto.randomUUID();
    storage.setItem(key, value);
    return value;
  } catch {
    return crypto.randomUUID();
  }
};

const visitorId = safeStorageId(window.localStorage, 'anns-visitor-id');
const sessionId = safeStorageId(window.sessionStorage, 'anns-visit-session');

export default function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith('/product-manager')) return;
    const event = {
      visitorId,
      sessionId,
      path: `${location.pathname}${location.search}`,
      referrer: document.referrer,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      language: navigator.language || '',
      screen: `${window.screen.width}x${window.screen.height}`,
    };
    void recordPageView(event).catch(() => {});
    trackGooglePageView({ path: event.path, location: window.location.href, title: document.title });
    trackMetaPageView();
  }, [location.pathname, location.search]);

  return null;
}
