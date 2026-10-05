import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReceipt} from '../../scripts/receipts.mjs';
const hash='0x'+'1'.repeat(64), address='0x'+'2'.repeat(40);
test('raw Studio successful execution and only allowlisted proof',()=>{
  const r=safeReceipt({status:'FINALIZED',to:address,consensus_data:{leader_receipt:[{execution_result:'SUCCESS',node_config:{private_key:'FORBIDDEN_FIXTURE'}}]}},hash);
  assert.equal(r.executionResult,'SUCCESS');assert.equal(r.status,'FINALIZED');assert.equal(r.contractAddress,address);
  assert.equal(JSON.stringify(r).includes('FORBIDDEN_FIXTURE'),false);
});
test('normalized SDK shape successful result',()=>{
  assert.equal(safeReceipt({statusName:'FINALIZED',txExecutionResultName:'FINISHED_WITH_RETURN',contractAddress:address},hash).executionResult,'SUCCESS');
});
test('finalized error cannot be success',()=>{
  assert.equal(safeReceipt({status:'FINALIZED',consensus_data:{leader_receipt:[{execution_result:'ERROR'}]}},hash).executionResult,'ERROR');
});
test('missing execution remains unknown',()=>{
  assert.equal(safeReceipt({statusName:'FINALIZED'},hash).executionResult,'UNKNOWN');
});
test('latest raw leader receipt is authoritative',()=>{
  assert.equal(safeReceipt({status:'FINALIZED',consensus_data:{leader_receipt:[{execution_result:'ERROR'},{execution_result:'SUCCESS'}]}},hash).executionResult,'SUCCESS');
});
test('numeric SDK enums map conservatively',()=>{
  const r=safeReceipt({status:7,txExecutionResult:1},hash);assert.equal(r.status,'FINALIZED');assert.equal(r.executionResult,'SUCCESS');
});
test('not-voted numeric execution is never success',()=>assert.equal(safeReceipt({status:7,txExecutionResult:0},hash).executionResult,'NOT_VOTED'));
