import type { AppProps } from 'next/app';
import Head from 'next/head';
import Navigation from '../components/Navigation';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Wippli PowerNode</title>
        <meta name="description" content="AI-powered workflow automation platform" />
        <link rel="icon" href="/favicon.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Navigation />
      <Component {...pageProps} />
    </>
  );
}
