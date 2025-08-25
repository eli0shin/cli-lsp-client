import { test, describe, expect } from 'bun:test';
import { spawn } from 'child_process';
import { CLI_PATH } from './test-utils.js';

async function runMcpServer(
  requests: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(CLI_PATH, ['mcp-server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const responses: Record<string, unknown>[] = [];
    let buffer = '';
    let sentRequests = 0;

    // Parse JSON-RPC responses
    const parseBuffer = () => {
      const lines = buffer.split('\n');
      buffer = lines[lines.length - 1]; // Keep incomplete line

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('Starting LSPs')) { // Filter out daemon startup messages
          try {
            const response = JSON.parse(line) as Record<string, unknown>;
            responses.push(response);

            // Send next request after receiving response
            if (sentRequests < requests.length && responses.length === sentRequests) {
              proc.stdin?.write(JSON.stringify(requests[sentRequests]) + '\n');
              sentRequests++;
            }

            // If we've received all expected responses, close the server
            if (responses.length === requests.length) {
              setTimeout(() => {
                proc.kill();
              }, 100);
            }
          } catch (e) {
            // Invalid JSON, ignore
          }
        }
      }
    };

    proc.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      parseBuffer();
    });

    proc.stderr?.on('data', () => {
      // Ignore stderr for now - LSP server logs go there
    });

    proc.on('error', reject);

    proc.on('close', () => {
      resolve(responses);
    });

    // Send first request to start the sequence
    if (requests.length > 0) {
      proc.stdin?.write(JSON.stringify(requests[0]) + '\n');
      sentRequests = 1;
    }

    // Set timeout to avoid hanging tests
    setTimeout(() => {
      proc.kill();
      resolve(responses);
    }, 10000); // Increased timeout for daemon startup
  });
}

describe('MCP Server', () => {
  test('should initialize successfully', async () => {
    const responses = await runMcpServer([
      {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-10-07',
          capabilities: { tools: {} },
          clientInfo: { name: 'test', version: '1.0.0' },
        },
        id: 1,
      },
    ]);

    expect(responses).toEqual([
      {
        result: {
          protocolVersion: '2024-10-07',
          capabilities: {
            tools: {
              listChanged: true
            }
          },
          serverInfo: {
            name: 'lsp-code-intelligence',
            version: '1.0.0',
          }
        },
        jsonrpc: '2.0',
        id: 1
      }
    ]);
  }, 15000);

  test('should list available tools', async () => {
    const responses = await runMcpServer([
      {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-10-07',
          capabilities: { tools: {} },
          clientInfo: { name: 'test', version: '1.0.0' },
        },
        id: 1,
      },
      {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 2,
      },
    ]);

    expect(responses[1]).toEqual({
      result: {
        tools: [{
          name: 'get-symbol-definition',
          title: 'Get Symbol Definition and Documentation',
          description: `Retrieves comprehensive information about a symbol's definition, type signature, and documentation from a Language Server Protocol (LSP) provider.

Use this tool when you need to:
- Understand what a function, variable, class, or type does
- Get the type signature or function parameters of a symbol
- Read documentation or comments associated with a symbol
- Investigate unfamiliar code symbols in a codebase
- Verify the expected behavior or contract of an API

This tool performs the equivalent of "hovering" over a symbol in an IDE, providing rich contextual information that helps understand code without navigating to the definition.`,
          inputSchema: {
            '$schema': 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            properties: {
              file: {
                type: 'string',
                description: 'The absolute or relative file path containing the symbol (e.g., "src/utils.ts", "/home/user/project/main.py")'
              },
              symbol: {
                type: 'string',
                description: 'The exact symbol name to look up (e.g., "calculateTotal", "MyClass", "MAX_SIZE"). Case-sensitive.'
              }
            },
            required: ['file', 'symbol'],
            additionalProperties: false
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false
          }
        }]
      },
      jsonrpc: '2.0',
      id: 2
    });
  }, 15000);

  test('should call get-symbol-definition tool successfully', async () => {
    const responses = await runMcpServer([
      {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-10-07',
          capabilities: { tools: {} },
          clientInfo: { name: 'test', version: '1.0.0' },
        },
        id: 1,
      },
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get-symbol-definition',
          arguments: {
            file: 'tests/fixtures/typescript/valid/simple-function.ts',
            symbol: 'add',
          },
        },
        id: 2,
      },
    ]);

    // The symbol definition text without ANSI color codes (tool now returns plain text)
    const expectedHoverText = `Declaration: tests/fixtures/typescript/valid/simple-function.ts:6:16

\`\`\`typescript
function add(a: number, b: number): number
\`\`\`
Adds two numbers together

*@param* \`a\` — The first number  

*@param* \`b\` — The second number  

*@returns* — The sum of a and b`;

    expect(responses[1]).toEqual({
      result: {
        content: [{
          type: 'text',
          text: expectedHoverText
        }]
      },
      jsonrpc: '2.0',
      id: 2
    });
  }, 15000);

  test('should handle non-existent file gracefully', async () => {
    const responses = await runMcpServer([
      {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-10-07',
          capabilities: { tools: {} },
          clientInfo: { name: 'test', version: '1.0.0' },
        },
        id: 1,
      },
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get-symbol-definition',
          arguments: {
            file: 'tests/fixtures/nonexistent.ts',
            symbol: 'foo',
          },
        },
        id: 2,
      },
    ]);

    expect(responses[1]).toEqual({
      result: {
        content: [{
          type: 'text',
          text: 'Error: File does not exist: tests/fixtures/nonexistent.ts'
        }]
      },
      jsonrpc: '2.0',
      id: 2
    });
  }, 15000);

  test('should handle invalid tool name', async () => {
    const responses = await runMcpServer([
      {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-10-07',
          capabilities: { tools: {} },
          clientInfo: { name: 'test', version: '1.0.0' },
        },
        id: 1,
      },
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'invalid-tool',
          arguments: {},
        },
        id: 2,
      },
    ]);

    expect(responses[1]).toEqual({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -32602,
        message: 'MCP error -32602: Tool invalid-tool not found'
      }
    });
  }, 15000);

  test('should validate get-symbol-definition tool arguments', async () => {
    const responses = await runMcpServer([
      {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-10-07',
          capabilities: { tools: {} },
          clientInfo: { name: 'test', version: '1.0.0' },
        },
        id: 1,
      },
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'get-symbol-definition',
          arguments: {
            // Missing required 'symbol' field
            file: 'test.ts',
          },
        },
        id: 2,
      },
    ]);

    expect(responses[1]).toEqual({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -32602,
        message: expect.stringContaining('symbol') as unknown
      }
    });
  }, 15000);
});