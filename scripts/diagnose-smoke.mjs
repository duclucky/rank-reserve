// Unsigned write diagnostics. Only named execution/error categories are projected.
import path from 'node:path';
import {abi} from 'genlayer-js';
import {ROOT,RPC,DEPLOYMENT,GEN,context,loadJson,saveJson,report,gen} from './network.mjs';
async function main() {
  const d=loadJson(DEPLOYMENT);const {roles,publicClient}=await context();
  const now=Math.floor(Date.now()/1000);
  const claims=JSON.stringify([{payee:roles.alice.address,face_gen:2,scope:'Undertakes to restore production authentication.'},{payee:roles.bob.address,face_gen:2,scope:'Undertakes to add optional dashboard themes.'}]);
  const args=['rr-unsigned-smoke','Existing production service restoration is priority.',claims,now+3600,now+7200];
  const data=abi.transactions.serialize([abi.calldata.encode(abi.calldata.makeCalldataObject('create_pool',args)),false]);
  const explicitClock=process.argv.includes('--explicit-simulation-clock');
  const response=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'sim_call',params:[{type:'write',to:d.contractAddress,from:roles.sponsor.address,value:'0x'+(2n*GEN).toString(16),data,...(explicitClock?{sim_config:{genvm_datetime:new Date().toISOString()}}:{})}]}),signal:AbortSignal.timeout(55000)});
  const envelope=await response.json();const r=envelope.result??envelope.error;
  const known=['invalid canonical time','invalid future deadlines','deposit must be 1-100 whole GEN','reserve must be scarce','invalid claims JSON','invalid bounded ASCII text','pool accounting invariant','global accounting invariant'];
  const diagnostic={mode:'UNSIGNED_SIMULATION',explicitSimulationClock:explicitClock,rpcErrorCode:envelope.error?.code??null,executionResult:r?.execution_result??envelope.error?.data?.receipt?.execution_result??'UNKNOWN',value:'2 GEN',contractErrors:[],exceptionTypes:[],sourceLines:[],errorFieldNames:Object.keys(envelope.error??{}),errorDataFieldNames:Object.keys(envelope.error?.data??{}),receiptFieldNames:Object.keys(envelope.error?.data?.receipt??{}),runtimeCategories:[]};
  function visit(x,decoded=false) {
    if(typeof x==='string') {
      for(const k of known)if(x.includes(k)&&!diagnostic.contractErrors.includes(k))diagnostic.contractErrors.push(k);
      for(const k of ['AttributeError','TypeError','NameError','ValueError','ImportError','UserError','AssertionError','OutOfGas','StorageError','VMError','TypeMismatch'])if(x.includes(k)&&!diagnostic.exceptionTypes.includes(k))diagnostic.exceptionTypes.push(k);
      for(const k of ['insufficient','payable','datetime','storage','fees','budget','calldata','schema','not found','execution failed','out of gas','module','unsupported','RPC'])if(x.toLowerCase().includes(k.toLowerCase())&&!diagnostic.runtimeCategories.includes(k))diagnostic.runtimeCategories.push(k);
      for(const match of x.matchAll(/File "(?:[^"\n]*rank_reserve\.py|contract)", line (\d+)/g))diagnostic.sourceLines.push(Number(match[1]));
      if(!decoded&&x.length>8&&x.length<200000&&/^[A-Za-z0-9+/=]+$/.test(x)) {try {const bytes=Buffer.from(x,'base64');visit(bytes.toString('utf8'),true);try{visit(abi.calldata.decode(bytes.subarray(1)),true);}catch{}}catch{}}
    }else if(x&&typeof x==='object')for(const v of Object.values(x))visit(v);
  }
  const receipt=envelope.result??envelope.error?.data?.receipt;
  visit(receipt?.result);
  visit(receipt?.genvm_result?.result);
  visit(receipt?.genvm_result?.stdout);
  visit(receipt?.genvm_result?.stderr);
  diagnostic.accounting=JSON.parse(String(await publicClient.readContract({address:d.contractAddress,functionName:'get_accounting'})));
  diagnostic.nativeBalance=gen(await publicClient.getBalance({address:d.contractAddress}));
  saveJson(path.join(ROOT,'docs/evidence/studio-dev/'+(explicitClock?'write-smoke-clock.json':'write-smoke-diagnostic.json')),diagnostic);
  console.log(JSON.stringify(diagnostic));
}
main().catch(report);
