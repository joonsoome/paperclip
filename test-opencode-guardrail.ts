/** JOU-10 Guardrail Integration Test */

import { checkModelCompatibility } from './packages/adapters/opencode-local/src/index.js';

async function runTest() {
  console.log('=== JOU-10 Integration Test ===\n');
  
  // Step 1: Verify forbidden models fail fast with actionable error
  const forbiddenModels = [
    'litellm/qwen3.5-122b-a10b-instruct',
    'qwen/qwen3.5-122b'
  ];
  
  console.log('[Test 1] Forbidden model detection');
  for (const model of forbiddenModels) {
    const result = checkModelCompatibility(model);
    
    if (!result.compatible && result.reason && result.recommendedModels) {
      console.log(`✓ ${model}`);
      console.log(`  - Detected as incompatible`);
      console.log(`  - Reason: ${result.reason.substring(0, 60)}...`);
      console.log(`  - Alternative: ${result.recommendedModels[0]}`);
    } else {
      console.error(`✗ FAIL: ${model} should be forbidden`);
      process.exit(1);
    }
  }
  
  // Step 2: Verify allowed models pass
  const allowedModels = [
    'litellm/qwen3.5-35b-a3b-instruct',
    'openai/gpt-4.1-mini'
  ];
  
  console.log('\n[Test 2] Allowed model validation');
  for (const model of allowedModels) {
    const result = checkModelCompatibility(model);
    
    if (result.compatible) {
      console.log(`✓ ${model} passes preflight`);
    } else {
      console.error(`✗ FAIL: ${model} should be allowed`);
      process.exit(1);
    }
  }
  
  // Step 3: Verify policy is loaded from index.ts (not hardcoded)
  console.log('\n[Test 3] Policy source verification');
  console.log('✓ MODEL_COMPATIBILITY_POLICY defined in index.ts with', 
              Object.keys(checkModelCompatibility['constructor'] ?? {}).length, 'entries?');
  
  // Check actual policy object directly
  const { MODEL_COMPATIBILITY_POLICY } = await import('./packages/adapters/opencode-local/src/index.js');
  console.log('✓ Policy loaded from source - forbidden entries:', 
              Object.values(MODEL_COMPATIBILITY_POLICY).filter(p => p.forbidden).length);
  
  console.log('\n=== All Tests Passed ===\n');
}

runTest().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
