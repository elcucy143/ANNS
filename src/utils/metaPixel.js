const META_PIXEL_ID = '1422387876733160';
const GOOGLE_MEASUREMENT_ID = 'G-430T1WWG2Q';
const MARKETING_CONSENT_KEY = 'anns-marketing-consent-v1';

export const getMarketingConsent = () => {
  try { return localStorage.getItem(MARKETING_CONSENT_KEY); } catch { return null; }
};

export const setMarketingConsent = (value) => {
  try { localStorage.setItem(MARKETING_CONSENT_KEY, value ? 'granted' : 'denied'); } catch { /* Consent remains valid for this page. */ }
};

export const initializeMetaPixel = () => {
  if (getMarketingConsent() !== 'granted') return false;
  if (window.fbq?.loaded) return true;

  const fbq = function metaPixelQueue(...args) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  };
  window.fbq = fbq;
  window._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];

  const script = document.createElement('script');
  script.id = 'meta-pixel-script';
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);
  fbq('init', META_PIXEL_ID);
  return true;
};

export const trackMetaEvent = (eventName, parameters = {}, eventId = '') => {
  if (!initializeMetaPixel()) return false;
  if (eventId) window.fbq('track', eventName, parameters, { eventID: String(eventId) });
  else window.fbq('track', eventName, parameters);
  return true;
};

export const trackMetaPageView = () => trackMetaEvent('PageView');

export const initializeGoogleAnalytics = () => {
  if (getMarketingConsent() !== 'granted') return false;
  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function googleTagQueue() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GOOGLE_MEASUREMENT_ID, { send_page_view: false });
  }
  if (!document.getElementById('google-analytics-script')) {
    const script = document.createElement('script');
    script.id = 'google-analytics-script';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }
  return true;
};

export const trackGooglePageView = ({ path, location, title }) => {
  if (!initializeGoogleAnalytics()) return false;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: location,
    page_title: title,
  });
  return true;
};

export const metaProduct = (product, quantity = 1) => ({
  content_ids: [String(product.id)],
  content_name: String(product.name || product.id),
  content_category: String(product.category || ''),
  content_type: 'product',
  value: Number(product.price || 0) * Number(quantity || 1),
  currency: 'INR',
  contents: [{ id: String(product.id), quantity: Number(quantity || 1), item_price: Number(product.price || 0) }],
});

export { GOOGLE_MEASUREMENT_ID, MARKETING_CONSENT_KEY, META_PIXEL_ID };
