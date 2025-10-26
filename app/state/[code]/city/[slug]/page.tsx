// app/state/[code]/city/[slug]/page.tsx
import { notFound, redirect } from 'next/navigation';

interface CityPageProps {
  params: Promise<{
    code: string;
    slug: string;
  }>;
}

export default async function CityPage({ params }: CityPageProps) {
  const { code, slug } = await params;
  const stateCode = code.toUpperCase();
  
  // Convert slug back to city name (replace hyphens with spaces, capitalize)
  const cityName = slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Redirect to existing clinics page with state and city filters
  redirect(`/clinics?state=${stateCode}&city=${encodeURIComponent(cityName)}`);
}
