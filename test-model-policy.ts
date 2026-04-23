#!/usr/bin/env tsx
/**
 * Test script for JOU-10 Model Compatibility Policy validation
 * Run with: pnpm tsx test-model-policy.ts
 */

import { checkModelCompatibility, MODEL_COMPATIBILITY_POLICY } from './packages/adapters/opencode-local/src/index.js';
import { ensureOpenCodeModelConfiguredAndAvailable } from './packages/adapters/opencode-local/src/server/models.js';

console.log('=== JOU-10 Model Compatibility Policy Test ===\n');

// Test 1: Check policy lookup
const testModels = [
  'qwen/qwen3.5-122b',
  'litellm/qwen3.5-122b-a10b-instruct',
  'litellm/qwen3.5-35b-a3b-instruct',
  'litellm/qwen3-coder-next-instruct',
  'openai/gpt-4.1-mini',
];

console.log('[Test 1] Model compatibility lookup');
for (const model of testModels) {
  const result = checkModelCompatibility(model);
  console.log(`Model: ${model}`);
  console.log(`  Compatible: ${result.compatible ? '✅ YES' : '❌ NO'}`);
  
  if (!result.compatible) {
    console.log(`  Reason: ${result.reason}`);
    console.log(`  Recommended: ${result.recommendedModels?.join(', ') || 'None'}`);
  }
  console.log('');
}

console.log('\n[Test 2] Error message format for forbidden models');
const forbiddenModels = [
  'qwen/qwen3.5-122b',
  'litellm/qwen3.5-122b-a10b-instruct',
];

for (const model of forbiddenModels) {
  console.log(`\nTesting model: ${model}`);
  try {
    await ensureOpenCodeModelConfiguredAndAvailable({ model });
    console.log('  ❌ UNEXPECTED: Should have thrown error');
  } catch (error) {
    const message = String(error);
    console.log(`  Error thrown:\n   ${message.replace(/\n/g, '\n   ').slice(0, 500)}`);
    
    // Verify error format
    const hasJOO10Prefix = message.includes('[JOO-10 Model Policy Violation]');
    const hasReason = message.includes('Reason:');
    const hasAlternatives = message.includes('Recommended alternatives:');
    
    console.log(`  ✓ Has JOO-10 prefix: ${hasJOO10Prefix ? '✅' : '❌'}`);
    console.log(`  ✓ Includes reason: ${hasReason ? '✅' : '❌'}`);
    console.log(`  ✓ Includes alternatives: ${hasAlternatives ? '✅' : '❌'}`);
  }
}

console.log('\n\n=== Test Summary ===');
console.log('Policy definition loaded from:', MODEL_COMPATIBILITY_POLICY ? 'index.ts' : 'MISSING');
const compatibleCount = testModels.filter(m => checkModelCompatibility(m).compatible).length;
const forbiddenCount = testModels.length - compatibleCount;
console.log(`Tested ${testModels.length} models: ${compatibleCount} compatible, ${forbiddenCount} forbidden`);
console.log('\nAll tests complete.');
