import { z } from 'zod';
import { createServer, createHttpHandler } from '@nox/mcp';
import { serveStdio, toNodeHandler } from '@nox/mcp/node';
import { createServer as httpServer } from 'node:http';
const schema = z.object({ message: z.string().max(200) });
const options = { appId: 'echo', name: 'NoX Echo', version: '0.1.0', tools: [{ name: 'echo', description: 'Echo a message', inputSchema: schema, outputSchema: schema, annotations: { readOnlyHint: true }, execute: async (input, context) => { context.signal.throwIfAborted(); return input; } }] };
if (process.argv.includes('--http')) httpServer(toNodeHandler(createHttpHandler(options))).listen(8089, '127.0.0.1');
else await serveStdio(createServer(options));
