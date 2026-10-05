import test from 'node:test';
import assert from 'node:assert/strict';
import {settledTransferFee} from '../../scripts/transfer-fees.mjs';
const recipient='0x'+'1'.repeat(40),other='0x'+'2'.repeat(40);
const fixture=()=>({status:'settled',paid_fee_value:'1212529200052352',total_refunded:'1086222950009529',external_message_fee_settled:'42000',external_message_fee_payouts:[{recipient,amount:'42000'}]});
test('separate external fee payout is reconciled exactly, with no tolerance',()=>{
  const r=settledTransferFee(fixture(),recipient);
  assert.equal(r.charged,126306250042823n);assert.equal(r.recipientFeePayout,42000n);
  assert.equal(r.netCharged,126306250000823n);
});
test('payout to another account cannot offset this recipient cost',()=>{
  const f=fixture();f.external_message_fee_payouts[0].recipient=other;
  assert.equal(settledTransferFee(f,recipient).netCharged,126306250042823n);
});
test('missing external fee payout fails coverage',()=>{
  const f=fixture();f.external_message_fee_payouts=[];
  assert.throws(()=>settledTransferFee(f,recipient));
});
test('unsettled or negative fee values fail',()=>{
  for(const field of ['paid_fee_value','total_refunded','external_message_fee_settled']){const f=fixture();f[field]='-1';assert.throws(()=>settledTransferFee(f,recipient));}
  const f=fixture();f.status='pending';assert.throws(()=>settledTransferFee(f,recipient));
});
test('malformed recipient or excess payout fails',()=>{
  const f=fixture();f.external_message_fee_payouts[0].recipient='forged';assert.throws(()=>settledTransferFee(f,recipient));
  const g=fixture();g.external_message_fee_settled=g.external_message_fee_payouts[0].amount=g.paid_fee_value;assert.throws(()=>settledTransferFee(g,recipient));
});
