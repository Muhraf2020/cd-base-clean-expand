/**
 * Mark Clinics as Featured
 * 
 * This script helps you mark specific clinics as featured
 * for promotional purposes.
 * 
 * Usage:
 *   npx tsx scripts/markFeaturedClinics.ts --ids=PLACE_ID1,PLACE_ID2,PLACE_ID3
 *   npx tsx scripts/markFeaturedClinics.ts --city="Los Angeles" --state=CA --top=10
 *   npx tsx scripts/markFeaturedClinics.ts --unfeature=PLACE_ID1,PLACE_ID2
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================================
// Helper Functions
// ============================================================================

async function markFeatured(placeIds: string[]) {
  console.log(`\n📌 Marking ${placeIds.length} clinics as featured...`);

  const { data, error } = await supabase
    .from('clinics')
    .update({ featured_clinic: true })
    .in('place_id', placeIds)
    .select('place_id, display_name, city, state_code');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✅ Successfully marked as featured:');
  data?.forEach((clinic, i) => {
    console.log(`   ${i + 1}. ${clinic.display_name} (${clinic.city}, ${clinic.state_code})`);
  });
}

async function unfeatureClinics(placeIds: string[]) {
  console.log(`\n📌 Removing featured status from ${placeIds.length} clinics...`);

  const { data, error } = await supabase
    .from('clinics')
    .update({ featured_clinic: false })
    .in('place_id', placeIds)
    .select('place_id, display_name, city, state_code');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✅ Successfully removed featured status:');
  data?.forEach((clinic, i) => {
    console.log(`   ${i + 1}. ${clinic.display_name} (${clinic.city}, ${clinic.state_code})`);
  });
}

async function featureTopInCity(city: string, stateCode: string, count: number) {
  console.log(`\n📌 Featuring top ${count} clinics in ${city}, ${stateCode}...`);

  // Get top-rated clinics with most reviews
  const { data, error } = await supabase
    .from('clinics')
    .select('place_id, display_name, rating, user_rating_count, city, state_code')
    .eq('city', city)
    .eq('state_code', stateCode)
    .eq('business_status', 'OPERATIONAL')
    .not('rating', 'is', null)
    .order('rating', { ascending: false })
    .order('user_rating_count', { ascending: false })
    .limit(count);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No clinics found in this city');
    return;
  }

  const placeIds = data.map(c => c.place_id);
  
  // Mark them as featured
  const { error: updateError } = await supabase
    .from('clinics')
    .update({ featured_clinic: true })
    .in('place_id', placeIds);

  if (updateError) {
    console.error('❌ Error:', updateError.message);
    return;
  }

  console.log(`✅ Successfully featured ${data.length} clinics:`);
  data.forEach((clinic, i) => {
    console.log(`   ${i + 1}. ${clinic.display_name} - ⭐ ${clinic.rating} (${clinic.user_rating_count} reviews)`);
  });
}

async function listFeaturedClinics() {
  console.log('\n📋 Listing all featured clinics...\n');

  const { data, error } = await supabase
    .from('clinics')
    .select('place_id, display_name, city, state_code, rating, user_rating_count')
    .eq('featured_clinic', true)
    .order('state_code')
    .order('city')
    .order('rating', { ascending: false });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No featured clinics found');
    return;
  }

  console.log(`Total featured clinics: ${data.length}\n`);

  // Group by state and city
  const grouped: Record<string, Record<string, typeof data>> = {};
  data.forEach(clinic => {
    if (!grouped[clinic.state_code]) {
      grouped[clinic.state_code] = {};
    }
    if (!grouped[clinic.state_code][clinic.city]) {
      grouped[clinic.state_code][clinic.city] = [];
    }
    grouped[clinic.state_code][clinic.city].push(clinic);
  });

  Object.entries(grouped).forEach(([state, cities]) => {
    console.log(`\n${state}:`);
    Object.entries(cities).forEach(([city, clinics]) => {
      console.log(`  ${city} (${clinics.length} featured):`);
      clinics.forEach((clinic, i) => {
        console.log(`    ${i + 1}. ${clinic.display_name} - ⭐ ${clinic.rating || 'N/A'}`);
        console.log(`       ID: ${clinic.place_id}`);
      });
    });
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           FEATURED CLINICS MANAGEMENT TOOL                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const args = process.argv.slice(2);

  // Parse arguments
  const idsArg = args.find(a => a.startsWith('--ids='));
  const unfeatureArg = args.find(a => a.startsWith('--unfeature='));
  const cityArg = args.find(a => a.startsWith('--city='));
  const stateArg = args.find(a => a.startsWith('--state='));
  const topArg = args.find(a => a.startsWith('--top='));
  const listArg = args.includes('--list');

  if (listArg) {
    await listFeaturedClinics();
    return;
  }

  if (idsArg) {
    const ids = idsArg.split('=')[1].split(',').map(id => id.trim());
    await markFeatured(ids);
    return;
  }

  if (unfeatureArg) {
    const ids = unfeatureArg.split('=')[1].split(',').map(id => id.trim());
    await unfeatureClinics(ids);
    return;
  }

  if (cityArg && stateArg && topArg) {
    const city = cityArg.split('=')[1];
    const state = stateArg.split('=')[1];
    const count = parseInt(topArg.split('=')[1]);
    await featureTopInCity(city, state, count);
    return;
  }

  // Show usage
  console.log('\n📖 Usage Examples:\n');
  console.log('1. List all featured clinics:');
  console.log('   npx tsx scripts/markFeaturedClinics.ts --list\n');
  
  console.log('2. Mark specific clinics as featured by ID:');
  console.log('   npx tsx scripts/markFeaturedClinics.ts --ids=ChIJ123,ChIJ456,ChIJ789\n');
  
  console.log('3. Feature top 10 clinics in a city:');
  console.log('   npx tsx scripts/markFeaturedClinics.ts --city="Los Angeles" --state=CA --top=10\n');
  
  console.log('4. Remove featured status:');
  console.log('   npx tsx scripts/markFeaturedClinics.ts --unfeature=ChIJ123,ChIJ456\n');
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
