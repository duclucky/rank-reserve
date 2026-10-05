import json
import pytest
from tests.direct.test_lifecycle import setup
from tests.direct.helpers import *

@pytest.mark.parametrize('method',['ratify_claim','review_pool','expire_pool','withdraw_credit','close_pool'])
def test_outsider_never_mutates_or_obtains_value(method,setup):
    c,vm,owner,a,b=setup
    ratify(c,vm,a,b);settle(c,vm,owner)
    vm.sender=type(owner)('0x'+'9'*40)
    before=snapshot(c)
    args=['pool',data(c.get_pool('pool'))['definition_digest']] if method=='ratify_claim' else ['pool']
    with pytest.raises(Exception):getattr(c,method)(*args)
    assert snapshot(c)==before and c.get_credit('pool',vm.sender)=='0 GEN'

@pytest.mark.parametrize('method',['ratify_claim','review_pool','expire_pool','withdraw_credit','close_pool'])
def test_refunded_terminal_state_guards(method,setup):
    c,vm,owner,a,b=setup;vm.sender=owner;clock(vm,REVIEW);c.expire_pool('pool')
    vm.sender=a;before=snapshot(c)
    args=['pool',data(c.get_pool('pool'))['definition_digest']] if method=='ratify_claim' else ['pool']
    with pytest.raises(Exception):getattr(c,method)(*args)
    assert snapshot(c)==before

def test_refund_withdrawal_and_closed_ratification_cannot_replay(setup):
    c,vm,owner,a,b=setup;vm.sender=owner;clock(vm,REVIEW);c.expire_pool('pool')
    c.withdraw_credit('pool');c.close_pool('pool');before=snapshot(c)
    for actor in (owner,a,b):
        vm.sender=actor
        with pytest.raises(Exception):c.ratify_claim('pool',data(c.get_pool('pool'))['definition_digest'])
        with pytest.raises(Exception):c.withdraw_credit('pool')
        assert snapshot(c)==before
    assert data(c.get_accounting())=={'received':'2 GEN','locked':'0 GEN','credits':'0 GEN','withdrawn':'2 GEN','invariant':True}

@pytest.mark.parametrize('offset',[-1,0,1])
def test_creation_seven_day_upper_boundary(offset,direct_deploy,direct_vm,direct_owner,direct_alice,direct_bob):
    c=direct_deploy(PATH);vm=direct_vm;clock(vm,NOW);vm.sender=direct_owner;vm.value=2*GEN
    before=c.get_accounting();deadline=NOW+7*86400+offset
    if offset<=0:
        c.create_pool('pool',CHARTER,claims(direct_alice,direct_bob),RATIFY,deadline)
        assert data(c.get_pool('pool'))['review_deadline']==deadline
    else:
        with pytest.raises(Exception,match='future deadlines'):c.create_pool('pool',CHARTER,claims(direct_alice,direct_bob),RATIFY,deadline)
        assert c.get_accounting()==before

@pytest.mark.parametrize('method',['review_pool','expire_pool','withdraw_credit','close_pool'])
def test_corrupt_accounting_blocks_recovery_and_consequence(method,setup):
    c,vm,owner,a,b=setup;ratify(c,vm,a,b)
    if method in ('withdraw_credit','close_pool'):settle(c,vm,owner)
    if method=='close_pool':vm.sender=a;c.withdraw_credit('pool')
    if method=='expire_pool':clock(vm,REVIEW)
    vm.sender=a if method=='withdraw_credit' else owner
    answer(vm);c.received+=1;before=snapshot(c)
    with pytest.raises(Exception,match='accounting invariant'):getattr(c,method)('pool')
    assert snapshot(c)==before

@pytest.mark.parametrize('count',[3,4])
def test_full_bounded_entity_coverage_and_face_cap(count,direct_deploy,direct_vm,direct_owner,direct_alice,direct_bob):
    c=direct_deploy(PATH);vm=direct_vm;clock(vm,NOW);vm.sender=direct_owner;vm.value=2*GEN
    actors=[direct_alice,direct_bob,type(direct_owner)('0x'+'3'*40),type(direct_owner)('0x'+'4'*40)][:count]
    definitions=[{'payee':addr(a),'face_gen':1,'scope':'Undertakes to restore failed production authentication.'} for a in actors]
    c.create_pool('pool',CHARTER,json.dumps(definitions),RATIFY,REVIEW);vm.value=0
    digest=data(c.get_pool('pool'))['definition_digest']
    for actor in actors:vm.sender=actor;c.ratify_claim('pool',digest)
    settle(c,vm,direct_owner,tuple('PRIORITY' for a in actors))
    assert data(c.get_pool('pool'))['phase']=='SETTLED'
    for i,actor in enumerate(actors):
        claim=data(c.get_claim('pool',i));assert claim['class']=='PRIORITY'
        assert 0<float(c.get_credit('pool',actor).split()[0])<=1
    assert data(c.get_accounting())['invariant'] is True
