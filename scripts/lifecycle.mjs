import path from 'node:path';
import { CALL_KEY_UNNAMED,MessageType,encodeExternalMessageFeeParams } from 'genlayer-js';
import {safeReceipt} from './receipts.mjs';
import {ROOT,DEPLOYMENT,CHAIN,GEN,context,sourceHash,gen,amount,guard,report,loadJson,saveJson,view,measuredFees,addressArg} from './network.mjs';
const STATE=path.join(ROOT,'.local/lifecycle.json');
const EVIDENCE=path.join(ROOT,'docs/evidence/studio-dev/lifecycle.json');
const CHARTER='Restoring an unavailable existing production service is PRIORITY. Adding optional new features is STANDARD. Insufficient or conflicting descriptions are UNVERIFIABLE.';
async function main() {
  const deployment=loadJson(DEPLOYMENT);
  guard(deployment?.chainId===CHAIN&&deployment.sourceSha256===sourceHash()&&deployment.active,'DEPLOYMENT_IDENTITY_REQUIRED');
  const {roles,clients,publicClient}=await context();const address=deployment.contractAddress;
  const state=loadJson(STATE,{contractAddress:address,pools:{},transactions:{}});
  guard(state.contractAddress===address,'LIFECYCLE_IDENTITY_MISMATCH');
  const persist=()=>saveJson(STATE,state);
  const read=async(method,args=[])=>JSON.parse(String(await view(publicClient,address,method,args)));
  const credit=async(pool,role)=>amount(String(await view(publicClient,address,'get_credit',[pool,addressArg(roles[role].address)])));
  async function waitCanonical(method,key,role) {
    const id=state.pools[key.split(':')[0]].id;
    for(let attempt=0;attempt<20;attempt++) {
      let applied=false;
      try {
        if(method==='create_pool')applied=(await read('get_pool_ids')).includes(id);
        else if(method==='ratify_claim')applied=(await read('get_claim',[id,role==='alice'?0:1])).ratified;
        else if(method==='withdraw_credit')applied=await credit(id,role)===0n;
        else {const p=await read('get_pool',[id]);applied=method==='review_pool'?p.attempts>0&&['SETTLED','RETRYABLE'].includes(p.phase):method==='expire_pool'?p.phase==='REFUNDED':method==='close_pool'&&p.phase==='CLOSED';}
      }catch{}
      if(applied)return;
      await new Promise(resolve=>setTimeout(resolve,2000));
    }
    guard(false,'FINALIZED_CANONICAL_APPLICATION_NOT_OBSERVED');
  }
  async function finishPending() {
    if(!state.pending)return;
    const {hash,key,role,method,feeDeposit}=state.pending;
    const r=await clients[role].waitForTransactionReceipt({hash,waitUntil:'finalized',interval:3000,retries:180});
    const safe=safeReceipt(r,hash);
    state.transactions[key]={role,method,feeDeposit,...safe};persist();
    console.log(JSON.stringify({stage:'FINALIZED_OR_RECOVERED',step:key,...safe}));
    guard(safe.status==='FINALIZED'&&safe.executionResult==='SUCCESS','LIFECYCLE_EXECUTION_FAILED');
    await waitCanonical(method,key,role);
    state.pending=null;persist();
  }
  await finishPending();
  async function write(key,role,method,args,value=0n) {
    guard(!state.transactions[key],'DUPLICATE_STEP_REFUSED');
    const c=clients[role];
    const allocations=method==='withdraw_credit'?[{messageType:MessageType.External,recipient:roles[role].address,callKey:CALL_KEY_UNNAMED,budget:42000n,feeParams:encodeExternalMessageFeeParams({gasLimit:21000n,maxGasPrice:2n})}]:undefined;
    const quote=await measuredFees(c,address,method,args,value,allocations);
    guard(await c.getBalance({address:roles[role].address})>=value+quote.feeValue,'ACTOR_BALANCE_BELOW_MEASURED_FEE');
    const hash=await c.writeContract({address,functionName:method,args,value,fees:{distribution:quote.distribution,feeValue:quote.feeValue,...(quote.messageAllocations?.length?{messageAllocations:quote.messageAllocations}:{})}});
    state.pending={key,role,method,hash,feeDeposit:gen(quote.feeValue)};persist();
    console.log(JSON.stringify({stage:'SUBMITTED',step:key,role,method,value:gen(value),feeDeposit:gen(quote.feeValue),transactionHash:hash}));
    await finishPending();
  }
  const cases={
    senior:['Undertakes to restore the unavailable production authentication service.','Undertakes to add optional dashboard themes.'],
    equal:['Undertakes to restore the unavailable production authentication service.','Undertakes to recover the unavailable existing production data-access service.'],
    expiry:['Undertakes to restore production authentication.','Undertakes to add optional themes.'],
    unverifiable:['Undertakes to do the unspecified activity in an absent annex; its content is unknown.','Undertakes to add optional dashboard themes.'],
  };
  const ids=await read('get_pool_ids');
  for(const [name,scopes] of Object.entries(cases)) {
    const id=`rr-${deployment.sourceCommit.slice(0,7)}-${name}`;
    const item=state.pools[name]??={id,withdrawals:{}};persist();
    let pool=ids.includes(id)?await read('get_pool',[id]):null;
    if(!pool) {
      const now=Math.floor(Date.now()/1000);
      item.ratifyDeadline=now+(name==='expiry'?30:name==='unverifiable'?240:3600);
      item.reviewDeadline=now+(name==='expiry'?60:name==='unverifiable'?360:7200);persist();
      const definitions=scopes.map((scope,i)=>({payee:roles[i?'bob':'alice'].address,face_gen:2,scope}));
      await write(`${name}:create`,'sponsor','create_pool',[id,CHARTER,JSON.stringify(definitions),item.ratifyDeadline,item.reviewDeadline],2n*GEN);
      pool=await read('get_pool',[id]);
    }
    if(name!=='expiry'&&pool.phase==='RATIFYING') {
      for(const [i,role] of ['alice','bob'].entries()) {
        const claim=await read('get_claim',[id,i]);
        if(!claim.ratified)await write(`${name}:ratify:${role}`,role,'ratify_claim',[id,pool.definition_digest]);
      }
      pool=await read('get_pool',[id]);
    }
    if(name!=='expiry'&&pool.phase==='READY'&&pool.attempts===0&&Math.floor(Date.now()/1000)<pool.review_deadline) {
      await write(`${name}:review`,'sponsor','review_pool',[id]);pool=await read('get_pool',[id]);
    }
    if(name!=='expiry'&&pool.attempts>0&&!item.judgment) {
      item.judgment=await read('get_attempt',[id,pool.attempts]);
      item.claims=await Promise.all([0,1].map(i=>read('get_claim',[id,i])));item.afterReview=pool;persist();
      const tx=await publicClient.getTransaction({hash:state.transactions[`${name}:review`].transactionHash});
      item.consensus={leaderOnly:tx.leader_only,initialValidators:Number(tx.num_of_initial_validators),result:tx.result_name};persist();
      guard(item.consensus.leaderOnly===false&&item.consensus.initialValidators>=2&&item.consensus.result==='MAJORITY_AGREE','INDEPENDENT_CONSENSUS_NOT_PROVED');
      if(name==='senior')guard(item.claims[0].class==='PRIORITY'&&item.claims[1].class==='STANDARD'&&await credit(id,'alice')===2n*GEN&&await credit(id,'bob')===0n,'SENIOR_EXAMPLE_UNEXPECTED');
      if(name==='equal')guard(item.claims.every(c=>c.class==='PRIORITY')&&await credit(id,'alice')===GEN&&await credit(id,'bob')===GEN,'EQUAL_EXAMPLE_UNEXPECTED');
      if(name==='unverifiable')guard(pool.phase==='RETRYABLE'&&pool.locked==='2 GEN'&&pool.credits==='0 GEN'&&item.judgment.unverifiable,'UNVERIFIABLE_EXAMPLE_UNEXPECTED');
      console.log(JSON.stringify({stage:'JUDGMENT_PROVED',case:name,phase:pool.phase,classes:item.judgment.classes,consensus:item.consensus}));
    }
    if(['RATIFYING','READY','RETRYABLE'].includes(pool.phase)) {
      guard(name==='expiry'||name==='unverifiable','UNEXPECTED_PENDING_POOL');
      while(Math.floor(Date.now()/1000)<pool.review_deadline+2) {
        console.log(JSON.stringify({stage:'WAITING_FOR_EXPIRY',case:name,seconds:pool.review_deadline+2-Math.floor(Date.now()/1000)}));
        await new Promise(resolve=>setTimeout(resolve,Math.min(15000,(pool.review_deadline+2-Math.floor(Date.now()/1000))*1000)));
      }
      await write(`${name}:expire`,'sponsor','expire_pool',[id]);pool=await read('get_pool',[id]);
      item.afterExpiry=pool;persist();guard(pool.phase==='REFUNDED'&&await credit(id,'sponsor')===2n*GEN,'REFUND_CANONICAL_PROOF_FAILED');
    }
    for(const role of ['alice','bob','sponsor']) {
      const due=await credit(id,role);
      if(due>0n) {
        guard(!item.withdrawals[role]?.complete,'REPEATED_WITHDRAWAL_REFUSED');
        item.withdrawals[role]??={amount:gen(due),nativeBefore:gen(await publicClient.getBalance({address})),recipientBefore:gen(await publicClient.getBalance({address:roles[role].address})),recipient:roles[role].address};persist();
        await write(`${name}:withdraw:${role}`,role,'withdraw_credit',[id]);
      }
      const proof=item.withdrawals[role];
      if(proof&&!proof.complete) {
        const step=state.transactions[`${name}:withdraw:${role}`];guard(step,'WITHDRAWAL_RECEIPT_REQUIRED');
        const nativeAfter=await publicClient.getBalance({address});const recipientAfter=await publicClient.getBalance({address:roles[role].address});
        const decrease=amount(proof.nativeBefore)-nativeAfter;const recipientDelta=recipientAfter-amount(proof.recipientBefore);
        guard(decrease===amount(proof.amount),'NATIVE_WITHDRAWAL_DECREASE_MISMATCH');
        guard(recipientDelta<=amount(proof.amount)&&recipientDelta+amount(step.feeDeposit)>=amount(proof.amount),'RECIPIENT_FEE_BOUNDED_DELTA_FAILED');
        const tx=await publicClient.getTransaction({hash:step.transactionHash});
        const message=tx.messages?.find(m=>String(m.recipient).toLowerCase()===roles[role].address.toLowerCase()&&BigInt(m.value)===amount(proof.amount));
        guard(message,'EXACT_EXTERNAL_TRANSFER_MESSAGE_REQUIRED');
        const childIds=await publicClient.getTriggeredTransactionIds({hash:step.transactionHash});
        const children=[];
        for(const hash of childIds) {
          guard(/^0x[0-9a-fA-F]{64}$/.test(hash),'INVALID_CHILD_HASH');
          const receipt=await publicClient.waitForTransactionReceipt({hash,waitUntil:'finalized',interval:3000,retries:120});
          const safe=safeReceipt(receipt,hash);guard(safe.status==='FINALIZED'&&safe.executionResult==='SUCCESS','CHILD_EXECUTION_FAILED');children.push(safe);
        }
        Object.assign(proof,{complete:true,nativeAfter:gen(nativeAfter),nativeDecrease:gen(decrease),recipientAfter:gen(recipientAfter),recipientNetIncrease:gen(recipientDelta),feeDeposit:step.feeDeposit,observedRecipientTransferCost:gen(amount(proof.amount)-recipientDelta),parentReceipt:step,externalMessage:{recipient:roles[role].address,value:gen(message.value)},childReceipts:children,childBoundary:childIds.length?'Triggered transactions finalized':'Studio external native transfer executed within parent; no triggered child transaction reported',creditAfter:gen(await credit(id,role)),checkedAt:new Date().toISOString()});persist();
        console.log(JSON.stringify({stage:'WITHDRAWAL_PROVED',case:name,role,amount:proof.amount,nativeDecrease:proof.nativeDecrease,recipientNetIncrease:proof.recipientNetIncrease,children:children.length}));
      }
    }
    pool=await read('get_pool',[id]);
    if(pool.phase!=='CLOSED')await write(`${name}:close`,'sponsor','close_pool',[id]);
    item.finalPool=await read('get_pool',[id]);guard(item.finalPool.phase==='CLOSED'&&item.finalPool.locked==='0 GEN'&&item.finalPool.credits==='0 GEN','CLOSED_ZERO_LIABILITY_REQUIRED');persist();
  }
  const accounting=await read('get_accounting');const nativeBalance=gen(await publicClient.getBalance({address}));
  guard(['senior','equal','unverifiable'].every(name=>state.pools[name]?.judgment),'ALL_REQUIRED_JUDGMENTS_MUST_BE_PROVED');
  guard(accounting.invariant&&accounting.received==='8 GEN'&&accounting.withdrawn==='8 GEN'&&accounting.locked==='0 GEN'&&accounting.credits==='0 GEN'&&nativeBalance==='0 GEN','FINAL_ZERO_NATIVE_ACCOUNTING_REQUIRED');
  saveJson(EVIDENCE,{command:'node scripts/lifecycle.mjs',checkedAt:new Date().toISOString(),network:'Studio Dev',chainId:CHAIN,contractAddress:address,sourceSha256:sourceHash(),roles:Object.fromEntries(Object.entries(roles).map(([role,a])=>[role,a.address])),reservePerCase:'2 GEN',pools:state.pools,transactions:state.transactions,accounting,nativeBalance,evidenceIsSanitized:true});
  console.log(JSON.stringify({stage:'LIFECYCLE_PASS',cases:4,accounting,nativeBalance}));
}
main().catch(report);
