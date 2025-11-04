import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import Navigation from '../components/Navigation';
import { getInstanceConfig } from '../lib/instance-config';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  const [hideNav, setHideNav] = useState(false);

  useEffect(() => {
    const config = getInstanceConfig();
    setHideNav(config.ui?.hideNavigation || false);
  }, []);

  return (
    <>
      {!hideNav && <Navigation />}
      <Component {...pageProps} />
    </>
  );
}
