// app/api/cities/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

const VALID_US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
]);

export async function GET(request: Request) {
  const supabase = createSupabaseClient();

  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');

    if (!state || !VALID_US_STATES.has(state)) {
      return NextResponse.json(
        { error: 'Valid state code required' },
        { status: 400 }
      );
    }

    // Get all clinics for this state and count by city
    const { data, error } = await supabase
      .from('clinics')
      .select('city, place_id')
      .eq('state_code', state)
      .not('city', 'is', null);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Count clinics per city
    const cityCounts: Record<string, number> = {};
    data?.forEach((clinic) => {
      const city = clinic.city;
      if (city) {
        cityCounts[city] = (cityCounts[city] || 0) + 1;
      }
    });

    // Format response
    const cities = Object.entries(cityCounts)
      .map(([name, clinicCount]) => ({
        name,
        clinicCount,
        slug: name.toLowerCase().replace(/\s+/g, '-')
      }))
      .sort((a, b) => b.clinicCount - a.clinicCount);

    const response = NextResponse.json({
      state,
      cities,
      totalCities: cities.length,
      totalClinics: Object.values(cityCounts).reduce((sum, count) => sum + count, 0)
    });

    // Cache for 1 hour
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    response.headers.set('CDN-Cache-Control', 'public, s-maxage=3600');

    return response;
  } catch (error) {
    console.error('Error in cities API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cities' },
      { status: 500 }
    );
  }
}
