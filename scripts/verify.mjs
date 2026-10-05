// Read-only acceptance verification. No keys, signing, funding or writes.
import path from 'node:path';
import crypto from 'node:crypto';
import {safeReceipt} from './receipts.mjs';
import {settledTransferFee} from './transfer-fees.mjs';
import {ROOT,DEPLOYMENT,CHAIN,context,sourceHash,gen,amount,addressArg,guard,report,loadJson,saveJson,view} from './network.mjs';
async function main() {
  const d=loadJson(DEPLOYMENT);const lifecycle=loadJson(path.join(ROOT,'docs/evidence/studio-dev/lifecycle.json'));
  guard(d?.active&&lifecycle?.contractAddress===d.contractAddress&&d.chainId===CHAIN&&lifecycle.chainId===CHAIN,'COMPLETE_LIFECYCLE_IDENTITY_REQUIRED');
  const {publicClient}=await context(false);const address=d.contractAddress;
  const deployedHash=crypto.createHash('sha256').update(await publicClient.getContractCode(address)).digest('hex');
  guard(deployedHash===sourceHash()&&deployedHash===d.sourceSha256,'EXACT_DEPLOYED_SOURCE_REQUIRED');
  const schema=await publicClient.getContractSchema(address);guard(Object.keys(schema.methods??{}).length===12,'SCHEMA_REQUIRED');
  const read=async(method,args=[])=>JSON.parse(String(await view(publicClient,address,method,args)));
  const accounting=await read('get_accounting');const nativeBalance=gen(await publicClient.getBalance({address}));
  guard(accounting.invariant&&accounting.received==='8 GEN'&&accounting.withdrawn==='8 GEN'&&accounting.locked==='0 GEN'&&accounting.credits==='0 GEN'&&nativeBalance==='0 GEN','GLOBAL_ZERO_LIABILITY_REQUIRED');
  const pools={};const receipts=[];const withdrawals=[];
  const deployReceipt=safeReceipt(await publicClient.getTransaction({hash:d.deploy.transactionHash}),d.deploy.transactionHash);
  guard(deployReceipt.status==='FINALIZED'&&deployReceipt.executionResult==='SUCCESS','SUCCESSFUL_DEPLOYMENT_REQUIRED');receipts.push({step:'deploy',...deployReceipt});
  for(const [name,item] of Object.entries(lifecycle.pools)) {
    const p=await read('get_pool',[item.id]);guard(p.phase==='CLOSED'&&p.locked==='0 GEN'&&p.credits==='0 GEN'&&p.withdrawn==='2 GEN','CLOSED_POOL_REQUIRED');
    const claims=await Promise.all([0,1].map(i=>read('get_claim',[item.id,i])));
    const verdict=p.attempts?await read('get_attempt',[item.id,p.attempts]):null;
    if(name==='senior')guard(claims[0].class==='PRIORITY'&&claims[0].allocated==='2 GEN'&&claims[1].class==='STANDARD'&&claims[1].allocated==='0 GEN','SENIOR_MEANING_REQUIRED');
    if(name==='equal')guard(claims.every(c=>c.class==='PRIORITY'&&c.allocated==='1 GEN'),'EQUAL_TIER_MEANING_REQUIRED');
    if(name==='unverifiable')guard(verdict?.unverifiable&&item.afterReview.locked==='2 GEN'&&item.afterReview.credits==='0 GEN'&&item.afterExpiry.phase==='REFUNDED','NONPENALIZING_RECOVERY_REQUIRED');
    if(name==='expiry')guard(p.attempts===0&&item.afterExpiry.phase==='REFUNDED','UNRATIFIED_EXPIRY_REQUIRED');
    for(const recipient of Object.values(lifecycle.roles))guard(String(await view(publicClient,address,'get_credit',[item.id,addressArg(recipient)]))==='0 GEN','NO_RESIDUAL_CREDIT_REQUIRED');
    pools[name]={pool:p,claims,verdict};
    for(const [role,proof] of Object.entries(item.withdrawals)) {
      const hash=proof.parentReceipt.transactionHash;
      const tx=await publicClient.getTransaction({hash});const safe=safeReceipt(tx,hash);
      guard(safe.status==='FINALIZED'&&safe.executionResult==='SUCCESS','WITHDRAWAL_RECEIPT_REQUIRED');
      const fee=tx.data?.fee_accounting??tx.fee_accounting;
      guard(fee?.status==='settled'&&fee.paid_fee_value!==undefined&&fee.total_refunded!==undefined,'SETTLED_FEE_PROOF_REQUIRED');
      const reconciled=settledTransferFee(fee,proof.recipient);
      guard(amount(proof.amount)-amount(proof.recipientNetIncrease)===reconciled.netCharged,'EXACT_RECIPIENT_FEE_EQUATION_REQUIRED');
      guard(amount(proof.nativeBefore)-amount(proof.nativeAfter)===amount(proof.amount)&&proof.nativeDecrease===proof.amount,'EXACT_NATIVE_DECREASE_REQUIRED');
      const message=tx.messages?.find(m=>String(m.recipient).toLowerCase()===proof.recipient.toLowerCase()&&BigInt(m.value)===amount(proof.amount));guard(message,'EXACT_RECIPIENT_MESSAGE_REQUIRED');
      const childIds=await publicClient.getTriggeredTransactionIds({hash});
      guard(childIds.length===proof.childReceipts.length,'CHILD_EVIDENCE_COVERAGE_REQUIRED');
      for(const child of proof.childReceipts) {
        const childReceipt=safeReceipt(await publicClient.getTransaction({hash:child.transactionHash}),child.transactionHash);
        guard(childReceipt.status==='FINALIZED'&&childReceipt.executionResult==='SUCCESS','FINALIZED_CHILD_REQUIRED');
      }
      withdrawals.push({case:name,role,parentReceipt:safe,recipient:proof.recipient,amount:proof.amount,nativeBefore:proof.nativeBefore,nativeAfter:proof.nativeAfter,nativeDecrease:proof.nativeDecrease,recipientBefore:proof.recipientBefore,recipientAfter:proof.recipientAfter,recipientNetIncrease:proof.recipientNetIncrease,fee:reconciled.proof,equation:'recipient net increase + paid fee - total refunded - separate recipient external fee payout = transfer amount',message:{recipient:proof.recipient,value:gen(message.value)},childReceipts:proof.childReceipts,childBoundary:proof.childBoundary});
    }
  }
  for(const [step,stored] of Object.entries(lifecycle.transactions)) {
    const tx=await publicClient.getTransaction({hash:stored.transactionHash});const safe=safeReceipt(tx,stored.transactionHash);
    guard(safe.status==='FINALIZED'&&safe.executionResult==='SUCCESS','ALL_RECEIPTS_SUCCESS_REQUIRED');
    const proof={step,...safe};
    if(stored.method==='review_pool') {
      const consensus={leaderOnly:tx.leader_only,initialValidators:Number(tx.num_of_initial_validators),result:tx.result_name};
      guard(consensus.leaderOnly===false&&consensus.initialValidators>=2&&consensus.result==='MAJORITY_AGREE','SEMANTIC_CONSENSUS_REQUIRED');proof.consensus=consensus;
    }
    receipts.push(proof);
  }
  const explorer=[];
  for(const url of [d.explorerUrl,d.deployTxUrl]) {const response=await fetch(url);guard(response.ok,'EXPLORER_REACHABILITY_REQUIRED');explorer.push({url,httpStatus:response.status});}
  const proof={command:'node scripts/verify.mjs',at:new Date().toISOString(),mode:'READ_ONLY',network:'Studio Dev',chainId:CHAIN,contractAddress:address,sourceSha256:deployedHash,methodCount:12,pools,receipts,withdrawals,accounting,nativeBalance,explorer,evidenceIsSanitized:true};
  saveJson(path.join(ROOT,'docs/evidence/studio-dev/reverification.json'),proof);
  console.log(JSON.stringify({stage:'STUDIO_DEV_VERIFY_PASS',address,cases:Object.keys(pools).length,receipts:receipts.length,withdrawals:withdrawals.length,accounting,nativeBalance,explorer}));
}
main().catch(report);
