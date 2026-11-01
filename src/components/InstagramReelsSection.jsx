import React, { useEffect, useState } from 'react';
import { ExternalLink, Instagram, Play } from 'lucide-react';
import { getInstagramReels } from '../services/apiClient';
import './InstagramReelsSection.css';

const PROFILE_URL = 'https://www.instagram.com/a.s.trends_gifts/';

const InstagramReelsSection = () => {
  const [feed, setFeed] = useState({ connected: false, profileUrl: PROFILE_URL, items: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getInstagramReels()
      .then((result) => { if (active) setFeed(result); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const profileUrl = feed.profileUrl || PROFILE_URL;

  return (
    <section className="instagram-reels-section" aria-labelledby="instagram-reels-title">
      <div className="container">
        <div className="instagram-reels-heading">
          <div><p><Instagram size={16} /> FROM OUR INSTAGRAM</p><h2 id="instagram-reels-title">Watch. Love. Shop.</h2><span>Product videos and new arrivals from @a.s.trends_gifts</span></div>
          <a href={profileUrl} target="_blank" rel="noreferrer">Follow on Instagram <ExternalLink size={15} /></a>
        </div>
        {loading ? <div className="instagram-reels-loading">Loading our latest reels…</div> : feed.items.length ? (
          <div className="instagram-reels-row" role="list" aria-label="Latest Instagram reels">
            {feed.items.map((reel) => (
              <a key={reel.id} href={reel.permalink} target="_blank" rel="noreferrer" className="instagram-reel-card" role="listitem" aria-label={`Watch Instagram reel${reel.caption ? `: ${reel.caption}` : ''}`}>
                <img src={reel.thumbnailUrl} alt={reel.caption || 'ANNS product reel'} loading="lazy" referrerPolicy="no-referrer" />
                <span className="instagram-reel-play"><Play size={21} fill="currentColor" /></span>
                {reel.caption && <p>{reel.caption}</p>}
              </a>
            ))}
          </div>
        ) : (
          <a className="instagram-reels-fallback" href={profileUrl} target="_blank" rel="noreferrer">
            <Instagram size={34} /><span><strong>See our latest product reels</strong><small>Follow @a.s.trends_gifts for new arrivals, styling ideas and offers.</small></span><ExternalLink size={19} />
          </a>
        )}
      </div>
    </section>
  );
};

export default InstagramReelsSection;
