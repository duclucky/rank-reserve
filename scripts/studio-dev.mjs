import fs from 'node:fs';
import path from 'node:path';
import { abi } from 'genlayer-js';
import { safeReceipt } from './receipts.mjs';
import { ROOT,RPC,CHAIN,DEPLOYMENT,context,code,sourceHash,commit,dirty,gen,guard,report,loadJson,saveJson,view } from './network.mjs';

async function main() {
  const command=process.argv[2]??'preflight';
  guard(['preflight','smoke','deploy'].includes(command),'INVALID_COMMAND');
  const {roles,clients,publicClient}=await context(command!=='smoke');
  if(command==='preflight') {
    const balances={};
    for(const [role,account] of Object.entries(roles)) balances[role]={address:account.address,balance:gen(await publicClient.getBalance({address:account.address}))};
    console.log(JSON.stringify({stage:'PREFLIGHT',chainId:CHAIN,rpc:RPC,sdkDefaultRpc:publicClient.chain.rpcUrls.default.http[0],accounts:balances}));
    return;
  }
  if(command==='smoke') {
    const schema=await publicClient.getContractSchemaForCode(code());
    const methods=Object.keys(schema.methods??{}).sort();
    guard(methods.length===12&&methods.includes('create_pool')&&methods.includes('review_pool'),'SCHEMA_RECOGNITION_FAILED');
    const data=abi.transactions.serialize([code(),abi.calldata.encode(abi.calldata.makeCalldataObject(undefined,[])),false]);
    const result=await publicClient.request({method:'sim_call',params:[{type:'deploy',from:'0x0000000000000000000000000000000000000001',to:'0x0000000000000000000000000000000000000000',data}]});
    const proof={command:'node scripts/studio-dev.mjs smoke',at:new Date().toISOString(),chainId:CHAIN,rpc:RPC,sourceSha256:sourceHash(),executionResult:result?.execution_result??'UNKNOWN',methods,scope:'Unsigned exact-source constructor and schema simulation; no persistent deployment or finalized consensus'};
    saveJson(path.join(ROOT,'docs/evidence/studio-dev/smoke.json'),proof);
    console.log(JSON.stringify(proof)); guard(proof.executionResult==='SUCCESS','CONSTRUCTOR_SMOKE_FAILED');return;
  }
  const prior=loadJson(DEPLOYMENT);
  if(prior) {
    guard(prior.chainId===CHAIN&&prior.sourceSha256===sourceHash()&&prior.active,'ACTIVE_IDENTITY_MISMATCH');
    console.log(JSON.stringify({stage:'REUSED_DEPLOYMENT',contractAddress:prior.contractAddress}));return;
  }
  const pendingFile=path.join(ROOT,'.local/deploy-pending.json');let pending=loadJson(pendingFile);
  if(pending) guard(pending.chainId===CHAIN&&pending.sourceSha256===sourceHash(),'PENDING_IDENTITY_MISMATCH');
  else {
    guard(!dirty(),'DIRTY_TREE_DEPLOYMENT_REFUSED');
    const smoke=loadJson(path.join(ROOT,'docs/evidence/studio-dev/smoke.json'));
    guard(smoke?.sourceSha256===sourceHash()&&smoke.executionResult==='SUCCESS','EXACT_SOURCE_SMOKE_REQUIRED');
    const quote=await clients.sponsor.estimateTransactionFees();
    guard(await clients.sponsor.getBalance({address:roles.sponsor.address})>=quote.feeValue,'INSUFFICIENT_DEPLOYMENT_FEE_BALANCE');
    const hash=await clients.sponsor.deployContract({code:code(),args:[],fees:{distribution:quote.distribution,feeValue:quote.feeValue}});
    pending={hash,chainId:CHAIN,sourceSha256:sourceHash(),sourceCommit:commit(),feeDeposit:gen(quote.feeValue)};saveJson(pendingFile,pending);
  }
  console.log(JSON.stringify({stage:'DEPLOY_SUBMITTED_OR_RESUMED',transactionHash:pending.hash}));
  const receipt=await clients.sponsor.waitForTransactionReceipt({hash:pending.hash,waitUntil:'finalized',interval:5000,retries:120});
  const safe=safeReceipt(receipt,pending.hash);
  console.log(JSON.stringify({stage:'DEPLOY_RECEIPT',...safe}));
  guard(safe.status==='FINALIZED'&&safe.executionResult==='SUCCESS','DEPLOY_EXECUTION_FAILED');
  const address=safe.contractAddress;
  guard(/^0x[0-9a-fA-F]{40}$/.test(address),'DEPLOY_ADDRESS_MISSING');
  const schema=await publicClient.getContractSchema(address);
  guard(Object.keys(schema.methods??{}).length===12,'DEPLOYED_SCHEMA_FAILED');
  guard(await publicClient.getContractCode(address)===code(),'DEPLOYED_SOURCE_MISMATCH');
  const accounting=JSON.parse(String(await view(publicClient,address,'get_accounting')));
  guard(accounting.invariant&&accounting.received==='0 GEN'&&accounting.locked==='0 GEN'&&accounting.credits==='0 GEN','FRESH_ACCOUNTING_SMOKE_FAILED');
  const proof={network:'Studio Dev',chainId:CHAIN,rpc:RPC,contract:'RankReserve',contractAddress:address,contractVersion:'RR_V1',depends:'py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng',sourceCommit:pending.sourceCommit,sourceSha256:sourceHash(),sourceDirtyAtDeployment:false,deployedAt:new Date().toISOString(),active:true,status:'FINALIZED',deploy:safe,feeDeposit:pending.feeDeposit,explorerUrl:`https://explorer-studio-dev.genlayer.com/address/${address}`,deployTxUrl:`https://explorer-studio-dev.genlayer.com/transactions/${pending.hash}`,schemaMethods:Object.keys(schema.methods).sort(),smoke:{accounting},evidenceIsSanitized:true};
  saveJson(DEPLOYMENT,proof);fs.unlinkSync(pendingFile);console.log(JSON.stringify({stage:'DEPLOYMENT_PROVED',address,explorerUrl:proof.explorerUrl,accounting}));
}
main().catch(report);
