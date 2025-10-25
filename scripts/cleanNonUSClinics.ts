import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const VALID_US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
];

async function cleanDatabase() {
  console.log('🔍 Checking for non-US clinics...\n');
  
  // Get all clinics
  const { data: clinics, error } = await supabase
    .from('clinics')
    .select('place_id, display_name, state_code, formatted_address');
  
  if (error) {
    console.error('Error fetching clinics:', error);
    return;
  }
  
  const nonUSClinics = clinics?.filter(c => 
    !c.state_code || !VALID_US_STATES.includes(c.state_code)
  ) || [];
  
  console.log(`Found ${nonUSClinics.length} non-US clinics to remove:\n`);
  
  nonUSClinics.forEach(c => {
    console.log(`  ❌ ${c.display_name} (${c.state_code || 'NO STATE'}) - ${c.formatted_address}`);
  });
  
  if (nonUSClinics.length === 0) {
    console.log('✅ No non-US clinics found!');
    return;
  }
  
  console.log(`\n🗑️  Deleting ${nonUSClinics.length} clinics...`);
  
  const placeIds = nonUSClinics.map(c => c.place_id);
  const { error: deleteError } = await supabase
    .from('clinics')
    .delete()
    .in('place_id', placeIds);
  
  if (deleteError) {
    console.error('Error deleting clinics:', deleteError);
  } else {
    console.log('✅ Successfully removed non-US clinics!');
  }
}

cleanDatabase();
