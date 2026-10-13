import type { Metadata, Viewport } from 'next';
import './globals.css';
import BackendKeepAlive from '@/components/BackendKeepAlive';

export const viewport: Viewport = {
  themeColor: '#6C63FF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Sparsh — Accessible Education Platform',
  description: 'AI-powered inclusive education for visually impaired, hearing impaired, and DeafBlind students across India. ISL avatar, live captions, TTS, and Braille support.',
  keywords: 'sparsh, accessible education, ISL, Indian Sign Language, deaf education, visually impaired, inclusive learning, India, NCERT',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/sparsh-logo.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/sparsh-logo.png',
    shortcut: '/favicon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SPARSH',
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'SPARSH — AI-Powered Inclusive Education Platform',
    description: 'AI-powered inclusive education with Smart Gloves, ISL avatar, live captions, TTS, and Braille support.',
    type: 'website',
    images: [
      {
        url: '/sparsh-logo.png',
        width: 512,
        height: 512,
        alt: 'SPARSH Official App Logo',
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-inter antialiased">
        <BackendKeepAlive />
        {children}
      </body>
    </html>
  );
}
