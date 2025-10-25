/**
 * Comprehensive Dermatology Clinic Data Collection
 * 
 * This script uses a HYBRID approach for maximum coverage:
 * 1. Grid-based Nearby Search (primary) - spatial sweeping
 * 2. City-level Text Search (supplementary) - targeted queries
 * 
 * Usage:
 *   # Collect for specific states
 *   npx tsx scripts/collectClinicDataComprehensive.ts --states=CA,NY,TX
 * 
 *   # Collect for all states (requires HIGH API budget)
 *   npx tsx scripts/collectClinicDataComprehensive.ts --states=all
 * 
 * Environment Variables:
 *   GOOGLE_PLACES_API_KEY - Required
 *   PLACES_MAX_REQUESTS - Max API calls (recommend 5000+ per state)
 *   PLACES_QPS - Queries per second (default: 3)
 */

import { config } from 'dotenv';
import path from 'path';
import { promises as fs } from 'fs';

config({ path: path.resolve(process.cwd(), '.env.local') });

// ============================================================================
// Configuration
// ============================================================================

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
if (!API_KEY) {
  console.error('❌ GOOGLE_PLACES_API_KEY is missing in .env.local');
  process.exit(1);
}

const OUT_DIR = path.resolve(process.cwd(), 'data/clinics');
const QPS = Number(process.env.PLACES_QPS || 3);
const MAX_REQUESTS = Number(process.env.PLACES_MAX_REQUESTS || 5000);
const NEXT_PAGE_DELAY_MS = Number(process.env.PLACES_NEXT_PAGE_DELAY_MS || 1200);

let TOTAL_REQUESTS = 0;
let REJECTED_NON_US = 0;
let REJECTED_NON_DERM = 0;

// ============================================================================
// US States with Bounding Boxes and Major Cities
// ============================================================================

interface StateInfo {
  code: string;
  name: string;
  bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  majorCities: string[];
}

const US_STATES: Record<string, StateInfo> = {
  CA: {
    code: 'CA',
    name: 'California',
    bounds: { minLat: 32.5, maxLat: 42.0, minLng: -124.5, maxLng: -114.1 },
    majorCities: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland', 'Fresno', 'Long Beach', 'Bakersfield', 'Anaheim']
  },
  TX: {
    code: 'TX',
    name: 'Texas',
    bounds: { minLat: 25.8, maxLat: 36.5, minLng: -106.7, maxLng: -93.5 },
    majorCities: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Lubbock']
  },
  FL: {
    code: 'FL',
    name: 'Florida',
    bounds: { minLat: 24.5, maxLat: 31.0, minLng: -87.6, maxLng: -80.0 },
    majorCities: ['Miami', 'Tampa', 'Orlando', 'Jacksonville', 'St. Petersburg', 'Hialeah', 'Tallahassee', 'Fort Lauderdale', 'Port St. Lucie', 'Cape Coral']
  },
  NY: {
    code: 'NY',
    name: 'New York',
    bounds: { minLat: 40.5, maxLat: 45.0, minLng: -79.8, maxLng: -71.9 },
    majorCities: ['New York City', 'Buffalo', 'Rochester', 'Syracuse', 'Albany', 'Yonkers', 'New Rochelle', 'Mount Vernon', 'Schenectady', 'Utica']
  },
  PA: {
    code: 'PA',
    name: 'Pennsylvania',
    bounds: { minLat: 39.7, maxLat: 42.3, minLng: -80.5, maxLng: -74.7 },
    majorCities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading', 'Scranton', 'Bethlehem', 'Lancaster', 'Harrisburg', 'Altoona']
  },
  IL: {
    code: 'IL',
    name: 'Illinois',
    bounds: { minLat: 37.0, maxLat: 42.5, minLng: -91.5, maxLng: -87.5 },
    majorCities: ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Springfield', 'Peoria', 'Elgin', 'Waukegan', 'Champaign']
  },
  OH: {
    code: 'OH',
    name: 'Ohio',
    bounds: { minLat: 38.4, maxLat: 42.3, minLng: -84.8, maxLng: -80.5 },
    majorCities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton', 'Parma', 'Canton', 'Youngstown', 'Lorain']
  },
  GA: {
    code: 'GA',
    name: 'Georgia',
    bounds: { minLat: 30.4, maxLat: 35.0, minLng: -85.6, maxLng: -80.8 },
    majorCities: ['Atlanta', 'Augusta', 'Columbus', 'Macon', 'Savannah', 'Athens', 'Sandy Springs', 'Roswell', 'Johns Creek', 'Albany']
  },
  NC: {
    code: 'NC',
    name: 'North Carolina',
    bounds: { minLat: 33.8, maxLat: 36.6, minLng: -84.3, maxLng: -75.4 },
    majorCities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville', 'Cary', 'Wilmington', 'High Point', 'Asheville']
  },
  MI: {
    code: 'MI',
    name: 'Michigan',
    bounds: { minLat: 41.7, maxLat: 48.3, minLng: -90.4, maxLng: -82.4 },
    majorCities: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor', 'Lansing', 'Flint', 'Dearborn', 'Livonia', 'Troy']
  },
  // Add more states as needed...
};

const VALID_US_STATES = new Set(Object.keys(US_STATES));

// ============================================================================
// API Helper Functions
// ============================================================================

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.location',
  'places.primaryType',
  'places.types',
  'places.rating',
  'places.userRatingCount',
  'places.currentOpeningHours.openNow',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.businessStatus',
  'places.accessibilityOptions',
  'places.parkingOptions',
  'places.priceLevel',
  'places.paymentOptions',
  'places.photos.name',
  'places.photos.widthPx',
  'places.photos.heightPx',
  'nextPageToken'
].join(',');

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkRequestLimit(): Promise<void> {
  if (TOTAL_REQUESTS >= MAX_REQUESTS) {
    throw new Error('⛔ Request limit reached');
  }
  TOTAL_REQUESTS++;
  await sleep(Math.ceil(1000 / QPS));
}

// ============================================================================
// Address Component Parser
// ============================================================================

function parseAddressComponents(components: any[]): {
  state_code: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
} {
  const get = (type: string) => components?.find((c: any) => c.types?.includes(type));

  return {
    state_code: get('administrative_area_level_1')?.shortText ?? null,
    city: get('locality')?.longText ?? get('postal_town')?.longText ?? null,
    postal_code: get('postal_code')?.longText ?? null,
    country_code: get('country')?.shortText ?? null,
  };
}

// ============================================================================
// Dermatology Filtering Logic
// ============================================================================

function isDermatologyClinic(place: any): boolean {
  const name = (place.displayName?.text || '').toLowerCase();
  const website = (place.websiteUri || '').toLowerCase();
  const types = (place.types || []).join(' ').toLowerCase();
  const searchText = `${name} ${website} ${types}`;

  // Validate US location
  const addressComponents = place.addressComponents ?? [];
  const ac = parseAddressComponents(addressComponents);

  if (ac.country_code && ac.country_code !== 'US') {
    REJECTED_NON_US++;
    return false;
  }

  if (!ac.state_code || !VALID_US_STATES.has(ac.state_code)) {
    REJECTED_NON_US++;
    return false;
  }

  // Exclude non-dermatology places
  const excludeTerms = [
    'dental', 'dentist', 'orthodont',
    'veterinary', 'animal', 'pet',
    'massage', 'spa resort', 'nail salon'
  ];

  for (const term of excludeTerms) {
    if (searchText.includes(term)) {
      REJECTED_NON_DERM++;
      return false;
    }
  }

  // Accept if skin_care_clinic type
  if (types.includes('skin_care_clinic')) {
    return true;
  }

  // Core dermatology terms
  const coreTerms = ['dermatology', 'dermatologist', 'dermatologic'];
  for (const term of coreTerms) {
    if (searchText.includes(term)) {
      return true;
    }
  }

  // Related terms in name or website
  const relatedTerms = [
    'skin clinic', 'skin center', 'skin care clinic',
    'skin doctor', 'skin specialist', 'skin health',
    'medical dermatology', 'cosmetic dermatology',
    'mohs surgery', 'skin cancer'
  ];

  for (const term of relatedTerms) {
    if (name.includes(term) || website.includes(term)) {
      return true;
    }
  }

  // Partial matches with medical context
  const hasDerm = searchText.includes('derm');
  const hasSkin = name.includes('skin') || website.includes('skin');
  const medicalContext =
    types.includes('doctor') ||
    types.includes('health') ||
    searchText.includes('medical') ||
    searchText.includes('clinic');

  if ((hasDerm || hasSkin) && medicalContext) {
    return true;
  }

  REJECTED_NON_DERM++;
  return false;
}

// ============================================================================
// Transform Place to Clinic Object
// ============================================================================

function transformPlace(place: any): any | null {
  const ac = parseAddressComponents(place.addressComponents ?? []);

  if (ac.country_code && ac.country_code !== 'US') return null;
  if (!ac.state_code || !VALID_US_STATES.has(ac.state_code)) return null;

  return {
    place_id: place.id ?? null,
    display_name: place.displayName?.text ?? null,
    formatted_address: place.formattedAddress ?? null,
    location: place.location
      ? { lat: place.location.latitude, lng: place.location.longitude }
      : null,
    primary_type: place.primaryType ?? null,
    types: place.types ?? [],
    rating: place.rating ?? null,
    user_rating_count: place.userRatingCount ?? null,
    current_open_now: place.currentOpeningHours?.openNow ?? null,
    phone: place.nationalPhoneNumber ?? null,
    international_phone_number: place.internationalPhoneNumber ?? null,
    opening_hours: place.regularOpeningHours
      ? {
          open_now: place.currentOpeningHours?.openNow ?? null,
          weekday_text: place.regularOpeningHours.weekdayDescriptions ?? [],
        }
      : null,
    website: place.websiteUri ?? null,
    google_maps_uri: place.googleMapsUri ?? null,
    business_status: place.businessStatus ?? null,
    accessibility_options: place.accessibilityOptions ?? null,
    parking_options: place.parkingOptions ?? null,
    payment_options: place.paymentOptions ?? null,
    price_level: place.priceLevel ?? null,
    city: ac.city,
    state_code: ac.state_code,
    postal_code: ac.postal_code,
    photos: (place.photos ?? []).map((ph: any) => ({
      name: ph.name,
      widthPx: ph.widthPx,
      heightPx: ph.heightPx,
    })),
    last_fetched_at: new Date().toISOString().slice(0, 10),
  };
}

// ============================================================================
// Strategy 1: Grid-Based Nearby Search
// ============================================================================

async function nearbySearchAtPoint(
  lat: number,
  lng: number,
  radiusMeters: number = 25000
): Promise<any[]> {
  await checkRequestLimit();

  const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': FIELD_MASK.replace('nextPageToken', '').replace(/,+/g, ','),
    },
    body: JSON.stringify({
      languageCode: 'en',
      regionCode: 'US',
      includedPrimaryTypes: ['doctor', 'health'],
      rankPreference: 'DISTANCE',
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Nearby search failed: ${response.status}`);
  }

  const data = await response.json();
  return (data.places || []).filter(isDermatologyClinic).map(transformPlace).filter((c: any) => c !== null);
}

async function gridSearchForState(stateInfo: StateInfo): Promise<Set<string>> {
  const { bounds } = stateInfo;
  const clinicIds = new Set<string>();
  
  // Calculate grid with ~25km spacing
  const latStep = 0.25; // ~27.5km
  const lngStep = 0.35; // ~27.5km at mid-latitudes

  console.log(`   🗺️  Grid search: ${stateInfo.name}`);
  let gridPoints = 0;
  let clinicsFound = 0;

  for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += latStep) {
    for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += lngStep) {
      try {
        gridPoints++;
        const clinics = await nearbySearchAtPoint(lat, lng, 25000);
        
        for (const clinic of clinics) {
          if (!clinicIds.has(clinic.place_id)) {
            clinicIds.add(clinic.place_id);
            clinicsFound++;
          }
        }

        // Progress indicator every 10 points
        if (gridPoints % 10 === 0) {
          process.stdout.write(`\r   📍 Grid points: ${gridPoints}, Clinics: ${clinicsFound}`);
        }
      } catch (error: any) {
        if (error.message.includes('Request limit')) {
          throw error;
        }
        console.error(`\n   ⚠️  Grid point (${lat.toFixed(2)}, ${lng.toFixed(2)}) failed: ${error.message}`);
      }
    }
  }

  console.log(`\n   ✅ Grid search complete: ${clinicsFound} unique clinics from ${gridPoints} points`);
  return clinicIds;
}

// ============================================================================
// Strategy 2: City-Level Text Search
// ============================================================================

async function textSearchCity(city: string, stateCode: string): Promise<any[]> {
  const allClinics: any[] = [];
  const queries = [
    `dermatology clinic in ${city} ${stateCode}`,
    `dermatologist ${city} ${stateCode}`,
    `skin clinic ${city} ${stateCode}`
  ];

  for (const query of queries) {
    let pageToken: string | undefined = undefined;
    let pages = 0;

    do {
      await checkRequestLimit();

      const body: any = {
        textQuery: query,
        pageSize: 20,
        languageCode: 'en',
        regionCode: 'US',
      };

      if (pageToken) body.pageToken = pageToken;

      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Text search failed: ${response.status}`);
      }

      const data = await response.json();
      const places = (data.places || [])
        .filter(isDermatologyClinic)
        .map(transformPlace)
        .filter((c: any) => c !== null);

      allClinics.push(...places);
      pages++;

      pageToken = data.nextPageToken;
      if (pageToken) {
        await sleep(NEXT_PAGE_DELAY_MS);
      }
    } while (pageToken && pages < 3); // Max 3 pages per query
  }

  return allClinics;
}

async function citySearchForState(stateInfo: StateInfo): Promise<Set<string>> {
  const clinicIds = new Set<string>();
  console.log(`   🏙️  City search: ${stateInfo.name}`);

  for (const city of stateInfo.majorCities) {
    try {
      const clinics = await textSearchCity(city, stateInfo.code);
      
      for (const clinic of clinics) {
        clinicIds.add(clinic.place_id);
      }

      console.log(`      ${city}: +${clinics.length} clinics`);
    } catch (error: any) {
      if (error.message.includes('Request limit')) {
        throw error;
      }
      console.error(`      ⚠️  ${city} failed: ${error.message}`);
    }
  }

  return clinicIds;
}

// ============================================================================
// Main Collection Function
// ============================================================================

async function collectStateData(stateCode: string): Promise<void> {
  const stateInfo = US_STATES[stateCode];
  if (!stateInfo) {
    console.error(`❌ Unknown state: ${stateCode}`);
    return;
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📍 Collecting: ${stateInfo.name} (${stateCode})`);
  console.log(`${'='.repeat(70)}`);

  const allClinicIds = new Set<string>();
  const clinicsById = new Map<string, any>();

  // Strategy 1: Grid-based nearby search
  try {
    console.log('\n🔷 STRATEGY 1: Grid-Based Nearby Search');
    const gridIds = await gridSearchForState(stateInfo);
    
    for (const id of gridIds) {
      allClinicIds.add(id);
    }
    
    console.log(`   Total unique clinics so far: ${allClinicIds.size}`);
  } catch (error: any) {
    console.error(`   ❌ Grid search error: ${error.message}`);
    if (error.message.includes('Request limit')) {
      throw error;
    }
  }

  // Strategy 2: City-level text search
  try {
    console.log('\n🔷 STRATEGY 2: City-Level Text Search');
    const cityIds = await citySearchForState(stateInfo);
    
    let newClinics = 0;
    for (const id of cityIds) {
      if (!allClinicIds.has(id)) {
        newClinics++;
      }
      allClinicIds.add(id);
    }
    
    console.log(`   Found ${newClinics} additional clinics from city search`);
    console.log(`   Total unique clinics: ${allClinicIds.size}`);
  } catch (error: any) {
    console.error(`   ❌ City search error: ${error.message}`);
    if (error.message.includes('Request limit')) {
      throw error;
    }
  }

  // Fetch details for all unique clinic IDs
  console.log(`\n🔄 Fetching details for ${allClinicIds.size} unique clinics...`);
  const clinics: any[] = [];
  let fetched = 0;

  for (const placeId of Array.from(allClinicIds)) {
    try {
      await checkRequestLimit();

      const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': FIELD_MASK.replace('nextPageToken', '').replace(/,+/g, ','),
        },
      });

      if (response.ok) {
        const place = await response.json();
        if (isDermatologyClinic(place)) {
          const clinic = transformPlace(place);
          if (clinic) {
            clinics.push(clinic);
            fetched++;

            if (fetched % 50 === 0) {
              process.stdout.write(`\r   ✅ Fetched: ${fetched}/${allClinicIds.size}`);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.message.includes('Request limit')) {
        throw error;
      }
    }
  }

  console.log(`\n   ✅ Successfully fetched: ${clinics.length} clinics`);

  // Save to file
  const outPath = path.join(OUT_DIR, `${stateCode.toLowerCase()}.json`);
  const payload = {
    state: stateInfo.name,
    state_code: stateCode,
    total: clinics.length,
    last_updated: new Date().toISOString(),
    clinics,
  };

  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`\n💾 Saved to: ${path.relative(process.cwd(), outPath)}`);
  console.log(`   📊 Total clinics: ${clinics.length}`);
  console.log(`   📞 With phone: ${clinics.filter((c: any) => c.phone).length}`);
  console.log(`   🌐 With website: ${clinics.filter((c: any) => c.website).length}`);
  console.log(`   ⭐ With rating: ${clinics.filter((c: any) => c.rating).length}`);
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  // Parse command line arguments
  const arg = process.argv.find((a) => a.startsWith('--states='));
  let statesToProcess: string[] = [];

  if (arg) {
    const statesArg = arg.split('=')[1];
    if (statesArg.toLowerCase() === 'all') {
      statesToProcess = Object.keys(US_STATES);
    } else {
      statesToProcess = statesArg.split(',').map((s) => s.trim().toUpperCase());
    }
  } else {
    console.error('\n❌ Missing --states argument');
    console.error('Usage:');
    console.error('  npx tsx scripts/collectClinicDataComprehensive.ts --states=CA,NY,TX');
    console.error('  npx tsx scripts/collectClinicDataComprehensive.ts --states=all');
    process.exit(1);
  }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║    COMPREHENSIVE DERMATOLOGY CLINIC DATA COLLECTION            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\n📋 States to process: ${statesToProcess.join(', ')}`);
  console.log(`⚙️  Rate limit: ${QPS} QPS`);
  console.log(`🛡️  Max requests: ${MAX_REQUESTS}`);
  console.log(`⏱️  Next page delay: ${NEXT_PAGE_DELAY_MS}ms`);
  console.log('');

  const startTime = Date.now();

  for (const stateCode of statesToProcess) {
    if (!US_STATES[stateCode]) {
      console.error(`❌ Unknown state: ${stateCode}, skipping`);
      continue;
    }

    try {
      await collectStateData(stateCode);
    } catch (error: any) {
      console.error(`\n❌ ${stateCode} collection failed: ${error.message}`);
      if (error.message.includes('Request limit')) {
        console.log('\n⛔ Request limit reached. Stopping collection.');
        break;
      }
    }
  }

  const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
  const estimatedCost = (TOTAL_REQUESTS * 0.032).toFixed(2);

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    COLLECTION COMPLETE                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`\n⏱️  Time elapsed: ${elapsedMin} minutes`);
  console.log(`📊 Total API requests: ${TOTAL_REQUESTS}`);
  console.log(`💰 Estimated cost: $${estimatedCost}`);
  console.log(`🚫 Rejected (non-US): ${REJECTED_NON_US}`);
  console.log(`🚫 Rejected (non-derm): ${REJECTED_NON_DERM}`);
  console.log('');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
