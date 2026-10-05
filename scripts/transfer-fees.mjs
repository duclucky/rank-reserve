import {guard,gen} from './network.mjs';
export function settledTransferFee(fee,recipient) {
  guard(fee?.status==='settled'&&/^0x[0-9a-fA-F]{40}$/.test(recipient),'SETTLED_FEE_PROOF_REQUIRED');
  const nonnegative=value=>{guard(/^\d+$/.test(String(value)),'NONNEGATIVE_FEE_REQUIRED');return BigInt(value);};
  const paid=nonnegative(fee.paid_fee_value),refunded=nonnegative(fee.total_refunded);
  const settled=nonnegative(fee.external_message_fee_settled??0);
  const payouts=fee.external_message_fee_payouts??[];guard(Array.isArray(payouts),'FEE_PAYOUT_LIST_REQUIRED');
  let total=0n,recipientFeePayout=0n;const safe=[];
  for(const payout of payouts){
    guard(/^0x[0-9a-fA-F]{40}$/.test(payout?.recipient),'FEE_PAYOUT_RECIPIENT_REQUIRED');
    const value=nonnegative(payout.amount);total+=value;
    if(payout.recipient.toLowerCase()===recipient.toLowerCase())recipientFeePayout+=value;
    safe.push({recipient:payout.recipient,amount:gen(value)});
  }
  guard(total===settled,'EXTERNAL_FEE_PAYOUT_COVERAGE_REQUIRED');
  const charged=paid-refunded,netCharged=charged-recipientFeePayout;
  guard(charged>=0n&&netCharged>=0n,'NONNEGATIVE_NET_FEE_REQUIRED');
  return {charged,recipientFeePayout,netCharged,proof:{status:'settled',paid:gen(paid),refunded:gen(refunded),charged:gen(charged),recipientFeePayout:gen(recipientFeePayout),netCharged:gen(netCharged),externalFeePayouts:safe}};
}
