import ast
import json
import sys
from pathlib import Path
import pytest
from tests.direct.test_lifecycle import setup
from tests.direct.helpers import *

def test_actual_validator_replays_meaning_and_ignores_prose(setup):
    c,vm,owner,a,b=setup;ratify(c,vm,a,b);settle(c,vm,owner)
    assert vm.run_validator() is True
    answer(vm,reason="Different wording, same exact priority meaning.")
    assert vm.run_validator() is True
    answer(vm,('STANDARD','PRIORITY'))
    assert vm.run_validator() is False
    assert vm.run_validator(leader_error=RuntimeError('unavailable')) is False

@pytest.mark.parametrize("payload", [None, {}, {'valid':True,'vector':['STANDARD','PRIORITY']}, {'valid':True,'vector':{'PRIORITY':1,'STANDARD':2}}, {'valid':True,'vector':['PRIORITY']}, {'valid':False,'vector':['PRIORITY','STANDARD']}, {'valid':True,'vector':['PRIORITY','STANDARD'],'payee':'forged'}])
def test_malicious_leader_cannot_pass_semantic_validator(payload,setup):
    c,vm,owner,a,b=setup;ratify(c,vm,a,b);settle(c,vm,owner)
    before=snapshot(c);assert vm.run_validator(leader_result=payload) is False
    assert snapshot(c)==before

@pytest.mark.parametrize("raw", ['null','[]','broken','{"classes":{"pool:0":"PRIORITY","pool:0":"STANDARD","pool:1":"STANDARD"}}', '{"classes":{"pool:0":{"class":"UNVERIFIABLE"},"pool:1":"STANDARD"}}', '{"classes":{"pool:0":"UNVERIFIABLE","pool:1":{"class":"STANDARD"}}}', '{"classes":["UNVERIFIABLE","STANDARD"]}'])
def test_malformed_or_duplicate_json_no_mutation(raw,setup):
    c,vm,owner,a,b=setup;ratify(c,vm,a,b);vm.clear_mocks();vm.mock_llm(r'(?s).*RankReserve meaning judge.*',json.dumps(raw));vm.sender=owner
    before=snapshot(c)
    with pytest.raises(Exception,match='invalid semantic output'):c.review_pool('pool')
    assert snapshot(c)==before

@pytest.mark.parametrize("offset", [-1,0,1])
def test_create_lower_boundary(offset,direct_deploy,direct_vm,direct_owner,direct_alice,direct_bob):
    c=direct_deploy(PATH);vm=direct_vm;clock(vm,NOW);vm.sender=direct_owner;vm.value=2*GEN
    before=c.get_accounting()
    if offset>0:
        c.create_pool('pool',CHARTER,claims(direct_alice,direct_bob),NOW+offset,REVIEW)
        assert data(c.get_pool('pool'))['locked']=='2 GEN'
    else:
        with pytest.raises(Exception,match='future deadlines'):c.create_pool('pool',CHARTER,claims(direct_alice,direct_bob),NOW+offset,REVIEW)
        assert c.get_accounting()==before

@pytest.mark.parametrize("stamp", ['', '2030-01-01T00:00:00', 'bad-time'])
def test_canonical_time_never_invented(stamp,setup):
    c,vm,owner,a,b=setup;message=sys.modules['genlayer.message'];message.datetime=stamp
    vm.sender=a;before=snapshot(c)
    with pytest.raises(Exception,match='canonical time'):c.ratify_claim('pool',data(c.get_pool('pool'))['definition_digest'])
    assert snapshot(c)==before

def test_withdraw_emits_exact_evm_recipient_after_ledger_debit(setup):
    c,vm,owner,a,b=setup;ratify(c,vm,a,b);settle(c,vm,owner)
    seen=[]
    def hook(context,request):
        if isinstance(request,dict) and 'EmitExternalMessage' in request:
            seen.append(request['EmitExternalMessage'])
            assert c.get_credit('pool',a)=='0 GEN'
            assert data(c.get_accounting())['withdrawn']=='2 GEN'
    vm._gl_call_hook=hook;vm.sender=a;c.withdraw_credit('pool');vm._gl_call_hook=None
    assert len(seen)==1 and seen[0]['value']==2*GEN
    recipient=seen[0].get('address',seen[0].get('to'))
    assert addr(recipient).lower()==addr(a).lower()

def test_ascii_header_exact_class_metadata_and_temporal_guards():
    source=Path(PATH).read_bytes().decode('ascii');tree=ast.parse(source)
    assert source.splitlines()[:3]==['# v0.3.0','# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }','import genlayer as gl']
    classes=[n for n in ast.walk(tree) if isinstance(n,ast.ClassDef) and any(ast.unparse(b)=='gl.contract.Contract' for b in n.bases)]
    assert [c.name for c in classes]==['RankReserve']
    methods={n.name:n for n in classes[0].body if isinstance(n,ast.FunctionDef)}
    assert [ast.unparse(d) for d in methods['create_pool'].decorator_list]==['gl.public.write.payable']
    for name in ('create_pool','ratify_claim','review_pool','expire_pool'):assert '_now()' in ast.unparse(methods[name])
    for name in ('ratify_claim','review_pool','expire_pool','withdraw_credit','close_pool'):assert [ast.unparse(d) for d in methods[name].decorator_list]==['gl.public.write']
    assert 'gl.chain.Account' not in source and 'gl.vm.run_nondet(' not in source
    assert '@gl.evm.contract_interface' in source and '_Recipient(sender).emit_transfer' in source
    leader=next(n for n in ast.walk(methods['review_pool']) if isinstance(n,ast.FunctionDef) and n.name=='leader_fn')
    assert not any(isinstance(n,ast.Name) and n.id=='self' for n in ast.walk(leader))
