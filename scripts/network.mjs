import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createAccount, createClient } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RPC = 'https://studio-next.genlayer.com/api';
export const CHAIN = 61997;
export const GEN = 10n ** 18n;
export const SOURCE = path.join(ROOT, 'contracts', 'rank_reserve.py');
export const DEPLOYMENT = path.join(ROOT, 'docs', 'evidence', 'studio-dev', 'deployment.json');
export function fail(code) { const error = new Error(code); error.safeCode = code; throw error; }
export function guard(condition, code) { if (!condition) fail(code); }
export function report(error) { console.error(JSON.stringify({error: error?.safeCode ?? 'NETWORK_OR_RUNTIME_ERROR', rpcErrorCode: Number.isInteger(error?.code) ? error.code : null})); process.exitCode = 1; }
export function loadJson(file, fallback = null) { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; }
export function saveJson(file, value) { fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, JSON.stringify(value, null, 2)+'\n'); }
export function code() { return fs.readFileSync(SOURCE, 'utf8'); }
export function sourceHash() { return crypto.createHash('sha256').update(fs.readFileSync(SOURCE)).digest('hex'); }
export function commit() { return execFileSync('git', ['rev-parse','HEAD'], {cwd:ROOT,encoding:'utf8'}).trim(); }
export function dirty() { return !!execFileSync('git',['status','--porcelain'],{cwd:ROOT,encoding:'utf8'}).trim(); }
export function gen(value) { const n=BigInt(value); const f=n%GEN; return `${n/GEN}${f ? '.'+f.toString().padStart(18,'0').replace(/0+$/,'') : ''} GEN`; }
export function amount(text) { guard(/^\d+(\.\d{1,18})? GEN$/.test(text),'INVALID_GEN_VIEW'); const [w,f='']=text.slice(0,-4).split('.'); return BigInt(w)*GEN+BigInt(f.padEnd(18,'0')); }
export function accounts() {
  const values={};
  for(const file of [path.join(ROOT,'.env'),path.resolve(ROOT,'..','.env')]) {
    if(!fs.existsSync(file)) continue;
    for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)) {
      if(line.trimStart().startsWith('#')) continue;
      const i=line.indexOf('='); if(i<=0) continue;
      const key=line.slice(0,i).trim(); let value=line.slice(i+1).trim();
      if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1);
      if(value && !values[key]) values[key]=value;
    }
  }
  const names={sponsor:'STUDIONET_PRIVATE_KEY',alice:'STUDIONET_INTEGRATOR_PRIVATE_KEY',bob:'STUDIONET_STEWARD_PRIVATE_KEY'};
  const result={};
  for(const [role,name] of Object.entries(names)) {
    const key=values[name]?.trim()??''; guard(/^(0x)?[0-9a-fA-F]{64}$/.test(key),'MISSING_AUTHORIZED_CONFIGURATION');
    result[role]=createAccount(key.startsWith('0x')?key:'0x'+key);
  }
  guard(new Set(Object.values(result).map(a=>a.address.toLowerCase())).size===3,'ROLE_SEPARATION_REQUIRED');
  return result;
}
export async function context(withAccounts=true) {
  guard(studioDevnet.id===CHAIN,'SDK_CHAIN_MISMATCH');
  const roles=withAccounts?accounts():{};
  const publicClient=createClient({chain:studioDevnet,endpoint:RPC});
  guard(Number(BigInt(await publicClient.request({method:'eth_chainId',params:[]})))===CHAIN,'RPC_CHAIN_MISMATCH');
  const clients=Object.fromEntries(Object.entries(roles).map(([role,account])=>[role,createClient({chain:studioDevnet,endpoint:RPC,account})]));
  return {roles,clients,publicClient};
}
export async function view(client,address,functionName,args=[]) { return client.readContract({address,functionName,args,transactionHashVariant:'latest-final'}); }
