import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fromRlp} from 'viem';
import {abi,MessageType,MESSAGE_ALLOCATION_ROOT_PARENT_INDEX,CALL_KEY_UNNAMED,encodeExternalMessageFeeParams} from 'genlayer-js';
import {measuredFees,RPC,ROOT,GEN,addressArg} from '../../scripts/network.mjs';
const address='0x'+'1'.repeat(40);

test('real SDK encodes timestamped profiling without a signed transaction',async()=>{
  const original=globalThis.fetch;let request,measured;
  const client={account:{address},estimateTransactionFees:async()=>({distribution:{executionBudgetPerRound:100n},feeValue:GEN}),estimateTransactionFeesFromSimulation:async input=>{measured=input;return {feeValue:GEN};},writeContract:()=>assert.fail('profiling must never submit')};
  try {
    globalThis.fetch=async(url,init)=>{
      assert.equal(url,RPC);request=JSON.parse(init.body);
      return {ok:true,json:async()=>({result:{execution_result:'SUCCESS',genvm_result:{fee_accounting:{execution_fee_consumed:'1'}}}})};
    };
    const result=await measuredFees(client,address,'create_pool',['pool',42],2n*GEN);
    assert.equal(result.feeValue,GEN);
    const call=request.params[0];assert.equal(request.method,'sim_call');
    assert.equal(call.from,address);assert.equal(BigInt(call.value),2n*GEN);
    assert.ok(Math.abs(Date.parse(call.sim_config.genvm_datetime)-Date.now())<5000);
    const [payload,leaderOnly]=fromRlp(call.data,'bytes');
    const decoded=abi.calldata.decode(payload);
    assert.equal(decoded.get(''),'create_pool');assert.deepEqual(decoded.get('args'),['pool',42n]);assert.deepEqual([...leaderOnly],[0]);
    assert.equal(measured.simulation.feeAccounting.execution_fee_consumed,'1');
    assert.equal(call.fees.feeValue,GEN.toString());
  } finally {globalThis.fetch=original;}
});

test('failed profiling execution cannot produce a fee quote or submit',async()=>{
  const original=globalThis.fetch;
  const client={account:{address},estimateTransactionFees:async()=>({distribution:{},feeValue:GEN}),estimateTransactionFeesFromSimulation:()=>assert.fail('failed simulation must stop'),writeContract:()=>assert.fail('failed simulation must not submit')};
  try {
    globalThis.fetch=async()=>({ok:true,json:async()=>({error:{code:-32000,message:'private response intentionally not logged'}})});
    await assert.rejects(measuredFees(client,address,'create_pool',[],2n*GEN),error=>error.safeCode==='TIMESTAMPED_FEE_SIMULATION_FAILED');
  }finally {globalThis.fetch=original;}
});

test('signed write parameters contain no simulation timestamp override',()=>{
  const source=fs.readFileSync(ROOT+'/scripts/lifecycle.mjs','utf8');
  const writes=[...source.matchAll(/\.writeContract\(\{([^\n]*)\}\)/g)];
  assert.equal(writes.length,1);assert.doesNotMatch(writes[0][1],/sim_config|datetime|timestamp/);
});

test('Address view parameter uses the official binary calldata type',()=>{
  const encoded=abi.calldata.encode(addressArg(address));
  const decoded=abi.calldata.decode(encoded);
  assert.deepEqual([...decoded.bytes],[...Buffer.from(address.slice(2),'hex')]);
  assert.notDeepEqual(encoded,abi.calldata.encode(address));
  assert.throws(()=>addressArg('invalid'),error=>error.safeCode==='INVALID_ADDRESS_ARGUMENT');
});

test('external profiling allocation preserves the official root and finality defaults',async()=>{
  const original=globalThis.fetch;
  const allocations=[{messageType:MessageType.External,recipient:address,callKey:CALL_KEY_UNNAMED,budget:42000n,feeParams:encodeExternalMessageFeeParams({gasLimit:21000n,maxGasPrice:2n})}];
  const client={account:{address},estimateTransactionFees:async()=>({distribution:{totalMessageFees:42000n},feeValue:GEN,messageAllocations:allocations}),estimateTransactionFeesFromSimulation:async input=>{assert.deepEqual(input.messageAllocations,allocations);return {feeValue:GEN};}};
  try {
    globalThis.fetch=async(url,init)=>{
      const request=JSON.parse(init.body);const node=request.params[0].fees.messageAllocations[0];
      assert.equal(BigInt(node.parentIndex),MESSAGE_ALLOCATION_ROOT_PARENT_INDEX);
      assert.equal(node.onAcceptance,false);assert.equal(node.recipient,address);
      assert.equal(node.messageType,MessageType.External);assert.equal(node.callKey,CALL_KEY_UNNAMED);
      assert.equal(BigInt(node.budget),42000n);
      return {ok:true,json:async()=>({result:{execution_result:'SUCCESS',genvm_result:{fee_accounting:{execution_fee_consumed:'1'}}}})};
    };
    await measuredFees(client,address,'withdraw_credit',['pool'],0n,allocations);
  }finally {globalThis.fetch=original;}
});
