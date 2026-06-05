import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Harmonie Yacht',
    short_name: 'Harmonie',
    description: 'Pilotage Harmonie Yacht — leads, réservations, finances, Léa.',
    start_url: '/',
    display: 'standalone',
    background_color: '#1b3a5c',
    theme_color: '#1b3a5c',
    orientation: 'portrait',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
