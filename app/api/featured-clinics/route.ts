// app/api/featured-clinics/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

const VALID_US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
]);

/**
 * GET /api/featured-clinics
 * 
 * Query params:
 * - city: City name (required)
 * - state: State code (required)
 * - exclude: Place ID to exclude (usually current clinic)
 * - limit: Number of results (default 10, max 20)
 */
export async function GET(request: Request) {
  const supabase = createSupabaseClient();

  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const exclude = searchParams.get('exclude');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);

    // Validate required parameters
    if (!city || !state) {
      return NextResponse.json(
        { error: 'Missing required parameters: city and state' },
        { status: 400 }
      );
    }

    if (!VALID_US_STATES.has(state)) {
      return NextResponse.json(
        { error: 'Invalid state code' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('clinics')
      .select('*')
      .eq('city', city)
      .eq('state_code', state)
      .eq('featured_clinic', true)
      .eq('business_status', 'OPERATIONAL') // Only show operational clinics
      .order('rating', { ascending: false, nullsFirst: false }) // Sort by rating (nulls last)
      .order('user_rating_count', { ascending: false, nullsFirst: false }) // Then by review count (nulls last)
      .limit(limit);

    // Exclude current clinic if specified
    if (exclude) {
      query = query.neq('place_id', exclude);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    const response = NextResponse.json({
      clinics: data || [],
      total: data?.length || 0,
      city,
      state,
    });

    // Cache for 1 hour since featured clinics don't change frequently
    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    response.headers.set('CDN-Cache-Control', 'public, s-maxage=3600');

    return response;
  } catch (error) {
    console.error('Error in featured-clinics API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch featured clinics' },
      { status: 500 }
    );
  }
}
