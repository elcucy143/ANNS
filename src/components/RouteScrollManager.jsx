import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

const RouteScrollManager = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
};

export default RouteScrollManager;
