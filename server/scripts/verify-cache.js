/**
 * OFFICIAL VERIFICATION: Prompt caching validation script.
 *
 * Purpose: Confirms that prompt caching is active by making 2
 * consecutive requests per model (Sonnet, Opus, Haiku) and comparing
 * cache_creation_input_tokens vs cache_read_input_tokens in the
 * API response. Request 2 should show a cache hit for Sonnet/Opus
 * (min 1024 tokens) and a cache miss for Haiku (min 2048 tokens,
 * our prompt is ~1,230 tokens).
 *
 * When to use: After any change to the system prompt structure,
 * cache_control placement, or Anthropic SDK version. Also useful
 * for periodic validation that caching hasn't silently broken.
 *
 * Run from server/: node scripts/verify-cache.js
 * Requires: active API key in settings table, at least 1 connection
 * in the SQLite DB. Consumes ~6 API calls (2 per model). Both
 * requests per model execute within <60 seconds to stay within
 * Anthropic's 5-minute cache TTL.
 */
import Anthropic from '@anthropic-ai/sdk';
import db from '../db.js';
import { getProfile } from '../services/profiler.js';
import { getKnowledgeForPrompt } from '../services/knowledge.js';
import { getDirectivesForPrompt } from '../services/safety-directives.js';
import { buildServerContext, buildSystemBlocks, buildCachedTools } from '../services/ai.js';

const MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Sonnet', expectCache: true, minTokens: 1024 },
  { id: 'claude-opus-4-20250514', name: 'Opus', expectCache: true, minTokens: 1024 },
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku', expectCache: false, minTokens: 2048 },
];

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function ok(msg) { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function warn(msg) { console.log(`  ${YELLOW}⚠${RESET} ${msg}`); }
function fail(msg) { console.log(`  ${RED}✗${RESET} ${msg}`); }

async function main() {
  const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'anthropic_api_key'").get()?.value;
  if (!apiKey) { console.error('No API key in settings. Configure it in the app first.'); process.exit(1); }

  const conn = db.prepare('SELECT * FROM connections LIMIT 1').get();
  if (!conn) { console.error('No connections in DB.'); process.exit(1); }

  const profile = getProfile(conn.id);
  const knowledgeCtx = getKnowledgeForPrompt(conn.id) || '';
  const directivesCtx = getDirectivesForPrompt(conn.os_type || 'linux') || '';
  const serverCtx = buildServerContext(conn.os_type, profile, knowledgeCtx, directivesCtx);
  const systemBlocks = buildSystemBlocks(conn.os_type, serverCtx);
  const cachedTools = buildCachedTools();

  const promptTokensApprox = Math.ceil(systemBlocks[0].text.length / 4);
  console.log(`\nServer: ${conn.name} (${conn.host}) | OS: ${conn.os_type}`);
  console.log(`System prompt: ~${promptTokensApprox} tokens approx`);
  console.log('='.repeat(60));

  const client = new Anthropic({ apiKey });

  for (const modelInfo of MODELS) {
    console.log(`\n--- ${modelInfo.name} (${modelInfo.id}) ---`);
    console.log(`  Min cache tokens: ${modelInfo.minTokens} | Expect cache: ${modelInfo.expectCache}`);

    if (promptTokensApprox < modelInfo.minTokens) {
      console.log(`  Prompt (~${promptTokensApprox} tokens) < min (${modelInfo.minTokens}). Cache NOT expected.`);
    }

    const results = [];

    for (let req = 1; req <= 2; req++) {
      try {
        const response = await client.messages.create({
          model: modelInfo.id,
          max_tokens: 50,
          system: systemBlocks,
          tools: cachedTools,
          messages: [{ role: 'user', content: 'Responde solo: OK' }],
        });

        const usage = response.usage || {};
        results.push({
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
          cacheCreation: usage.cache_creation_input_tokens || 0,
          cacheRead: usage.cache_read_input_tokens || 0,
        });

        console.log(`  Request ${req}: input=${usage.input_tokens} cache_create=${usage.cache_creation_input_tokens || 0} cache_read=${usage.cache_read_input_tokens || 0}`);
      } catch (err) {
        console.log(`  Request ${req}: ${RED}ERROR${RESET} ${err.message}`);
        results.push(null);
      }
    }

    // Evaluate results
    if (!results[0] || !results[1]) {
      fail('Could not complete both requests. Skipping evaluation.');
      continue;
    }

    const r1 = results[0];
    const r2 = results[1];

    // Determine cache state from the 4 possible patterns
    if (r1.cacheCreation > 0 && r2.cacheRead > 0) {
      // Cold start: req1 created cache, req2 read it
      ok(`Cache COLD start: Request 1 created cache (${r1.cacheCreation} tokens). Request 2 read cache (${r2.cacheRead} tokens). VERIFIED: cache working.`);
    } else if (r1.cacheRead > 0 && r2.cacheRead > 0) {
      // Warm: residual cache from previous run
      ok(`Cache WARM (residual from previous run): both requests hit cache (${r1.cacheRead} tokens). VERIFIED: cache working.`);
    } else if (r1.cacheCreation > 0 && r2.cacheCreation > 0 && r2.cacheRead === 0) {
      // Both create, neither reads — something is wrong
      if (modelInfo.expectCache) {
        fail(`WARNING: cache appears to be created but not reused between requests. Possible causes: content differs between calls, or API behavior changed. INVESTIGATE.`);
      } else {
        ok(`Cache NOT active for ${modelInfo.name} as expected (prompt below ${modelInfo.minTokens} min).`);
      }
    } else if (r1.cacheRead === 0 && r2.cacheRead === 0 && r1.cacheCreation === 0 && r2.cacheCreation === 0) {
      // No cache activity at all
      if (modelInfo.expectCache) {
        fail(`Cache NOT active for this model. UNEXPECTED for ${modelInfo.name} — prompt should be above ${modelInfo.minTokens} min.`);
      } else {
        ok(`Cache NOT active for ${modelInfo.name}. Expected for Haiku (prompt below ${modelInfo.minTokens} min).`);
      }
    } else {
      // Unexpected combination — report raw values
      warn(`Unexpected cache pattern: req1(create=${r1.cacheCreation}, read=${r1.cacheRead}) req2(create=${r2.cacheCreation}, read=${r2.cacheRead}). Manual review needed.`);
    }

    // Savings estimate for cacheable models
    if (modelInfo.expectCache && (r1.cacheRead > 0 || r2.cacheRead > 0)) {
      const cachedTokens = r1.cacheRead || r1.cacheCreation || r2.cacheRead;
      const pricePerM = modelInfo.id.includes('opus') ? 15 : modelInfo.id.includes('sonnet') ? 3 : 1;
      const noCacheCost = 5 * cachedTokens * pricePerM / 1_000_000;
      const withCacheCost = (1 * cachedTokens * pricePerM * 1.25 / 1_000_000) + (4 * cachedTokens * pricePerM * 0.10 / 1_000_000);
      const savings = noCacheCost - withCacheCost;
      console.log(`  Savings estimate per 5-message chat: $${noCacheCost.toFixed(4)} → $${withCacheCost.toFixed(4)} (save $${savings.toFixed(4)}, 67% of system prompt cost, excluding history which is not cached).`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Verification complete.\n');
  process.exit(0);
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1); });
