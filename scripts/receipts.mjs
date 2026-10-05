import {transactionsStatusNumberToName, executionResultNumberToName} from 'genlayer-js/types';
export function safeReceipt(receipt, hash) {
  if (!receipt || typeof receipt !== 'object') throw new Error('invalid receipt object');
  const leaders=receipt.consensus_data?.leader_receipt;
  const last=Array.isArray(leaders)?leaders.at(-1):leaders;
  const status=receipt.statusName??receipt.status;
  const execution=receipt.txExecutionResultName??receipt.txExecutionResult??receipt.executionResult??last?.execution_result;
  const statusText=typeof status==='string'?status:(transactionsStatusNumberToName[status]??'UNKNOWN');
  const executionText=typeof execution==='string'?execution:(executionResultNumberToName[execution]??'UNKNOWN');
  const candidate=receipt.contractAddress??receipt.recipient??receipt.to;
  const executionName=String(executionText).toUpperCase();
  const result=executionName==='FINISHED_WITH_RETURN'?'SUCCESS':executionName==='FINISHED_WITH_ERROR'?'ERROR':executionName;
  return {transactionHash:/^0x[0-9a-fA-F]{64}$/.test(hash)?hash:'',
    contractAddress:/^0x[0-9a-fA-F]{40}$/.test(candidate)?candidate:'',
    status:String(statusText).toUpperCase(),executionResult:result};
}
