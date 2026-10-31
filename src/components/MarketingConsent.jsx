import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getMarketingConsent, setMarketingConsent, trackMetaPageView } from '../utils/metaPixel';
import './MarketingConsent.css';

export default function MarketingConsent() {
  const [visible, setVisible] = useState(() => getMarketingConsent() === null);
  if (!visible) return null;

  const choose = (granted) => {
    setMarketingConsent(granted);
    setVisible(false);
    if (granted) trackMetaPageView();
  };

  return <aside className="marketing-consent" aria-label="Advertising analytics preference">
    <div>
      <strong>Your privacy choices</strong>
      <p>ANNS uses optional Meta advertising analytics to understand ad performance and show more relevant offers. Necessary website functions work without it. <Link to="/privacy-policy">Privacy policy</Link></p>
    </div>
    <div className="marketing-consent-actions">
      <button type="button" className="consent-essential" onClick={() => choose(false)}>Only necessary</button>
      <button type="button" className="consent-accept" onClick={() => choose(true)}>Accept analytics</button>
    </div>
  </aside>;
}
