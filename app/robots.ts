import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/my-gov/', '/claim/', '/you/', '/workspace/', '/dev/'],
      },
    ],
    sitemap: 'https://governada.io/sitemap.xml',
  };
}
