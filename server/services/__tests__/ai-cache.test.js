import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildServerContext, buildSystemBlocks, buildCachedTools } from '../ai.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Mock profile matching the fixture server (AV Securities WEB, linux) ──

// Profile matching the fixture server (AV Securities WEB, linux)
// Values extracted from fixtures/system-prompt-baseline.txt
const MOCK_PROFILE = {
  os_version: 'Ubuntu 24.04.4 LTS',
  distro: 'ubuntu',
  os_family: 'debian',
  kernel_version: '6.8.0-107-generic',
  arch: 'x86_64',
  cpu_info: '2\r CPU AMD EPYC 9575F 64-Core Processor',
  total_memory_mb: 1854,
  total_disk_mb: 60408,
  package_manager: 'apt',
  shell_version: '5.2.21',
  init_system: 'systemd',
  role: 'no definido',
  custom_notes: null,
};

// ── buildSystemBlocks ───────────────────────────────────────────────

describe('buildSystemBlocks', () => {
  it('returns array with exactly 1 content block', () => {
    const blocks = buildSystemBlocks('linux', '');
    assert.ok(Array.isArray(blocks), 'system must be an array');
    assert.equal(blocks.length, 1);
  });

  it('content block has type text and cache_control ephemeral', () => {
    const blocks = buildSystemBlocks('linux', '');
    assert.equal(blocks[0].type, 'text');
    assert.deepEqual(blocks[0].cache_control, { type: 'ephemeral' });
  });

  it('content block contains SYSTEM_PROMPT with os_type replaced', () => {
    const blocks = buildSystemBlocks('windows', '');
    assert.ok(blocks[0].text.includes('El sistema operativo es: windows'), 'os_type should be replaced');
    assert.ok(!blocks[0].text.includes('{os_type}'), 'placeholder should not remain');
  });

  it('content block includes serverContext when provided', () => {
    const ctx = '\n\nPERFIL DEL SERVIDOR:\n- OS: Ubuntu';
    const blocks = buildSystemBlocks('linux', ctx);
    assert.ok(blocks[0].text.includes('PERFIL DEL SERVIDOR'), 'serverContext should be appended');
  });

  it('content block omits serverContext when empty', () => {
    const blocks = buildSystemBlocks('linux', '');
    assert.ok(!blocks[0].text.includes('PERFIL DEL SERVIDOR'));
  });
});

// ── buildCachedTools ────────────────────────────────────────────────

describe('buildCachedTools', () => {
  it('returns 2 tools', () => {
    const tools = buildCachedTools();
    assert.equal(tools.length, 2);
  });

  it('cache_control is on the last tool only', () => {
    const tools = buildCachedTools();
    assert.equal(tools[0].cache_control, undefined, 'first tool should NOT have cache_control');
    assert.deepEqual(tools[1].cache_control, { type: 'ephemeral' }, 'last tool should have cache_control');
  });
});

// ── buildServerContext ──────────────────────────────────────────────

describe('buildServerContext', () => {
  it('includes profile when provided', () => {
    const ctx = buildServerContext('linux', MOCK_PROFILE, '', '');
    assert.ok(ctx.includes('PERFIL DEL SERVIDOR'));
    assert.ok(ctx.includes('Ubuntu 24.04.4 LTS'));
  });

  it('includes knowledge when provided', () => {
    const knowledge = '\n\nEXPERIENCIAS PREVIAS EXITOSAS EN ESTE TIPO DE SERVIDOR:\n- test';
    const ctx = buildServerContext('linux', null, knowledge, '');
    assert.ok(ctx.includes('EXPERIENCIAS PREVIAS'));
  });

  it('includes directives when provided', () => {
    const directives = '\n\nDIRECTRICES DE SEGURIDAD FUNDAMENTALES (OBLIGATORIO CUMPLIR):\n- test';
    const ctx = buildServerContext('linux', null, '', directives);
    assert.ok(ctx.includes('DIRECTRICES DE SEGURIDAD'));
  });

  it('returns empty string when no profile, knowledge, or directives', () => {
    const ctx = buildServerContext('linux', null, '', '');
    assert.equal(ctx, '');
  });

  it('includes bash version for linux profile', () => {
    const ctx = buildServerContext('linux', MOCK_PROFILE, '', '');
    assert.ok(ctx.includes('VERSION DE BASH: 5.2.21'));
  });

  it('includes powershell version for windows profile', () => {
    const winProfile = { ...MOCK_PROFILE, os_family: 'windows', shell_version: '5' };
    const ctx = buildServerContext('windows', winProfile, '', '');
    assert.ok(ctx.includes('VERSION DE POWERSHELL: 5'));
    assert.ok(ctx.includes('PowerShell 5.x'));
  });
});

// ── Fixture regression test ─────────────────────────────────────────

describe('System prompt regression (fixture)', () => {
  it('buildServerContext + buildSystemBlocks produces identical output to baseline', () => {
    const baselinePath = join(__dirname, 'fixtures/system-prompt-baseline.txt');
    const baseline = fs.readFileSync(baselinePath, 'utf8');

    // The baseline has this structure:
    //   SYSTEM_PROMPT (with os_type=linux) + serverContext
    // where serverContext = profile + knowledge + directives
    //
    // We split the baseline at the known boundary to extract the parts
    // that buildServerContext receives as knowledge and directives.
    // The profile section is reconstructed from MOCK_PROFILE by buildServerContext.
    // So we only need to extract knowledge + directives as raw strings.

    // Find where the profile block ends and knowledge/directives begin.
    // The profile always ends with "VERSION DE BASH: X.X.X" line.
    // Knowledge starts with "\n\nEXPERIENCIAS PREVIAS" or may be absent.
    // Directives start with "\n\nDIRECTRICES DE SEGURIDAD" or may be absent.

    // Strategy: extract everything after the profile+bash block that buildServerContext
    // would produce, and pass it as knowledge+directives.
    // Since buildServerContext concatenates profile + knowledge + directives,
    // we need to find where the profile output ends in the baseline.

    // Build profile-only context to find where it ends
    const profileOnly = buildServerContext('linux', MOCK_PROFILE, '', '');

    // The baseline should start with SYSTEM_PROMPT + profileOnly + knowledge + directives
    // Find where profileOnly ends in the baseline
    const profileEndPos = baseline.indexOf(profileOnly) + profileOnly.length;

    // Everything after the profile is knowledge + directives (already concatenated in baseline)
    const knowledgePlusDirectives = baseline.substring(profileEndPos);

    // Split into knowledge and directives
    const directivesMarker = '\n\nDIRECTRICES DE SEGURIDAD';
    const directivesStart = knowledgePlusDirectives.indexOf(directivesMarker);

    let knowledgeContext, directivesContext;
    if (directivesStart >= 0) {
      knowledgeContext = knowledgePlusDirectives.substring(0, directivesStart);
      directivesContext = knowledgePlusDirectives.substring(directivesStart);
    } else {
      knowledgeContext = knowledgePlusDirectives;
      directivesContext = '';
    }

    const serverCtx = buildServerContext('linux', MOCK_PROFILE, knowledgeContext, directivesContext);
    const blocks = buildSystemBlocks('linux', serverCtx);
    const reconstructed = blocks[0].text;

    assert.equal(reconstructed, baseline, 'Reconstructed system prompt must be identical to baseline fixture');
  });
});
