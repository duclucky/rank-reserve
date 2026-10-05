import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createAccount, createClient, abi, normalizeMessageFeeAllocations } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';
import {CalldataAddress} from 'genlayer-js/types';
import {hexToBytes} from 'viem';
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
export function addressArg(address) { guard(/^0x[0-9a-fA-F]{40}$/.test(address),'INVALID_ADDRESS_ARGUMENT'); return new CalldataAddress(hexToBytes(address)); }
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
export async function measuredFees(client,address,functionName,args,value,messageAllocations) {
  // Studio's unsigned write simulation omits canonical transaction time by default.
  // Bind only the profiling simulation to the actual current time; signed writes
  // use the network transaction timestamp and never carry sim_config.
  const baseline=await client.estimateTransactionFees(messageAllocations?{messageAllocations}:{});
  const data=abi.transactions.serialize([abi.calldata.encode(abi.calldata.makeCalldataObject(functionName,args)),false]);
  const request={type:'write',to:address,from:client.account.address,data,value:'0x'+value.toString(16),sim_config:{genvm_datetime:new Date().toISOString()},fees:{distribution:baseline.distribution,feeValue:baseline.feeValue,...(baseline.messageAllocations?{messageAllocations:normalizeMessageFeeAllocations(baseline.messageAllocations)}:{})}};
  const response=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'sim_call',params:[request]},(key,item)=>typeof item==='bigint'?item.toString():item),signal:AbortSignal.timeout(55000)});
  const envelope=await response.json();
  if(envelope.error||envelope.result?.execution_result!=='SUCCESS') {
    const receipt=envelope.result??envelope.error?.data?.receipt;
    const text=typeof receipt?.result==='string'?Buffer.from(receipt.result,'base64').toString('utf8'):'';
    const categories=['AttributeError','TypeError','NameError','ValueError','UserError','InsufficientFees','BudgetTooLow','MessageAllocationsNotEqualBudget','AllocationTreeMalformed','AllocationLifecycleBudgetInsufficient','AllocationTreeBudgetInconsistent','AllocationSubtreeMismatch','AllocationDuplicateKey','AllocationTreeTooDeep','ExternalAllocationInvalid','InvalidFeeParams','MessageNoMatchingAllocation','MessageEmissionPhaseMismatch','MessageFeeParamsMismatch','insufficient','allocation','budget','not expired','no credit','withdraw state'].filter(word=>(text+' '+String(envelope.error?.message??'')).toLowerCase().includes(word.toLowerCase()));
    console.log(JSON.stringify({stage:'FEE_SIMULATION_ERROR',method:functionName,executionResult:receipt?.execution_result??'UNKNOWN',rpcErrorCode:envelope.error?.code??null,categories}));
  }
  guard(response.ok&&!envelope.error&&envelope.result?.execution_result==='SUCCESS','TIMESTAMPED_FEE_SIMULATION_FAILED');
  const receipt=envelope.result;
  return client.estimateTransactionFeesFromSimulation({simulation:{receipt,feeAccounting:receipt.genvm_result?.fee_accounting,feeReport:receipt.genvm_result?.fee_accounting?.execution_fee_report},...(messageAllocations?{messageAllocations}:{})});
}
