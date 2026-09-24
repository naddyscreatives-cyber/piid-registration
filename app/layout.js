// FILE: app/layout.js — Root layout: fonts, metadata and the global stylesheet.
// Depends on: app/globals.css.

import './globals.css';
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: 'PIID Summit — Register',
  description:
    'Registration and multi-showroom check-in for the PIID Summit. Register once, receive your QR ticket by email.',
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
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
