// FILE: app/layout.js — Root layout: fonts, metadata and the global stylesheet.
// Depends on: app/globals.css.

import localFont from 'next/font/local';
import './globals.css';

// One typeface everywhere, self-hosted by Next.js so every device renders the same font.
// Bundled with the app (app/fonts) so builds never depend on reaching Google Fonts.
const inter = localFont({
  src: './fonts/Inter-Variable.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'Manila Interior Design Summit',
  description:
    'Registration and multi-showroom check-in for the Manila Interior Design Summit. Register once, receive your QR ticket by email.',
  robots: { index: false, follow: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#f4f4f5',
};

/**
 * UiRootLayout — wraps every page in the app.
 * @param {{children: React.ReactNode}} props
 * @returns {JSX.Element} the html/body shell
 */
export default function UiRootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
