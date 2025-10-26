/**
 * FINAL Dermatology Clinic Data Collection Script (amenities-optimized)
 *
 * Changes vs your version:
 *  - Adds US-wide locationBias to text search (better business-style results)
 *  - Adds details hydration per place ONLY when amenities are missing
 *  - Adds third query ("dermatologist in ...") without altering overall flow
 *  - Does NOT change output shape or your site-integrations
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
const MAX_REQUESTS = Number(process.env.PLACES_MAX_REQUESTS || 8000);

let TOTAL_REQUESTS = 0;
let REJECTED_NON_US = 0;
let REJECTED_NON_DERM = 0;

// Field mask for Text Search responses (header)
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

// ============================================================================
// State Information with Top Cities
// ============================================================================

interface StateInfo {
  code: string;
  name: string;
  cities: string[];
}

const US_STATES: Record<string, StateInfo> = {
  AL: { code: 'AL', name: 'Alabama', cities: ['Birmingham', 'Montgomery', 'Mobile', 'Huntsville', 'Tuscaloosa'] },
  AK: { code: 'AK', name: 'Alaska', cities: ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan'] },
  AZ: { code: 'AZ', name: 'Arizona', cities: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale', 'Gilbert', 'Tempe'] },
  AR: { code: 'AR', name: 'Arkansas', cities: ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro'] },
  CA: { code: 'CA', name: 'California', cities: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland', 'Fresno', 'Bakersfield', 'Anaheim', 'Santa Ana', 'Riverside', 'Stockton', 'Irvine', 'Chula Vista', 'Fremont', 'San Bernardino', 'Modesto', 'Fontana', 'Moreno Valley', 'Huntington Beach', 'Glendale', 'Santa Clarita', 'Oxnard', 'Oceanside', 'Garden Grove'] },
  CO: { code: 'CO', name: 'Colorado', cities: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood', 'Thornton', 'Pueblo'] },
  CT: { code: 'CT', name: 'Connecticut', cities: ['Bridgeport', 'New Haven', 'Stamford', 'Hartford', 'Waterbury'] },
  DE: { code: 'DE', name: 'Delaware', cities: ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Smyrna'] },
  FL: { code: 'FL', name: 'Florida', cities: ['Miami', 'Tampa', 'Orlando', 'Jacksonville', 'St. Petersburg', 'Hialeah', 'Tallahassee', 'Fort Lauderdale', 'Port St. Lucie', 'Cape Coral', 'Pembroke Pines', 'Hollywood', 'Miramar', 'Coral Springs', 'Clearwater'] },
  GA: { code: 'GA', name: 'Georgia', cities: ['Atlanta', 'Augusta', 'Columbus', 'Macon', 'Savannah', 'Athens', 'Sandy Springs', 'Roswell'] },
  HI: { code: 'HI', name: 'Hawaii', cities: ['Honolulu', 'Pearl City', 'Hilo', 'Kailua', 'Waipahu'] },
  ID: { code: 'ID', name: 'Idaho', cities: ['Boise', 'Meridian', 'Nampa', 'Idaho Falls', 'Pocatello'] },
  IL: { code: 'IL', name: 'Illinois', cities: ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Springfield', 'Peoria', 'Elgin'] },
  IN: { code: 'IN', name: 'Indiana', cities: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel'] },
  IA: { code: 'IA', name: 'Iowa', cities: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City'] },
  KS: { code: 'KS', name: 'Kansas', cities: ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka'] },
  KY: { code: 'KY', name: 'Kentucky', cities: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington'] },
  LA: { code: 'LA', name: 'Louisiana', cities: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles'] },
  ME: { code: 'ME', name: 'Maine', cities: ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn'] },
  MD: { code: 'MD', name: 'Maryland', cities: ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Bowie'] },
  MA: { code: 'MA', name: 'Massachusetts', cities: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell', 'Brockton', 'Quincy'] },
  MI: { code: 'MI', name: 'Michigan', cities: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor', 'Lansing', 'Flint'] },
  MN: { code: 'MN', name: 'Minnesota', cities: ['Minneapolis', 'St. Paul', 'Rochester', 'Duluth', 'Bloomington'] },
  MS: { code: 'MS', name: 'Mississippi', cities: ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi'] },
  MO: { code: 'MO', name: 'Missouri', cities: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence'] },
  MT: { code: 'MT', name: 'Montana', cities: ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte'] },
  NE: { code: 'NE', name: 'Nebraska', cities: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney'] },
  NV: { code: 'NV', name: 'Nevada', cities: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks'] },
  NH: { code: 'NH', name: 'New Hampshire', cities: ['Manchester', 'Nashua', 'Concord', 'Derry', 'Rochester'] },
  NJ: { code: 'NJ', name: 'New Jersey', cities: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison', 'Woodbridge', 'Lakewood'] },
  NM: { code: 'NM', name: 'New Mexico', cities: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell'] },
  NY: { code: 'NY', name: 'New York', cities: ['New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany', 'New Rochelle'] },
  NC: { code: 'NC', name: 'North Carolina', cities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville', 'Cary'] },
  ND: { code: 'ND', name: 'North Dakota', cities: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo'] },
  OH: { code: 'OH', name: 'Ohio', cities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton', 'Parma'] },
  OK: { code: 'OK', name: 'Oklahoma', cities: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Edmond'] },
  OR: { code: 'OR', name: 'Oregon', cities: ['Portland', 'Salem', 'Eugene', 'Gresham', 'Hillsboro', 'Beaverton'] },
  PA: { code: 'PA', name: 'Pennsylvania', cities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading', 'Scranton'] },
  RI: { code: 'RI', name: 'Rhode Island', cities: ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence'] },
  SC: { code: 'SC', name: 'South Carolina', cities: ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Rock Hill'] },
  SD: { code: 'SD', name: 'South Dakota', cities: ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown'] },
  TN: { code: 'TN', name: 'Tennessee', cities: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville', 'Murfreesboro'] },
  TX: { code: 'TX', name: 'Texas', cities: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Lubbock', 'Irving', 'Laredo', 'Garland', 'Frisco', 'McKinney'] },
  UT: { code: 'UT', name: 'Utah', cities: ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem'] },
  VT: { code: 'VT', name: 'Vermont', cities: ['Burlington', 'South Burlington', 'Rutland', 'Barre', 'Montpelier'] },
  VA: { code: 'VA', name: 'Virginia', cities: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News', 'Alexandria', 'Hampton'] },
  WA: { code: 'WA', name: 'Washington', cities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Kent', 'Everett'] },
  WV: { code: 'WV', name: 'West Virginia', cities: ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg', 'Wheeling'] },
  WI: { code: 'WI', name: 'Wisconsin', cities: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine'] },
  WY: { code: 'WY', name: 'Wyoming', cities: ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs'] },
  DC: { code: 'DC', name: 'Washington DC', cities: ['Washington'] }
};

const VALID_US_STATES = new Set(Object.keys(US_STATES));

// ============================================================================
// Helper Functions
// ============================================================================

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
// Dermatology Filtering
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
    'dental', 'dentist', 'orthodont', 'oral surgery',
    'veterinary', 'animal clinic', 'pet clinic',
    'massage', 'spa resort', 'day spa', 'nail salon',
    'hair salon', 'barber'
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

  // Related terms
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
    const isStore = types.includes('store') || types.includes('beauty_supply_store');
    if (isStore) {
      REJECTED_NON_DERM++;
      return false;
    }
    return true;
  }

  REJECTED_NON_DERM++;
  return false;
}

// ============================================================================
// Transform Place to Clinic (keeps your output shape identical)
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
// Details Hydration (only when amenities are missing)
// ============================================================================

async function hydratePlace(placeId: string): Promise<any> {
  // Respect global QPS / budget
  await checkRequestLimit();

  // For the Details endpoint, use `fields` query param (not header mask)
  const detailsFields = [
    'id',
    'displayName',
    'formattedAddress',
    'addressComponents',
    'location',
    'primaryType',
    'types',
    'rating',
    'userRatingCount',
    'currentOpeningHours',
    'regularOpeningHours.weekdayDescriptions',
    'nationalPhoneNumber',
    'internationalPhoneNumber',
    'websiteUri',
    'googleMapsUri',
    'businessStatus',
    'accessibilityOptions',
    'parkingOptions',
    'paymentOptions',
    'priceLevel',
    'photos'
  ].join(',');

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=${encodeURIComponent(detailsFields)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-Goog-Api-Key': API_KEY }
  });

  if (!res.ok) throw new Error(`Details failed: ${res.status}`);
  return res.json(); // returns a single Place object
}

function amenitiesMissing(c: any): boolean {
  return !c?.accessibility_options && !c?.parking_options && !c?.payment_options;
}

// ============================================================================
// Text Search
// ============================================================================

async function textSearchCity(city: string, stateCode: string): Promise<any[]> {
  const allClinics: any[] = [];
  const seen = new Set<string>();

  // Added third query for better coverage; keeps your overall flow the same
  const queries = [
    `dermatology in ${city} ${stateCode}`,
    `dermatologist in ${city} ${stateCode}`,
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
        // US rectangle bias to favor well-populated US business profiles
        locationBias: {
          rectangle: {
            low:  { latitude: 18.0, longitude: -180.0 },
            high: { latitude: 72.0, longitude:  -66.0 }
          }
        }
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

      // First pass: filter & transform what the search returned
      const basePlaces = (data.places || []).filter(isDermatologyClinic);

      for (const p of basePlaces) {
        let clinic = transformPlace(p);
        if (!clinic) continue;

        // Hydrate ONLY if amenities are missing
        if (amenitiesMissing(clinic) && clinic.place_id) {
          try {
            const hydrated = await hydratePlace(clinic.place_id);
            const enriched = transformPlace(hydrated);
            if (enriched) {
              // merge, keeping transformPlace shape consistent
              clinic = { ...clinic, ...enriched };
            }
          } catch {
            // swallow hydration errors; keep sparse clinic
          }
        }

        if (!seen.has(clinic.place_id)) {
          seen.add(clinic.place_id);
          allClinics.push(clinic);
        }
      }

      pages++;
      pageToken = data.nextPageToken;

      if (pageToken) {
        await sleep(1200); // Delay between pages
      }
    } while (pageToken && pages < 3); // Keep your original page cap
  }

  return allClinics;
}

// ============================================================================
// State Collection
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

  const allClinics = new Map<string, any>();
  const startTime = Date.now();

  console.log(`🏙️  City-focused search: ${stateInfo.name}`);
  console.log(`   📊 Searching ${stateInfo.cities.length} cities (ETA: ~${(stateInfo.cities.length * 0.3).toFixed(1)} min)`);

  let cityIndex = 0;
  for (const city of stateInfo.cities) {
    try {
      cityIndex++;
      const clinics = await textSearchCity(city, stateCode);

      let newCount = 0;
      for (const clinic of clinics) {
        if (!allClinics.has(clinic.place_id)) {
          newCount++;
          allClinics.set(clinic.place_id, clinic);
        }
      }

      console.log(`      ${city}: +${newCount} new (total: ${allClinics.size})`);

      // Progress indicator
      if (cityIndex % 4 === 0) {
        const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
        const progress = ((cityIndex / stateInfo.cities.length) * 100).toFixed(1);
        console.log(`   ⏳ Progress: ${cityIndex}/${stateInfo.cities.length} (${progress}%) | Total clinics: ${allClinics.size} | Time: ${elapsed}m`);
      }
    } catch (error: any) {
      if (error.message.includes('Request limit')) {
        throw error;
      }
      console.error(`      ⚠️  ${city} failed: ${error.message}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`   ⏳ Progress: ${stateInfo.cities.length}/${stateInfo.cities.length} (100.0%) | Total clinics: ${allClinics.size} | Time: ${elapsed}m`);
  console.log(`   ✅ City search complete: ${allClinics.size} unique clinics`);

  // Save to file
  const clinicArray = Array.from(allClinics.values());
  const outPath = path.join(OUT_DIR, `${stateCode.toLowerCase()}.json`);
  const payload = {
    state: stateInfo.name,
    state_code: stateCode,
    total: clinicArray.length,
    last_updated: new Date().toISOString(),
    clinics: clinicArray,
  };

  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(`💾 Saved to: ${path.relative(process.cwd(), outPath)}`);
  console.log(`   📊 Total clinics: ${clinicArray.length}`);
  console.log(`   📞 With phone: ${clinicArray.filter(c => c.phone).length}`);
  console.log(`   🌐 With website: ${clinicArray.filter(c => c.website).length}`);
  console.log(`   ⭐ With rating: ${clinicArray.filter(c => c.rating).length}`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

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
    console.error('  npx tsx scripts/collectClinicDataFinal.ts --states=CA');
    console.error('  npx tsx scripts/collectClinicDataFinal.ts --states=CA,NY,TX');
    console.error('  npx tsx scripts/collectClinicDataFinal.ts --states=all');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         FAST CITY-FOCUSED CLINIC DATA COLLECTION              ║');
  console.log('║              (No Grid Search - Much Faster!)                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`📋 States to process: ${statesToProcess.join(', ')}`);
  console.log(`⚙️  Rate limit: ${QPS} QPS`);
  console.log(`🛡️  Max requests: ${MAX_REQUESTS}`);
  console.log(`⚡ Strategy: City searches only (faster, ~80-90% coverage)`);
  console.log('');

  const globalStart = Date.now();

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

  const totalElapsed = ((Date.now() - globalStart) / 60000).toFixed(1);
  const estimatedCost = (TOTAL_REQUESTS * 0.032).toFixed(2);

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    COLLECTION COMPLETE                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`⏱️  Time elapsed: ${totalElapsed} minutes`);
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
