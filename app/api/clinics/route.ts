// Use Node runtime on Cloudflare; edge runtime is not supported by default
// export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// app/api/clinics/route.ts 
import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

import { Clinic } from '@/lib/dataTypes';

// ✅ Valid US states for filtering
const VALID_US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
]);

// US State to Timezone mapping
const STATE_TIMEZONES: Record<string, string> = {
  'AL': 'America/Chicago', 'AK': 'America/Anchorage', 'AZ': 'America/Phoenix',
  'AR': 'America/Chicago', 'CA': 'America/Los_Angeles', 'CO': 'America/Denver',
  'CT': 'America/New_York', 'DE': 'America/New_York', 'FL': 'America/New_York',
  'GA': 'America/New_York', 'HI': 'Pacific/Honolulu', 'ID': 'America/Denver',
  'IL': 'America/Chicago', 'IN': 'America/Indiana/Indianapolis', 'IA': 'America/Chicago',
  'KS': 'America/Chicago', 'KY': 'America/New_York', 'LA': 'America/Chicago',
  'ME': 'America/New_York', 'MD': 'America/New_York', 'MA': 'America/New_York',
  'MI': 'America/Detroit', 'MN': 'America/Chicago', 'MS': 'America/Chicago',
  'MO': 'America/Chicago', 'MT': 'America/Denver', 'NE': 'America/Chicago',
  'NV': 'America/Los_Angeles', 'NH': 'America/New_York', 'NJ': 'America/New_York',
  'NM': 'America/Denver', 'NY': 'America/New_York', 'NC': 'America/New_York',
  'ND': 'America/Chicago', 'OH': 'America/New_York', 'OK': 'America/Chicago',
  'OR': 'America/Los_Angeles', 'PA': 'America/New_York', 'RI': 'America/New_York',
  'SC': 'America/New_York', 'SD': 'America/Chicago', 'TN': 'America/Chicago',
  'TX': 'America/Chicago', 'UT': 'America/Denver', 'VT': 'America/New_York',
  'VA': 'America/New_York', 'WA': 'America/Los_Angeles', 'WV': 'America/New_York',
  'WI': 'America/Chicago', 'WY': 'America/Denver', 'DC': 'America/New_York'
};

/**
 * Transform Supabase data to frontend format
 * Handles both camelCase (from Google API) and snake_case (already normalized)
 * and calculate real-time open_now status
 */
function transformClinicData(rawClinic: any): Clinic {
  // Helper function to get value from either camelCase or snake_case
  const getValue = (obj: any, snakeKey: string, camelKey: string): boolean | undefined => {
    if (obj?.[snakeKey] !== undefined) return obj[snakeKey];
    if (obj?.[camelKey] !== undefined) return obj[camelKey];
    return undefined;
  };

  // Helper to check if an object has any truthy values
  const hasAnyValue = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    return Object.values(obj).some(value => value === true);
  };

  // Transform accessibility_options - handle both formats
  let accessibility_options = undefined;
  if (rawClinic.accessibility_options && typeof rawClinic.accessibility_options === 'object') {
    const ao = rawClinic.accessibility_options;
    const transformed = {
      wheelchair_accessible_entrance: getValue(ao, 'wheelchair_accessible_entrance', 'wheelchairAccessibleEntrance'),
      wheelchair_accessible_parking: getValue(ao, 'wheelchair_accessible_parking', 'wheelchairAccessibleParking'),
      wheelchair_accessible_restroom: getValue(ao, 'wheelchair_accessible_restroom', 'wheelchairAccessibleRestroom'),
      wheelchair_accessible_seating: getValue(ao, 'wheelchair_accessible_seating', 'wheelchairAccessibleSeating'),
    };
    // Only include if at least one value is true
    if (hasAnyValue(transformed)) {
      accessibility_options = transformed;
    }
  }

  // Transform payment_options - handle both formats
  let payment_options = undefined;
  if (rawClinic.payment_options && typeof rawClinic.payment_options === 'object') {
    const po = rawClinic.payment_options;
    const transformed = {
      accepts_credit_cards: getValue(po, 'accepts_credit_cards', 'acceptsCreditCards'),
      accepts_debit_cards: getValue(po, 'accepts_debit_cards', 'acceptsDebitCards'),
      accepts_cash_only: getValue(po, 'accepts_cash_only', 'acceptsCashOnly'),
      accepts_nfc: getValue(po, 'accepts_nfc', 'acceptsNfc'),
    };
    // Only include if at least one value is true
    if (hasAnyValue(transformed)) {
      payment_options = transformed;
    }
  }

  // Transform parking_options - handle both formats
  let parking_options = undefined;
  if (rawClinic.parking_options && typeof rawClinic.parking_options === 'object') {
    const pko = rawClinic.parking_options;
    const transformed = {
      free_parking_lot: getValue(pko, 'free_parking_lot', 'freeParkingLot'),
      paid_parking_lot: getValue(pko, 'paid_parking_lot', 'paidParkingLot'),
      free_street_parking: getValue(pko, 'free_street_parking', 'freeStreetParking'),
      paid_street_parking: getValue(pko, 'paid_street_parking', 'paidStreetParking'),
      valet_parking: getValue(pko, 'valet_parking', 'valetParking'),
      free_garage_parking: getValue(pko, 'free_garage_parking', 'freeGarageParking'),
      paid_garage_parking: getValue(pko, 'paid_garage_parking', 'paidGarageParking'),
    };
    // Only include if at least one value is true
    if (hasAnyValue(transformed)) {
      parking_options = transformed;
    }
  }

  // Calculate real-time open_now status from weekday_text
  let current_open_now = false;
  if (rawClinic.opening_hours?.weekday_text) {
    const timezone = STATE_TIMEZONES[rawClinic.state_code] || 'America/New_York';
    current_open_now = calculateOpenNowFromWeekdayText(
      rawClinic.opening_hours.weekday_text,
      timezone
    );
  }

  return {
    ...rawClinic,
    accessibility_options,
    payment_options,
    parking_options,
    current_open_now,
    opening_hours: rawClinic.opening_hours ? {
      ...rawClinic.opening_hours,
      open_now: current_open_now, // Update this dynamically
    } : undefined,
  };
}

/**
 * Calculate if a clinic is open now based on weekday_text array
 * with proper timezone handling
 * 
 * Example: ["Monday: 8:00 AM – 5:00 PM", "Tuesday: 9:00 AM – 5:00 PM", ...]
 */
function calculateOpenNowFromWeekdayText(
  weekdayText: string[],
  timezone: string
): boolean {
  if (!weekdayText || weekdayText.length === 0) return false;

  try {
    // Get current time in the clinic's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday')?.value || '';
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    const currentTime = hour * 60 + minute; // Minutes since midnight

    // Find today's hours
    const todayHours = weekdayText.find(text => text.startsWith(weekday));
    if (!todayHours) return false;

    // Check if closed
    if (todayHours.toLowerCase().includes('closed')) return false;

    // Parse hours - handle multiple dash types (-, –, —)
    const timeMatch = todayHours.match(
      /(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–—]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
    );
    
    if (!timeMatch) {
      console.warn(`Could not parse hours: ${todayHours}`);
      return false;
    }

    const [, openHour, openMin, openPeriod, closeHour, closeMin, closePeriod] = timeMatch;

    // Convert to 24-hour format
    let openTime = parseInt(openHour) * 60 + parseInt(openMin);
    let closeTime = parseInt(closeHour) * 60 + parseInt(closeMin);

    // Handle AM/PM conversion
    if (openPeriod.toUpperCase() === 'PM' && parseInt(openHour) !== 12) {
      openTime += 12 * 60;
    }
    if (openPeriod.toUpperCase() === 'AM' && parseInt(openHour) === 12) {
      openTime = parseInt(openMin); // 12 AM is 00:00
    }
    if (closePeriod.toUpperCase() === 'PM' && parseInt(closeHour) !== 12) {
      closeTime += 12 * 60;
    }
    if (closePeriod.toUpperCase() === 'AM' && parseInt(closeHour) === 12) {
      closeTime = parseInt(closeMin); // 12 AM is 00:00
    }

    // Check if current time is within operating hours
    return currentTime >= openTime && currentTime < closeTime;
  } catch (error) {
    console.error('Error calculating open_now:', error);
    return false;
  }
}

/**
 * GET /api/clinics
 * Fetches all clinics from Supabase (US-only)
 */
export async function GET(request: Request) {
  // ✅ Initialize Supabase client INSIDE the function (Edge/Workers-safe)
  const supabase = createSupabaseClient();

  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const city = searchParams.get('city');
    const q = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '500');

    let query = supabase
      .from('clinics')
      .select('*', { count: 'exact' });

    // ✅ Always filter to valid US states at the database level
    query = query.in('state_code', Array.from(VALID_US_STATES));

    // Filter by state
    if (state) {
      query = query.eq('state_code', state);
    }

    // Filter by city
    if (city) {
      query = query.ilike('city', `%${city}%`);
    }

    // Search query (name or address)
    if (q) {
      query = query.or(`display_name.ilike.%${q}%,formatted_address.ilike.%${q}%`);
    }

    // Pagination
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // ✅ Additional client-side filter as defense-in-depth
    const usClinics = (data || []).filter(clinic => 
      clinic.state_code && VALID_US_STATES.has(clinic.state_code)
    );

    // Transform all US clinics to match frontend expectations
    const transformedClinics = usClinics.map(transformClinicData);

    const response = NextResponse.json({
      clinics: transformedClinics,
      total: count || 0,
      page,
      per_page: perPage,
    });

    // Add Cloudflare caching headers
    // Cache for 5 minutes, stale-while-revalidate for 1 hour
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    response.headers.set('CDN-Cache-Control', 'public, s-maxage=300');
    response.headers.set('Cloudflare-CDN-Cache-Control', 'public, max-age=300');

    return response;
    
  } catch (error) {
    console.error('Error in clinics API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clinics' },
      { status: 500 }
    );
  }
}
