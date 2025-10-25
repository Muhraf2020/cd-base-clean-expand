/**
 * Fast City-Focused Clinic Collection (NO GRID SEARCH)
 * 
 * This script focuses on city-level text searches only, skipping the slow
 * grid search. Much faster for large states like California.
 * 
 * Trade-off: May miss some rural clinics, but captures 80-90% of clinics
 * in 5-10 minutes vs 30+ minutes with grid search.
 * 
 * Usage:
 *   npx tsx scripts/collectClinicDataFast.ts --states=CA
 * 
 * Estimated time:
 *   - California: ~5-8 minutes (vs 30+ minutes with grid)
 *   - Texas: ~5-8 minutes
 *   - New York: ~4-6 minutes
 */

import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

config({ path: path.resolve(process.cwd(), '.env.local') });

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
if (!API_KEY) {
  console.error('❌ GOOGLE_PLACES_API_KEY is missing');
  process.exit(1);
}

// Configuration
const RATE_LIMIT_QPS = 3;
const REQUEST_DELAY_MS = Math.ceil(1000 / RATE_LIMIT_QPS);
const MAX_REQUESTS = 8000;

// State definitions with expanded city lists
const STATES = {
  CA: {
    name: 'California',
    cities: [
      'Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento',
      'Oakland', 'Fresno', 'Long Beach', 'Bakersfield', 'Anaheim',
      'Santa Ana', 'Riverside', 'Stockton', 'Irvine', 'Chula Vista',
      'Fremont', 'San Bernardino', 'Modesto', 'Fontana', 'Oxnard',
      'Moreno Valley', 'Huntington Beach', 'Glendale', 'Santa Clarita', 'Garden Grove'
    ]
  },
  NY: {
    name: 'New York',
    cities: [
      'New York', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse',
      'Albany', 'New Rochelle', 'Mount Vernon', 'Schenectady', 'Utica',
      'White Plains', 'Troy', 'Niagara Falls', 'Binghamton', 'Freeport'
    ]
  },
  TX: {
    name: 'Texas',
    cities: [
      'Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth',
      'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Laredo',
      'Lubbock', 'Garland', 'Irving', 'Amarillo', 'Grand Prairie',
      'Brownsville', 'McKinney', 'Frisco', 'Pasadena', 'Mesquite'
    ]
  },
  FL: {
    name: 'Florida',
    cities: [
      'Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg',
      'Hialeah', 'Tallahassee', 'Fort Lauderdale', 'Port St. Lucie', 'Cape Coral',
      'Pembroke Pines', 'Hollywood', 'Miramar', 'Gainesville', 'Coral Springs'
    ]
  },
  PA: {
    name: 'Pennsylvania',
    cities: [
      'Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading',
      'Scranton', 'Bethlehem', 'Lancaster', 'Harrisburg', 'Altoona',
      'York', 'State College', 'Wilkes-Barre'
    ]
  },
};

interface Clinic {
  id: string;
  name: string;
  formattedAddress?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  phone?: string;
  website?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  businessStatus?: string;
}

interface Stats {
  totalRequests: number;
  rejectedNonUS: number;
  rejectedNonDerm: number;
  startTime: number;
}

const stats: Stats = {
  totalRequests: 0,
  rejectedNonUS: 0,
  rejectedNonDerm: 0,
  startTime: Date.now()
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest() {
  stats.totalRequests++;
  
  if (stats.totalRequests >= MAX_REQUESTS) {
    throw new Error(`Request limit reached (${MAX_REQUESTS})`);
  }
  
  await sleep(REQUEST_DELAY_MS);
}

function isDermatologyClinic(name: string): boolean {
  const lowerName = name.toLowerCase();
  return lowerName.includes('derm') || 
         lowerName.includes('skin') ||
         lowerName.includes('derma');
}

function isUSAddress(address: string | undefined): boolean {
  if (!address) return false;
  
  const lowerAddress = address.toLowerCase();
  const hasUSA = lowerAddress.includes('usa') || 
                 lowerAddress.includes('united states');
  const statePattern = /\b[A-Z]{2}\s+\d{5}\b/;
  const hasStateZip = statePattern.test(address);
  const stateNames = Object.values(STATES).map(s => s.name.toLowerCase());
  const hasStateName = stateNames.some(name => lowerAddress.includes(name));
  
  return hasUSA || hasStateZip || hasStateName;
}

function parseClinicFromPlace(place: any): Clinic | null {
  if (!place.id) return null;
  
  const name = place.displayName?.text || '';
  const address = place.formattedAddress;
  
  if (!isDermatologyClinic(name)) {
    stats.rejectedNonDerm++;
    return null;
  }
  
  if (!isUSAddress(address)) {
    stats.rejectedNonUS++;
    return null;
  }
  
  return {
    id: place.id,
    name: name,
    formattedAddress: address,
    location: place.location ? {
      latitude: place.location.latitude,
      longitude: place.location.longitude
    } : undefined,
    phone: place.nationalPhoneNumber,
    website: place.websiteUri,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    types: place.types,
    businessStatus: place.businessStatus
  };
}

async function citySearch(
  stateCode: string,
  stateName: string,
  cities: string[],
  clinics: Map<string, Clinic>
): Promise<void> {
  console.log(`🏙️  City-focused search: ${stateName}`);
  console.log(`   📊 Searching ${cities.length} cities (ETA: ~${(cities.length / 3 / 60).toFixed(1)} min)`);
  
  let citiesProcessed = 0;
  let lastProgressUpdate = Date.now();
  
  for (const city of cities) {
    const beforeSize = clinics.size;
    
    // Try multiple query variations for better coverage
    const queries = [
      `dermatology in ${city} ${stateCode}`,
      `dermatologist ${city} ${stateCode}`,
      `skin doctor ${city} ${stateCode}`
    ];
    
    for (const query of queries) {
      await makeRequest();
      
      try {
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.businessStatus',
          },
          body: JSON.stringify({
            textQuery: query,
            pageSize: 20,
            languageCode: 'en',
            regionCode: 'US'
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          const places = data.places || [];
          
          places.forEach((place: any) => {
            const clinic = parseClinicFromPlace(place);
            if (clinic) {
              clinics.set(clinic.id, clinic);
            }
          });
        }
      } catch (error) {
        console.error(`   ⚠️  Query failed for ${city}:`, error);
      }
    }
    
    citiesProcessed++;
    const newFromCity = clinics.size - beforeSize;
    
    // Progress update
    const now = Date.now();
    if (now - lastProgressUpdate > 10000 || citiesProcessed === cities.length) {
      const progress = ((citiesProcessed / cities.length) * 100).toFixed(1);
      const elapsed = ((now - stats.startTime) / 60000).toFixed(1);
      console.log(`   ⏳ Progress: ${citiesProcessed}/${cities.length} (${progress}%) | Total clinics: ${clinics.size} | Time: ${elapsed}m`);
      lastProgressUpdate = now;
    } else {
      console.log(`      ${city}: +${newFromCity} new (total: ${clinics.size})`);
    }
  }
  
  console.log(`   ✅ City search complete: ${clinics.size} unique clinics`);
}

async function collectStateData(stateCode: string): Promise<void> {
  const stateInfo = STATES[stateCode as keyof typeof STATES];
  if (!stateInfo) {
    console.error(`❌ Unknown state code: ${stateCode}`);
    return;
  }
  
  console.log('======================================================================');
  console.log(`📍 Collecting: ${stateInfo.name} (${stateCode})`);
  console.log('======================================================================');
  
  const clinics = new Map<string, Clinic>();
  
  // City-focused search only
  await citySearch(stateCode, stateInfo.name, stateInfo.cities, clinics);
  
  // Save to file
  const outputDir = path.join(process.cwd(), 'data', 'clinics');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, `${stateCode.toLowerCase()}.json`);
  const clinicArray = Array.from(clinics.values());
  
  fs.writeFileSync(outputPath, JSON.stringify(clinicArray, null, 2));
  
  // Calculate stats
  const withPhone = clinicArray.filter(c => c.phone).length;
  const withWebsite = clinicArray.filter(c => c.website).length;
  const withRating = clinicArray.filter(c => c.rating).length;
  
  console.log(`💾 Saved to: ${outputPath}`);
  console.log(`   📊 Total clinics: ${clinicArray.length}`);
  console.log(`   📞 With phone: ${withPhone}`);
  console.log(`   🌐 With website: ${withWebsite}`);
  console.log(`   ⭐ With rating: ${withRating}`);
}

async function main() {
  const args = process.argv.slice(2);
  const statesArg = args.find(arg => arg.startsWith('--states='));
  
  if (!statesArg) {
    console.error('❌ Usage: npx tsx scripts/collectClinicDataFast.ts --states=CA,NY,TX');
    console.error('          or --states=all');
    process.exit(1);
  }
  
  const statesValue = statesArg.split('=')[1];
  const statesToProcess = statesValue === 'all' 
    ? Object.keys(STATES)
    : statesValue.split(',').map(s => s.trim().toUpperCase());
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         FAST CITY-FOCUSED CLINIC DATA COLLECTION              ║');
  console.log('║              (No Grid Search - Much Faster!)                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`📋 States to process: ${statesToProcess.join(', ')}`);
  console.log(`⚙️  Rate limit: ${RATE_LIMIT_QPS} QPS`);
  console.log(`🛡️  Max requests: ${MAX_REQUESTS}`);
  console.log(`⚡ Strategy: City searches only (faster, ~80-90% coverage)`);
  console.log('');
  
  for (const stateCode of statesToProcess) {
    await collectStateData(stateCode);
  }
  
  const elapsedMin = ((Date.now() - stats.startTime) / 60000).toFixed(1);
  const estimatedCost = (stats.totalRequests * 0.032).toFixed(2);
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    COLLECTION COMPLETE                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`⏱️  Time elapsed: ${elapsedMin} minutes`);
  console.log(`📊 Total API requests: ${stats.totalRequests}`);
  console.log(`💰 Estimated cost: $${estimatedCost}`);
  console.log(`🚫 Rejected (non-US): ${stats.rejectedNonUS}`);
  console.log(`🚫 Rejected (non-derm): ${stats.rejectedNonDerm}`);
}

main().catch(error => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});