/**
 * Auto-Feature Top Clinics in Each City
 * 
 * This script automatically marks the top 10 clinics in EVERY city
 * across ALL states as featured, sorted by rating and review count.
 * 
 * Usage:
 *   npx tsx scripts/autoFeatureTopClinics.ts
 *   npx tsx scripts/autoFeatureTopClinics.ts --dry-run  (preview without making changes)
 *   npx tsx scripts/autoFeatureTopClinics.ts --top=5     (feature top 5 instead of 10)
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
// Configuration
// ============================================================================

const DEFAULT_TOP_COUNT = 10;

// ============================================================================
// Main Logic
// ============================================================================

async function getAllCitiesWithClinics() {
  console.log('📊 Fetching all cities with clinics...\n');

  const { data, error } = await supabase
    .from('clinics')
    .select('city, state_code')
    .eq('business_status', 'OPERATIONAL')
    .not('city', 'is', null)
    .not('state_code', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch cities: ${error.message}`);
  }

  // Get unique city/state combinations
  const cityStateSet = new Set<string>();
  const cityStateList: Array<{ city: string; state: string }> = [];

  data?.forEach(clinic => {
    const key = `${clinic.city}|${clinic.state_code}`;
    if (!cityStateSet.has(key)) {
      cityStateSet.add(key);
      cityStateList.push({
        city: clinic.city,
        state: clinic.state_code,
      });
    }
  });

  console.log(`✅ Found ${cityStateList.length} unique cities across all states\n`);
  return cityStateList;
}

async function getTopClinicsForCity(
  city: string,
  state: string,
  topCount: number
): Promise<string[]> {
  const { data, error } = await supabase
    .from('clinics')
    .select('place_id, display_name, rating, user_rating_count')
    .eq('city', city)
    .eq('state_code', state)
    .eq('business_status', 'OPERATIONAL')
    .not('rating', 'is', null) // Must have a rating
    .order('rating', { ascending: false })
    .order('user_rating_count', { ascending: false })
    .limit(topCount);

  if (error) {
    console.error(`   ⚠️  Error fetching clinics for ${city}, ${state}: ${error.message}`);
    return [];
  }

  return (data || []).map(c => c.place_id);
}

async function resetAllFeaturedStatus() {
  console.log('🔄 Resetting all featured_clinic flags to false...\n');

  const { error } = await supabase
    .from('clinics')
    .update({ featured_clinic: false })
    .eq('featured_clinic', true);

  if (error) {
    throw new Error(`Failed to reset featured status: ${error.message}`);
  }

  console.log('✅ All featured flags reset\n');
}

async function markClinicsAsFeatured(placeIds: string[]) {
  if (placeIds.length === 0) return { success: 0, errors: 0 };

  // Update in batches of 100
  const BATCH_SIZE = 100;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < placeIds.length; i += BATCH_SIZE) {
    const batch = placeIds.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('clinics')
      .update({ featured_clinic: true })
      .in('place_id', batch);

    if (error) {
      console.error(`   ⚠️  Batch error: ${error.message}`);
      errorCount += batch.length;
    } else {
      successCount += batch.length;
    }
  }

  return { success: successCount, errors: errorCount };
}

async function processAllCities(topCount: number, dryRun: boolean) {
  const cities = await getAllCitiesWithClinics();
  const startTime = Date.now();

  let totalFeatured = 0;
  let citiesProcessed = 0;
  let citiesWithFeatured = 0;
  const allFeaturedIds: string[] = [];

  console.log('═'.repeat(70));
  console.log(`Processing ${cities.length} cities (Top ${topCount} per city)`);
  console.log('═'.repeat(70));
  console.log('');

  // Group by state for better readability
  const byState: Record<string, typeof cities> = {};
  cities.forEach(city => {
    if (!byState[city.state]) {
      byState[city.state] = [];
    }
    byState[city.state].push(city);
  });

  for (const [state, stateCities] of Object.entries(byState)) {
    console.log(`\n📍 ${state} (${stateCities.length} cities)`);
    console.log('─'.repeat(70));

    for (const { city, state: stateCode } of stateCities) {
      citiesProcessed++;

      const topClinics = await getTopClinicsForCity(city, stateCode, topCount);

      if (topClinics.length > 0) {
        citiesWithFeatured++;
        totalFeatured += topClinics.length;
        allFeaturedIds.push(...topClinics);

        console.log(`   ✓ ${city}: ${topClinics.length} clinics`);
      } else {
        console.log(`   ○ ${city}: 0 clinics (no rated clinics)`);
      }

      // Progress indicator every 20 cities
      if (citiesProcessed % 20 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const progress = ((citiesProcessed / cities.length) * 100).toFixed(1);
        console.log(`   ⏳ Progress: ${citiesProcessed}/${cities.length} (${progress}%) | ${elapsed}s`);
      }
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Cities processed: ${citiesProcessed}`);
  console.log(`Cities with featured clinics: ${citiesWithFeatured}`);
  console.log(`Total clinics to feature: ${totalFeatured}`);
  console.log(`Average per city: ${(totalFeatured / citiesWithFeatured).toFixed(1)}`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes made to database');
    console.log('   Run without --dry-run to apply changes');
  } else {
    console.log('\n💾 Updating database...');
    const { success, errors } = await markClinicsAsFeatured(allFeaturedIds);
    console.log(`   ✅ Successfully featured: ${success} clinics`);
    if (errors > 0) {
      console.log(`   ⚠️  Errors: ${errors} clinics`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Total time: ${totalTime}s`);
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       AUTO-FEATURE TOP CLINICS IN EACH CITY (ALL STATES)       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Parse arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const topArg = args.find(a => a.startsWith('--top='));
  const topCount = topArg ? parseInt(topArg.split('=')[1]) : DEFAULT_TOP_COUNT;

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - Preview only, no changes will be made');
  } else {
    console.log('⚠️  LIVE MODE - Database will be updated');
  }

  console.log(`📊 Featuring top ${topCount} clinics per city`);
  console.log('');

  // Confirmation prompt for live mode
  if (!dryRun) {
    console.log('⚠️  WARNING: This will:');
    console.log('   1. Reset ALL current featured_clinic flags to false');
    console.log(`   2. Mark top ${topCount} clinics per city as featured`);
    console.log('   3. Process ALL cities in ALL states');
    console.log('');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    console.log('');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Reset all featured flags first
    await resetAllFeaturedStatus();
  }

  // Process all cities
  await processAllCities(topCount, dryRun);

  console.log('\n✨ Process complete!\n');

  if (dryRun) {
    console.log('To apply these changes, run:');
    console.log('  npx tsx scripts/autoFeatureTopClinics.ts');
  } else {
    console.log('Next steps:');
    console.log('1. Verify featured clinics: npx tsx scripts/markFeaturedClinics.ts --list');
    console.log('2. Test on your website');
    console.log('3. Deploy to production');
  }

  console.log('');
}

// ============================================================================
// Execute
// ============================================================================

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
});