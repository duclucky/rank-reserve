// Unsigned runtime metadata check; no keys or transaction submission.
import path from 'node:path';
import {abi} from 'genlayer-js';
import {ROOT,RPC,GEN,DEPLOYMENT,context,loadJson,saveJson,guard,report,view,gen} from './network.mjs';
async function main() {
  const d=loadJson(DEPLOYMENT);const {publicClient}=await context(false);
  const schema=await publicClient.getContractSchema(d.contractAddress);
  const writes=['create_pool','ratify_claim','review_pool','expire_pool','withdraw_credit','close_pool'];
  guard(!!schema.ctor,'CONSTRUCTOR_SCHEMA_REQUIRED');
  const metadata={};
  for(const name of writes) {const m=schema.methods?.[name];guard(m&&m.readonly===false&&m.payable===(name==='create_pool'),'PAYABLE_METADATA_MISMATCH');metadata[name]={readonly:false,payable:m.payable};}
  const before=JSON.parse(String(await view(publicClient,d.contractAddress,'get_accounting')));
  const nativeBefore=gen(await publicClient.getBalance({address:d.contractAddress}));
  const data=abi.transactions.serialize([abi.calldata.encode(abi.calldata.makeCalldataObject('ratify_claim',['rr-metadata-absent','0'.repeat(64)])),false]);
  const response=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'sim_call',params:[{type:'write',to:d.contractAddress,from:'0x0000000000000000000000000000000000000001',value:'0x'+GEN.toString(16),data,sim_config:{genvm_datetime:new Date().toISOString()}}]})});
  const envelope=await response.json();const receipt=envelope.result??envelope.error?.data?.receipt;
  const resultText=typeof receipt?.result==='string'?(receipt.result.startsWith('0x')?Buffer.from(receipt.result.slice(2),'hex'):Buffer.from(receipt.result,'base64')).toString('utf8'):'';
  const rejectedNonpayable=/not payable|non.?payable/i.test(resultText+' '+JSON.stringify(receipt?.genvm_result??{}));
  const after=JSON.parse(String(await view(publicClient,d.contractAddress,'get_accounting')));
  const nativeAfter=gen(await publicClient.getBalance({address:d.contractAddress}));
  guard(receipt?.execution_result==='ERROR'&&rejectedNonpayable,'RUNTIME_NONPAYABLE_REJECTION_REQUIRED');
  // No simulated call writes canonical state. Concurrent finalized demo actions
  // can legitimately change it; record both observations without claiming isolation.
  const proof={command:'node scripts/metadata-smoke.mjs',mode:'UNSIGNED_METADATA_SMOKE',at:new Date().toISOString(),chainId:d.chainId,contractAddress:d.contractAddress,hasConstructor:true,metadata,nonpayableValue:'1 GEN',executionResult:'ERROR',rejectedNonpayable:true,accountingBefore:before,accountingAfter:after,nativeBefore,nativeAfter,noTransactionSubmitted:true};
  saveJson(path.join(ROOT,'docs/evidence/studio-dev/metadata-smoke.json'),proof);console.log(JSON.stringify(proof));
}
main().catch(report);
