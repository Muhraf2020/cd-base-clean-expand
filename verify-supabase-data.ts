/**
 * Verify Supabase Data
 * 
 * This script checks what data is actually in your Supabase database
 * and helps diagnose data issues.
 * 
 * Usage:
 *   npx tsx verify-supabase-data.ts
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

async function verify() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           SUPABASE DATA VERIFICATION                           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // 1. Total count
  console.log('📊 Checking total clinic count...');
  const { count: totalCount, error: countError } = await supabase
    .from('clinics')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error:', countError.message);
    return;
  }

  console.log(`   ✅ Total clinics in database: ${totalCount}\n`);

  // 2. Count by state
  console.log('📍 Checking clinics by state...');
  const { data: states, error: statesError } = await supabase
    .from('clinics')
    .select('state_code');

  if (statesError) {
    console.error('❌ Error:', statesError.message);
    return;
  }

  const stateCounts: Record<string, number> = {};
  states?.forEach(clinic => {
    const state = clinic.state_code || 'UNKNOWN';
    stateCounts[state] = (stateCounts[state] || 0) + 1;
  });

  const sortedStates = Object.entries(stateCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  console.log('   Top 10 states by clinic count:');
  sortedStates.forEach(([state, count]) => {
    console.log(`   ${state}: ${count} clinics`);
  });
  console.log('');

  // 3. Data quality check
  console.log('🔍 Checking data quality...');
  const { data: sample, error: sampleError } = await supabase
    .from('clinics')
    .select('*')
    .limit(100);

  if (sampleError) {
    console.error('❌ Error:', sampleError.message);
    return;
  }

  const withPhone = sample?.filter(c => c.phone).length || 0;
  const withWebsite = sample?.filter(c => c.website).length || 0;
  const withRating = sample?.filter(c => c.rating).length || 0;
  const withAccessibility = sample?.filter(c => c.accessibility_options).length || 0;
  const withParking = sample?.filter(c => c.parking_options).length || 0;

  console.log(`   Sample size: 100 clinics`);
  console.log(`   📞 With phone: ${withPhone}%`);
  console.log(`   🌐 With website: ${withWebsite}%`);
  console.log(`   ⭐ With rating: ${withRating}%`);
  console.log(`   ♿ With accessibility info: ${withAccessibility}%`);
  console.log(`   🅿️ With parking info: ${withParking}%`);
  console.log('');

  // 4. Recent updates
  console.log('📅 Checking recent activity...');
  const { data: recent, error: recentError } = await supabase
    .from('clinics')
    .select('created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (recentError) {
    console.error('❌ Error:', recentError.message);
    return;
  }

  console.log('   Most recently updated clinics:');
  recent?.forEach((clinic, i) => {
    console.log(`   ${i + 1}. Updated: ${new Date(clinic.updated_at).toLocaleString()}`);
  });
  console.log('');

  // 5. Check for duplicates
  console.log('🔎 Checking for duplicate place_ids...');
  const { data: allIds, error: idsError } = await supabase
    .from('clinics')
    .select('place_id');

  if (idsError) {
    console.error('❌ Error:', idsError.message);
    return;
  }

  const idCounts = new Map<string, number>();
  allIds?.forEach(clinic => {
    const count = idCounts.get(clinic.place_id) || 0;
    idCounts.set(clinic.place_id, count + 1);
  });

  const duplicates = Array.from(idCounts.entries())
    .filter(([, count]) => count > 1);

  if (duplicates.length > 0) {
    console.log(`   ⚠️  Found ${duplicates.length} duplicate place_ids`);
    duplicates.slice(0, 5).forEach(([id, count]) => {
      console.log(`      ${id}: ${count} times`);
    });
  } else {
    console.log('   ✅ No duplicates found');
  }
  console.log('');

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    VERIFICATION COMPLETE                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
}

verify().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
