/**
 * Diagnostic Script: Check Amenities Data Format
 * 
 * This script checks your Supabase database to see:
 * 1. How many clinics have amenities data
 * 2. What format the data is stored in (camelCase vs snake_case)
 * 3. Sample of actual data
 * 
 * Usage:
 *   npx tsx scripts/diagnose-amenities.ts
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

interface AmenityStats {
  totalClinics: number;
  withAccessibility: number;
  withParking: number;
  withPayment: number;
  withAnyAmenity: number;
  camelCaseFormat: number;
  snakeCaseFormat: number;
  mixedFormat: number;
}

function detectFormat(obj: any): 'camelCase' | 'snake_case' | 'mixed' | 'empty' {
  if (!obj || typeof obj !== 'object') return 'empty';
  
  const keys = Object.keys(obj);
  if (keys.length === 0) return 'empty';
  
  const hasCamelCase = keys.some(k => /[a-z][A-Z]/.test(k));
  const hasSnakeCase = keys.some(k => k.includes('_'));
  
  if (hasCamelCase && hasSnakeCase) return 'mixed';
  if (hasCamelCase) return 'camelCase';
  if (hasSnakeCase) return 'snake_case';
  return 'empty';
}

async function diagnose() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           AMENITIES DATA FORMAT DIAGNOSTIC                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('📊 Fetching clinic data from Supabase...\n');

  // Get all clinics with amenities
  const { data: clinics, error } = await supabase
    .from('clinics')
    .select('place_id, display_name, accessibility_options, parking_options, payment_options, state_code')
    .limit(1000);

  if (error) {
    console.error('❌ Error fetching data:', error.message);
    return;
  }

  if (!clinics || clinics.length === 0) {
    console.log('⚠️  No clinics found in database');
    return;
  }

  // Analyze the data
  const stats: AmenityStats = {
    totalClinics: clinics.length,
    withAccessibility: 0,
    withParking: 0,
    withPayment: 0,
    withAnyAmenity: 0,
    camelCaseFormat: 0,
    snakeCaseFormat: 0,
    mixedFormat: 0,
  };

  const samples: any[] = [];

  clinics.forEach(clinic => {
    const hasAccessibility = clinic.accessibility_options && Object.keys(clinic.accessibility_options).length > 0;
    const hasParking = clinic.parking_options && Object.keys(clinic.parking_options).length > 0;
    const hasPayment = clinic.payment_options && Object.keys(clinic.payment_options).length > 0;
    
    if (hasAccessibility) stats.withAccessibility++;
    if (hasParking) stats.withParking++;
    if (hasPayment) stats.withPayment++;
    if (hasAccessibility || hasParking || hasPayment) stats.withAnyAmenity++;

    // Detect format
    const accessFormat = detectFormat(clinic.accessibility_options);
    const parkingFormat = detectFormat(clinic.parking_options);
    const paymentFormat = detectFormat(clinic.payment_options);

    const formats = [accessFormat, parkingFormat, paymentFormat].filter(f => f !== 'empty');
    
    if (formats.includes('camelCase')) stats.camelCaseFormat++;
    if (formats.includes('snake_case')) stats.snakeCaseFormat++;
    if (formats.includes('mixed')) stats.mixedFormat++;

    // Collect samples
    if (samples.length < 3 && (hasAccessibility || hasParking || hasPayment)) {
      samples.push({
        name: clinic.display_name,
        state: clinic.state_code,
        accessibility: clinic.accessibility_options,
        parking: clinic.parking_options,
        payment: clinic.payment_options,
      });
    }
  });

  // Print results
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('COVERAGE STATISTICS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total clinics analyzed: ${stats.totalClinics}`);
  console.log(`\nClinics with amenity data:`);
  console.log(`  ♿ Accessibility options: ${stats.withAccessibility} (${((stats.withAccessibility/stats.totalClinics)*100).toFixed(1)}%)`);
  console.log(`  🅿️ Parking options: ${stats.withParking} (${((stats.withParking/stats.totalClinics)*100).toFixed(1)}%)`);
  console.log(`  💳 Payment options: ${stats.withPayment} (${((stats.withPayment/stats.totalClinics)*100).toFixed(1)}%)`);
  console.log(`  📊 Any amenity: ${stats.withAnyAmenity} (${((stats.withAnyAmenity/stats.totalClinics)*100).toFixed(1)}%)`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('DATA FORMAT ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`CamelCase format (wheelchairAccessibleEntrance): ${stats.camelCaseFormat} clinics`);
  console.log(`Snake_case format (wheelchair_accessible_entrance): ${stats.snakeCaseFormat} clinics`);
  console.log(`Mixed format: ${stats.mixedFormat} clinics`);

  if (stats.camelCaseFormat > 0 && stats.snakeCaseFormat > 0) {
    console.log('\n⚠️  WARNING: Mixed data formats detected!');
    console.log('   Your database has both camelCase and snake_case formats.');
    console.log('   The updated API route will handle both formats correctly.');
  } else if (stats.camelCaseFormat > 0) {
    console.log('\n✅ All amenity data is in camelCase format (Google Places API format)');
  } else if (stats.snakeCaseFormat > 0) {
    console.log('\n✅ All amenity data is in snake_case format (normalized)');
  }

  // Print samples
  if (samples.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('DATA SAMPLES');
    console.log('═══════════════════════════════════════════════════════════════');
    
    samples.forEach((sample, i) => {
      console.log(`\n${i + 1}. ${sample.name} (${sample.state})`);
      
      if (sample.accessibility) {
        console.log('   Accessibility options:');
        console.log('   ', JSON.stringify(sample.accessibility, null, 2).split('\n').join('\n    '));
      }
      
      if (sample.parking) {
        console.log('   Parking options:');
        console.log('   ', JSON.stringify(sample.parking, null, 2).split('\n').join('\n    '));
      }
      
      if (sample.payment) {
        console.log('   Payment options:');
        console.log('   ', JSON.stringify(sample.payment, null, 2).split('\n').join('\n    '));
      }
    });
  }

  // Recommendations
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════');

  if (stats.withAnyAmenity === 0) {
    console.log('❌ NO AMENITY DATA FOUND');
    console.log('   Action needed:');
    console.log('   1. Re-run data collection with amenity hydration enabled');
    console.log('   2. Use collectClinicDataFinal.ts script');
    console.log('   3. Ensure Places Details API is being called');
  } else if (stats.withAnyAmenity < stats.totalClinics * 0.5) {
    console.log('⚠️  LOW AMENITY COVERAGE');
    console.log('   Consider:');
    console.log('   1. Re-collecting data for clinics without amenities');
    console.log('   2. Using Places Details API to hydrate missing data');
  } else {
    console.log('✅ GOOD AMENITY COVERAGE');
    console.log('   Your database has amenity data for most clinics.');
  }

  if (stats.camelCaseFormat > 0 || stats.snakeCaseFormat > 0 || stats.mixedFormat > 0) {
    console.log('\n✅ Data format detected successfully');
    console.log('   The updated API route handles both formats automatically.');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('NEXT STEPS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('1. Apply the fixed API route: app/api/clinics/route.ts');
  console.log('2. Apply the fixed detail page: app/clinics/[id]/page.tsx');
  console.log('3. Test on a few clinic pages');
  console.log('4. Deploy to production');
  
  if (stats.withAnyAmenity < stats.totalClinics * 0.3) {
    console.log('\n5. Optional: Re-collect data to improve amenity coverage');
  }

  console.log('\n');
}

diagnose().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
