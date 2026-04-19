import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Tests for the tool-use loop limit in ai.js chat().
 *
 * Strategy: mock the Anthropic SDK and all DB/service dependencies
 * so chat() can run without real API calls or database.
 * We force Claude to always request tool_use, hitting the 10-iteration limit.
 */

describe('Tool-use loop limit', () => {
  let chatFn;
  let createCallCount;
  let lastCreateParams;
  let emittedEvents;

  beforeEach(async () => {
    createCallCount = 0;
    lastCreateParams = null;
    emittedEvents = [];

    // Mock the Anthropic SDK — must use the package specifier
    mock.module('@anthropic-ai/sdk', {
      defaultExport: class MockAnthropic {
        constructor() {
          this.messages = {
            create: async (params) => {
              createCallCount++;
              lastCreateParams = params;

              // After 12 calls, always return end_turn to prevent runaway
              if (createCallCount > 12) {
                return {
                  content: [{ type: 'text', text: 'Final response' }],
                  stop_reason: 'end_turn',
                  usage: { input_tokens: 100, output_tokens: 50 },
                };
              }

              // Always request tool_use to force the loop
              return {
                content: [
                  { type: 'text', text: `Iteration ${createCallCount}` },
                  {
                    type: 'tool_use',
                    id: `tool_${createCallCount}`,
                    name: 'execute_command',
                    input: { command: 'echo test' },
                  },
                ],
                stop_reason: 'tool_use',
                usage: { input_tokens: 100, output_tokens: 50 },
              };
            },
          };
        }
      },
    });

    // Mock db — use the absolute file path that ai.js resolves to
    const dbPath = join(__dirname, '..', '..', 'db.js');
    mock.module(dbPath, {
      defaultExport: {
        prepare: () => ({
          get: () => ({ value: 'fake-api-key' }),
          run: () => {},
          all: () => [],
        }),
      },
    });

    // Mock services using absolute paths
    mock.module(join(__dirname, '..', 'ssh.js'), {
      namedExports: {
        executeCommand: async () => ({
          stdout: 'ok', stderr: '', code: 0, command: 'echo test',
          executionTimeMs: 10, connectionTimeMs: 5,
          startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
        }),
      },
    });

    mock.module(join(__dirname, '..', 'profiler.js'), {
      namedExports: { getProfile: () => null },
    });

    mock.module(join(__dirname, '..', 'knowledge.js'), {
      namedExports: { getKnowledgeForPrompt: () => '', learnFromExecution: () => {} },
    });

    mock.module(join(__dirname, '..', '..', 'routes', 'approval.js'), {
      namedExports: { checkApproval: () => ({ decision: 'approved' }) },
    });

    mock.module(join(__dirname, '..', 'safety-directives.js'), {
      namedExports: {
        checkCommand: () => ({ blocked: false, warnings: [] }),
        getDirectivesForPrompt: () => '',
      },
    });

    // Import ai.js AFTER all mocks are set up
    const aiModule = await import(join(__dirname, '..', 'ai.js'));
    chatFn = aiModule.chat;
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('injects closure message at iteration 10', async () => {
    const onEvent = (type, data) => {
      emittedEvents.push({ type, data });
    };

    await chatFn(
      { id: 1, os_type: 'linux', host: 'test', name: 'test' },
      'test message',
      [],
      'claude-sonnet-4-20250514',
      onEvent,
    );

    // Verify closure message was injected in the messages
    const closureText = 'IMPORTANTE: Has alcanzado el maximo de 10 iteraciones';
    const allMessages = lastCreateParams.messages;
    const closureMsg = allMessages.find(
      (m) => typeof m.content === 'string' && m.content.includes(closureText)
    );
    assert.ok(closureMsg, 'Closure message should be injected at iteration 10');
  });

  it('emits tool_limit event when loop exceeds MAX_TOOL_ITERATIONS', async () => {
    const onEvent = (type, data) => {
      emittedEvents.push({ type, data });
    };

    await chatFn(
      { id: 1, os_type: 'linux', host: 'test', name: 'test' },
      'test message',
      [],
      'claude-sonnet-4-20250514',
      onEvent,
    );

    const limitEvent = emittedEvents.find((e) => e.type === 'tool_limit');
    assert.ok(limitEvent, 'tool_limit event should be emitted');
    assert.ok(limitEvent.data.message.includes('Limite de 10 iteraciones'));
  });
});
