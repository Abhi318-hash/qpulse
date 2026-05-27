import { MetadataRoute } from 'next';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://qpulse.health';

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/billing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  try {
    // Only fetch non-hidden clinics
    const clinicsQuery = query(collection(db, 'clinics'), where('is_hidden', '==', false));
    const querySnapshot = await getDocs(clinicsQuery);
    
    const dynamicRoutes: MetadataRoute.Sitemap = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      let lastMod = new Date();
      if (data.updated_at && typeof data.updated_at.toDate === 'function') {
        lastMod = data.updated_at.toDate();
      }
      return {
        url: `${baseUrl}/clinic/${doc.id}`,
        lastModified: lastMod,
        changeFrequency: 'hourly',
        priority: 0.8,
      };
    });

    return [...staticRoutes, ...dynamicRoutes];
  } catch (err) {
    console.error('Error generating sitemap dynamic routes:', err);
    return staticRoutes;
  }
}
