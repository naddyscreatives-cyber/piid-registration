// FILE: lib/brand.js — Event name, partner logos, links and showroom route in one place.
// Depends on: public/logos/*. Consumed by the welcome page, registration page and success card.

/** The public event name shown across the guest-facing pages. */
export const EVENT_NAME = process.env.NEXT_PUBLIC_EVENT_NAME || 'Manila Interior Design Summit';

/**
 * Partner logos. `height` is tuned per logo so the three read as equal visual weight
 * (Flexform is a solid block, so it sits slightly smaller than the two wordmarks).
 */
export const PARTNER_LOGOS = [
  {
    key: 'poliform',
    name: 'Poliform',
    src: '/logos/poliform.svg',
    href: 'https://www.poliform.it/en/',
    ratio: 150 / 31.897,
    height: 26,
  },
  {
    key: 'flexform',
    name: 'Flexform',
    src: '/logos/flexform.svg',
    href: 'https://www.flexform.it/en/stores/flexform-manila-stileitalia',
    ratio: 298 / 48,
    height: 28,
  },
  {
    key: 'metrotiles',
    name: 'Metrotiles',
    src: '/logos/metrotiles.svg',
    href: 'https://metrotiles.com.ph',
    ratio: 2140 / 332,
    height: 26,
  },
];

/** Social follow links shown after a successful registration. */
export const SOCIAL_LOGOS = [
  {
    key: 'stileitalia',
    name: 'Stile Italia',
    handle: '@stileitaliainc',
    src: '/logos/stileitalia.png',
    href: 'https://www.instagram.com/stileitaliainc?stkn=NjdoMjQzeHhlcnZ4',
    ratio: 720 / 192,
    height: 26,
  },
  {
    key: 'metrotiles',
    name: 'Metrotiles',
    handle: '@metrotilesph',
    src: '/logos/metrotiles.svg',
    href: 'https://www.instagram.com/metrotilesph?stkn=N250bWdxcmR5Zml1',
    ratio: 2140 / 332,
    height: 22,
  },
];

/** The showroom walk along N. Garcia, in visiting order. */
export const SHOWROOM_ROUTE = [
  { number: '215', street: 'N. Garcia', label: ['Flexform'], color: '#9a3a24' },
  { number: '219', street: 'N. Garcia', label: ['Tribù', 'Barazza', 'Lualdi'], color: '#7a5b4d' },
  { number: '235', street: 'N. Garcia', label: ['Metrotiles'], color: '#6a6268' },
  { number: '237', street: 'N. Garcia', label: ['Poliform'], color: '#111111' },
];
