import { readFileSync } from 'node:fs';
import { createServer as httpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createHttpHandler } from './index.js';
import { toNodeHandler } from './node.js';
import { BridgeRegistry } from './bridge.js';
import { connectBridge } from './bridge-client.js';
import { installBridgeServer } from './bridge-server.js';
import * as contract from './contract.js';

describe('shared conformance', () => {
 const schemas = { request: contract.bridgeRequestSchema, response: contract.bridgeResponseSchema, server: contract.serverBridgeMessageSchema, desktop: contract.desktopBridgeMessageSchema, error: contract.bridgeErrorSchema };
 const cases = JSON.parse(readFileSync(new URL('../../conformance/cases.json', import.meta.url),'utf8'));
 for (const c of cases) it(c.name, () => expect(schemas[c.schema as keyof typeof schemas].safeParse(c.value).success).toBe(c.valid));
 it('limits UTF-8 bytes and rejects corrupt encodings', () => {
  expect(() => contract.parseFrame(contract.bridgeErrorSchema, new Uint8Array([0xc3,0x28]))).toThrow();
  expect(() => contract.parseFrame(z.unknown(), '"éé"', 5)).toThrow();
 });
});
describe('native MCP', () => {
 it('calls a tool using the official client and publishes outputs', async () => {
  const schema = z.object({ message: z.string() });
  const handler = createHttpHandler({ appId:'echo', name:'Echo', version:'1', maxPayloadBytes:1024, tools:[{ name:'echo', description:'Echo', inputSchema:schema, outputSchema:schema, execute:async input => { if((input as {message:string}).message==='oversized-error') throw new contract.McpError('DOMAIN','Failure',false,{private:'x'.repeat(2048)});return input as {message:string};} }] });
  const server = httpServer(toNodeHandler(handler)); await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const client = new Client({name:'conformance',version:'1'});
  try { await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`)));
   expect((await client.listTools()).tools[0].outputSchema).toMatchObject({type:'object'});
   expect(await client.callTool({name:'echo',arguments:{message:'hello'}})).toMatchObject({structuredContent:{message:'hello'}});
   const error=await client.callTool({name:'echo',arguments:{message:'oversized-error'}});expect(error).toMatchObject({isError:true,structuredContent:{code:'INTERNAL'}});expect(JSON.stringify(error)).not.toContain('private');
  } finally { await client.close(); await handler.close(); await new Promise<void>(resolve=>server.close(()=>resolve())); }
 });
});
class Socket {
 OPEN=1;readyState=1;frames:unknown[]=[];
 send(data:string,callback?:(error?:Error)=>void){this.frames.push(JSON.parse(data));callback?.();}
 close(){this.readyState=3;}
}
function registry(limits = {}) { return new BridgeRegistry({appId:'test',sessions:{isDesktopSessionActive:()=>true,hasActiveDesktopSession:()=>true},parseInput:(_,v)=>v,parseOutput:(_,v)=>v,isReadOnly:command=>command==='read',limits}); }
describe('bridge lifecycle',()=>{
 it('bounds desktop work even when a cancelled handler keeps running',async()=>{
  const r=registry(),server=httpServer();const stop=installBridgeServer(server,{publicUrl:'http://127.0.0.1',allowedHosts:['127.0.0.1'],allowedOrigins:[]},r);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  let started!:()=>void,aborted!:()=>void,finish!:()=>void;const running=new Promise<void>(resolve=>started=resolve),cancelled=new Promise<void>(resolve=>aborted=resolve);let calls=0;
  const desktop=await connectBridge({url:`ws://127.0.0.1:${(server.address() as AddressInfo).port}/v1/bridge`,ticket:r.issueTicket('u','s').ticket,appId:'test',appVersion:'1',limits:{maxInFlightRequests:1},execute:async(_command,input,context)=>{calls++;context.signal.addEventListener('abort',()=>aborted(),{once:true});started();await new Promise<void>(resolve=>finish=resolve);return input;}});
  try { while(!r.getPresence('u').online) await new Promise(resolve=>setTimeout(resolve,1));const controller=new AbortController(),work=r.dispatch('u','write',{}, {signal:controller.signal});const rejected=expect(work).rejects.toMatchObject({retryable:false});await running;controller.abort();await rejected;await cancelled;
   await expect(r.dispatch('u','write',{})).rejects.toMatchObject({code:'APP_OFFLINE',retryable:false});expect(calls).toBe(1);
  } finally {finish?.();await desktop.close();await stop();await new Promise<void>(resolve=>server.close(()=>resolve()));}
 });
 it('keeps legacy desktops compatible and rechecks revoked sessions',async()=>{
  let active=true;const r=new BridgeRegistry({appId:'test',sessions:{isDesktopSessionActive:()=>active,hasActiveDesktopSession:()=>active},parseInput:(_,v)=>v,parseOutput:(_,v)=>v,isReadOnly:()=>false});
  const socket=new Socket(),c=r.attach('u','s',socket);r.markReady(c,'legacy','1.0');
  const controller=new AbortController(),cancelled=r.dispatch('u','write',{}, {signal:controller.signal});const rejected=expect(cancelled).rejects.toMatchObject({retryable:false});controller.abort();await rejected;expect(socket.frames).toHaveLength(1);
  const ticket=r.issueTicket('u','s'),work=r.dispatch('u','write',{});const revoked=expect(work).rejects.toMatchObject({code:'USER_NOT_LOGGED_IN'});active=false;expect(r.consumeTicket(ticket.ticket)).toBeNull();
  const request=socket.frames[1] as {requestId:string};r.acceptResponse(c,{type:'response',requestId:request.requestId,ok:true,result:{}});await revoked;await expect(r.dispatch('u','write',{})).rejects.toMatchObject({code:'USER_NOT_LOGGED_IN'});r.close();
 });
 it('consumes tickets once',()=>{const r=registry();const ticket=r.issueTicket('u','s');expect(r.consumeTicket(ticket.ticket)).not.toBeNull();expect(r.consumeTicket(ticket.ticket)).toBeNull();r.close();});
 it('cancels writes without suggesting retry and ignores late replies',async()=>{
  const r=registry(),socket=new Socket(),c=r.attach('u','s',socket);r.markReady(c,'1','2.0');const controller=new AbortController();const work=r.dispatch('u','write',{}, {signal:controller.signal});const assertion=expect(work).rejects.toMatchObject({code:'CANCELLED',retryable:false,details:{outcome:'unknown'}});controller.abort();await assertion;
  expect(socket.frames[1]).toMatchObject({type:'cancel'});const request=socket.frames[0] as {requestId:string};r.acceptResponse(c,{type:'response',requestId:request.requestId,ok:true,result:{}});expect(c.pending.size).toBe(0);r.close();
 });
 it('times out mutating work and bounds concurrent requests',async()=>{
  const r=registry({requestTimeoutMs:15,maxInFlightRequests:1}),socket=new Socket(),c=r.attach('u','s',socket);r.markReady(c,'1','2.0');const work=r.dispatch('u','write',{});const timeout=expect(work).rejects.toMatchObject({code:'TIMEOUT',retryable:false});await expect(r.dispatch('u','read',{})).rejects.toMatchObject({code:'OVERLOADED'});await timeout;r.close();
 });
 it('isolates replacement connections',async()=>{
  const r=registry(),socket=new Socket(),old=r.attach('u','s',socket);r.markReady(old,'1');const work=r.dispatch('u','write',{});const assertion=expect(work).rejects.toMatchObject({retryable:false});const current=r.attach('u','s',new Socket());r.markReady(current,'2','2.0');await assertion;r.detach(old);expect(r.getPresence('u').online).toBe(true);r.close();
 });
 it('cancels real desktop work and keeps payloads out of gateway logs',async()=>{
  const logs:unknown[]=[];const r=registry(),server=httpServer();const stop=installBridgeServer(server,{publicUrl:'http://127.0.0.1',allowedHosts:['127.0.0.1'],allowedOrigins:[]},r,{info:v=>logs.push(v)});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const ticket=r.issueTicket('u','s');let started!:()=>void;const running=new Promise<void>(resolve=>started=resolve);let cancelled=false;
  const desktop=await connectBridge({url:`ws://127.0.0.1:${(server.address() as AddressInfo).port}/v1/bridge`,ticket:ticket.ticket,appId:'test',appVersion:'1',execute:async(_command,input,context)=>{started();await new Promise<void>(resolve=>context.signal.addEventListener('abort',()=>{cancelled=true;resolve();},{once:true}));context.signal.throwIfAborted();return input;}});
  try { while(!r.getPresence('u').online) await new Promise(resolve=>setTimeout(resolve,1));const controller=new AbortController();const work=r.dispatch('u','write',{secret:'private-payload'}, {signal:controller.signal});const rejected=expect(work).rejects.toMatchObject({retryable:false});await running;controller.abort();await rejected;await new Promise(resolve=>setTimeout(resolve,15));expect(cancelled).toBe(true); }
  finally {await desktop.close();await stop();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  expect(JSON.stringify(logs)).not.toContain('private-payload');expect(JSON.stringify(logs)).not.toContain(ticket.ticket);
 });
});
