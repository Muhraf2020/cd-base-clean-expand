/**
 * Collect All Major States for Production
 * 
 * This script collects dermatology clinics for all major US states
 * that are likely to be used on your website.
 * 
 * Strategy: City-focused (fast, ~80-90% coverage)
 * Total time: ~2-3 hours for all 50 states
 * 
 * Usage:
 *   npx tsx scripts/collectAllStates.ts
 *   
 * Or collect specific states:
 *   npx tsx scripts/collectAllStates.ts --states=CA,NY,TX,FL,PA
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
const MAX_REQUESTS = 50000; // Higher limit for batch collection

// All 50 US states with major cities
const ALL_STATES = {
  AL: { name: 'Alabama', cities: ['Birmingham', 'Montgomery', 'Mobile', 'Huntsville', 'Tuscaloosa'] },
  AK: { name: 'Alaska', cities: ['Anchorage', 'Fairbanks', 'Juneau', 'Wasilla', 'Sitka'] },
  AZ: { name: 'Arizona', cities: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale', 'Tempe'] },
  AR: { name: 'Arkansas', cities: ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro'] },
  CA: { name: 'California', cities: ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 'Oakland', 'Fresno', 'Long Beach', 'Bakersfield', 'Anaheim', 'Santa Ana', 'Riverside', 'Stockton', 'Irvine', 'Chula Vista', 'Fremont', 'San Bernardino', 'Modesto', 'Fontana', 'Oxnard', 'Moreno Valley', 'Huntington Beach', 'Glendale', 'Santa Clarita', 'Garden Grove'] },
  CO: { name: 'Colorado', cities: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood', 'Thornton', 'Boulder'] },
  CT: { name: 'Connecticut', cities: ['Bridgeport', 'New Haven', 'Hartford', 'Stamford', 'Waterbury'] },
  DE: { name: 'Delaware', cities: ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Bear'] },
  FL: { name: 'Florida', cities: ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg', 'Hialeah', 'Tallahassee', 'Fort Lauderdale', 'Port St. Lucie', 'Cape Coral', 'Pembroke Pines', 'Hollywood', 'Miramar', 'Gainesville', 'Coral Springs'] },
  GA: { name: 'Georgia', cities: ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens', 'Sandy Springs', 'Macon'] },
  HI: { name: 'Hawaii', cities: ['Honolulu', 'Pearl City', 'Hilo', 'Kailua', 'Waipahu'] },
  ID: { name: 'Idaho', cities: ['Boise', 'Meridian', 'Nampa', 'Idaho Falls', 'Pocatello'] },
  IL: { name: 'Illinois', cities: ['Chicago', 'Aurora', 'Rockford', 'Joliet', 'Naperville', 'Springfield', 'Peoria'] },
  IN: { name: 'Indiana', cities: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel'] },
  IA: { name: 'Iowa', cities: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City'] },
  KS: { name: 'Kansas', cities: ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka'] },
  KY: { name: 'Kentucky', cities: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington'] },
  LA: { name: 'Louisiana', cities: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles'] },
  ME: { name: 'Maine', cities: ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn'] },
  MD: { name: 'Maryland', cities: ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Bowie'] },
  MA: { name: 'Massachusetts', cities: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell', 'Brockton'] },
  MI: { name: 'Michigan', cities: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor', 'Lansing'] },
  MN: { name: 'Minnesota', cities: ['Minneapolis', 'St. Paul', 'Rochester', 'Duluth', 'Bloomington'] },
  MS: { name: 'Mississippi', cities: ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi'] },
  MO: { name: 'Missouri', cities: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence'] },
  MT: { name: 'Montana', cities: ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte'] },
  NE: { name: 'Nebraska', cities: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney'] },
  NV: { name: 'Nevada', cities: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks'] },
  NH: { name: 'New Hampshire', cities: ['Manchester', 'Nashua', 'Concord', 'Derry', 'Rochester'] },
  NJ: { name: 'New Jersey', cities: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison', 'Trenton'] },
  NM: { name: 'New Mexico', cities: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell'] },
  NY: { name: 'New York', cities: ['New York', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 'Albany', 'New Rochelle', 'Mount Vernon', 'Schenectady', 'Utica', 'White Plains', 'Troy', 'Niagara Falls', 'Binghamton', 'Freeport'] },
  NC: { name: 'North Carolina', cities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville'] },
  ND: { name: 'North Dakota', cities: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo'] },
  OH: { name: 'Ohio', cities: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'] },
  OK: { name: 'Oklahoma', cities: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Lawton'] },
  OR: { name: 'Oregon', cities: ['Portland', 'Salem', 'Eugene', 'Gresham', 'Hillsboro', 'Beaverton'] },
  PA: { name: 'Pennsylvania', cities: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading', 'Scranton', 'Bethlehem', 'Lancaster', 'Harrisburg', 'Altoona', 'York', 'State College', 'Wilkes-Barre'] },
  RI: { name: 'Rhode Island', cities: ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence'] },
  SC: { name: 'South Carolina', cities: ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Rock Hill'] },
  SD: { name: 'South Dakota', cities: ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown'] },
  TN: { name: 'Tennessee', cities: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville'] },
  TX: { name: 'Texas', cities: ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Laredo', 'Lubbock', 'Garland', 'Irving', 'Amarillo', 'Grand Prairie', 'Brownsville', 'McKinney', 'Frisco', 'Pasadena', 'Mesquite'] },
  UT: { name: 'Utah', cities: ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem'] },
  VT: { name: 'Vermont', cities: ['Burlington', 'South Burlington', 'Rutland', 'Barre', 'Montpelier'] },
  VA: { name: 'Virginia', cities: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News', 'Alexandria'] },
  WA: { name: 'Washington', cities: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Kent', 'Everett'] },
  WV: { name: 'West Virginia', cities: ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg', 'Wheeling'] },
  WI: { name: 'Wisconsin', cities: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine'] },
  WY: { name: 'Wyoming', cities: ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs'] },
};

interface Clinic {
  id: string;
  name: string;
  formattedAddress?: string;
  location?: { latitude: number; longitude: number; };
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
  statesCompleted: string[];
  statesFailed: string[];
}

const stats: Stats = {
  totalRequests: 0,
  rejectedNonUS: 0,
  rejectedNonDerm: 0,
  startTime: Date.now(),
  statesCompleted: [],
  statesFailed: []
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
  return lowerName.includes('derm') || lowerName.includes('skin') || lowerName.includes('derma');
}

function isUSAddress(address: string | undefined): boolean {
  if (!address) return false;
  const lowerAddress = address.toLowerCase();
  const hasUSA = lowerAddress.includes('usa') || lowerAddress.includes('united states');
  const statePattern = /\b[A-Z]{2}\s+\d{5}\b/;
  const hasStateZip = statePattern.test(address);
  const stateNames = Object.values(ALL_STATES).map(s => s.name.toLowerCase());
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
    location: place.location ? { latitude: place.location.latitude, longitude: place.location.longitude } : undefined,
    phone: place.nationalPhoneNumber,
    website: place.websiteUri,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    types: place.types,
    businessStatus: place.businessStatus
  };
}

async function collectStateData(stateCode: string, stateInfo: any): Promise<boolean> {
  console.log(`\n📍 Collecting: ${stateInfo.name} (${stateCode})`);
  
  const clinics = new Map<string, Clinic>();
  const queries = ['dermatology', 'dermatologist', 'skin doctor'];
  
  for (const city of stateInfo.cities) {
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
            textQuery: `${query} in ${city} ${stateCode}`,
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
            if (clinic) clinics.set(clinic.id, clinic);
          });
        }
      } catch (error) {
        console.error(`   ⚠️  Query failed for ${city}:`, error);
      }
    }
  }
  
  // Save to file
  const outputDir = path.join(process.cwd(), 'data', 'clinics');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, `${stateCode.toLowerCase()}.json`);
  const clinicArray = Array.from(clinics.values());
  
  if (clinicArray.length === 0) {
    console.log(`   ⚠️  No clinics found for ${stateInfo.name}`);
    return false;
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(clinicArray, null, 2));
  
  const withPhone = clinicArray.filter(c => c.phone).length;
  const withWebsite = clinicArray.filter(c => c.website).length;
  
  console.log(`   ✅ Saved ${clinicArray.length} clinics | 📞 ${withPhone} | 🌐 ${withWebsite}`);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const statesArg = args.find(arg => arg.startsWith('--states='));
  
  let statesToProcess: string[];
  if (statesArg) {
    const statesValue = statesArg.split('=')[1];
    statesToProcess = statesValue === 'all' 
      ? Object.keys(ALL_STATES)
      : statesValue.split(',').map(s => s.trim().toUpperCase());
  } else {
    // Default: collect all states
    statesToProcess = Object.keys(ALL_STATES);
  }
  
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         BATCH COLLECTION - ALL US STATES                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`📋 States to process: ${statesToProcess.length} states`);
  console.log(`⚙️  Rate limit: ${RATE_LIMIT_QPS} QPS`);
  console.log(`⏱️  Estimated time: ~${(statesToProcess.length * 2).toFixed(0)} minutes`);
  console.log('');
  
  let completed = 0;
  for (const stateCode of statesToProcess) {
    const stateInfo = ALL_STATES[stateCode as keyof typeof ALL_STATES];
    if (!stateInfo) {
      console.error(`❌ Unknown state code: ${stateCode}`);
      stats.statesFailed.push(stateCode);
      continue;
    }
    
    try {
      const success = await collectStateData(stateCode, stateInfo);
      if (success) {
        stats.statesCompleted.push(stateCode);
        completed++;
        
        // Progress update
        const progress = ((completed / statesToProcess.length) * 100).toFixed(1);
        const elapsed = ((Date.now() - stats.startTime) / 60000).toFixed(1);
        console.log(`   📊 Progress: ${completed}/${statesToProcess.length} (${progress}%) | Time: ${elapsed}m`);
      } else {
        stats.statesFailed.push(stateCode);
      }
    } catch (error) {
      console.error(`❌ Error collecting ${stateCode}:`, error);
      stats.statesFailed.push(stateCode);
    }
  }
  
  const elapsedMin = ((Date.now() - stats.startTime) / 60000).toFixed(1);
  const estimatedCost = (stats.totalRequests * 0.032).toFixed(2);
  
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    COLLECTION COMPLETE                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`✅ States completed: ${stats.statesCompleted.length}`);
  console.log(`❌ States failed: ${stats.statesFailed.length}`);
  if (stats.statesFailed.length > 0) {
    console.log(`   Failed states: ${stats.statesFailed.join(', ')}`);
  }
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