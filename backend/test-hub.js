// Quick test to verify shared-hub connection
require('dotenv').config();

const { quickStart, getHubAdminClient } = require('@anthropic-studio/shared-hub');

// Initialize
quickStart({
  hubUrl: process.env.HUB_SUPABASE_URL,
  hubAnonKey: process.env.HUB_SUPABASE_ANON_KEY,
  hubServiceKey: process.env.HUB_SUPABASE_SERVICE_KEY,
  jwtSecret: process.env.JWT_SECRET,
});

async function test() {
  console.log('Testing Shared Hub connection...\n');

  const hub = getHubAdminClient();

  // Test 1: Check tables exist
  console.log('1. Checking hub tables...');
  const tables = [
    'shared_users',
    'shared_contacts',
    'cross_app_events',
    'organizations',
  ];

  for (const table of tables) {
    const { error } = await hub.from(table).select('id').limit(1);
    if (error) {
      console.log(`   ❌ ${table}: ${error.message}`);
    } else {
      console.log(`   ✅ ${table}: OK`);
    }
  }

  // Test 2: Insert a test event
  console.log('\n2. Testing event bus...');
  const { data: event, error: eventError } = await hub
    .from('cross_app_events')
    .insert({
      source_app: 'entomate',
      event_type: 'test.connection',
      event_category: 'user',
      payload: { message: 'Hub connection test', timestamp: new Date().toISOString() },
    })
    .select()
    .single();

  if (eventError) {
    console.log(`   ❌ Event insert failed: ${eventError.message}`);
  } else {
    console.log(`   ✅ Event created: ${event.id}`);

    // Clean up test event
    await hub.from('cross_app_events').delete().eq('id', event.id);
    console.log('   ✅ Test event cleaned up');
  }

  console.log('\n✅ Shared Hub is working!\n');
}

test().catch(console.error);
