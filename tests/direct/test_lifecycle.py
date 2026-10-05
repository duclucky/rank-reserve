import json
import pytest
from tests.direct.helpers import *

@pytest.fixture
def setup(direct_deploy, direct_vm, direct_owner, direct_alice, direct_bob):
    c = direct_deploy(PATH)
    create(c, direct_vm, direct_owner, direct_alice, direct_bob)
    return c, direct_vm, direct_owner, direct_alice, direct_bob

def test_creation_and_immutable_definition(setup):
    c, vm, owner, a, b = setup
    p = data(c.get_pool("pool"))
    assert p["phase"] == "RATIFYING" and p["locked"] == "2 GEN"
    assert p["version"] == "RR_V1" and len(p["definition_digest"]) == 64
    before = snapshot(c)
    with pytest.raises(Exception, match="exists"):
        create(c, vm, owner, a, b)
    assert snapshot(c) == before

@pytest.mark.parametrize("value", [0, 1, GEN-1, 101*GEN])
def test_invalid_deposit_no_accounting_change(value, direct_deploy, direct_vm, direct_owner, direct_alice, direct_bob):
    c = direct_deploy(PATH)
    before = c.get_accounting()
    with pytest.raises(Exception, match="whole GEN"):
        create(c, direct_vm, direct_owner, direct_alice, direct_bob, value=value)
    assert c.get_accounting() == before and data(c.get_pool_ids()) == []

@pytest.mark.parametrize("kind", ["same_payee", "sponsor_payee", "zero_payee", "extra_field", "bad_face", "not_scarce", "unknown_kind"])
def test_claim_input_validation(kind, direct_deploy, direct_vm, direct_owner, direct_alice, direct_bob):
    c=direct_deploy(PATH); vm=direct_vm; clock(vm,NOW);vm.sender=direct_owner;vm.value=2*GEN
    x=json.loads(claims(direct_alice,direct_bob))
    if kind=="same_payee": x[1]["payee"]=x[0]["payee"]
    if kind=="sponsor_payee": x[0]["payee"]=addr(direct_owner)
    if kind=="zero_payee": x[0]["payee"]="0x"+"0"*40
    if kind=="extra_field": x[0]["receipt"]="hash-valid fabricated performance"
    if kind=="bad_face": x[0]["face_gen"]=True
    if kind=="not_scarce": x[0]["face_gen"]=x[1]["face_gen"]=1
    if kind=="unknown_kind": x[0]["source_version"]="external"
    before=c.get_accounting()
    with pytest.raises(Exception):c.create_pool("pool",CHARTER,json.dumps(x),RATIFY,REVIEW)
    assert c.get_accounting()==before

@pytest.mark.parametrize("offset", [-1,0,1])
def test_ratification_clock_stale_phase(offset, setup):
    c,vm,owner,a,b=setup;vm.sender=a;clock(vm,RATIFY+offset)
    before=snapshot(c);digest=data(c.get_pool("pool"))["definition_digest"]
    if offset<0:
        c.ratify_claim("pool",digest);assert data(c.get_claim("pool",0))["ratified"]
    else:
        with pytest.raises(Exception,match="ratification expired"):c.ratify_claim("pool",digest)
        assert snapshot(c)==before

@pytest.mark.parametrize("fault", ["sponsor", "digest", "duplicate", "cross_pool"])
def test_authenticated_ratification_tripwire(fault,setup):
    c,vm,owner,a,b=setup;clock(vm,NOW+30);vm.sender=a;digest=data(c.get_pool("pool"))["definition_digest"]
    if fault=="sponsor": vm.sender=owner
    if fault=="digest": digest="f"*64
    if fault=="duplicate": c.ratify_claim("pool",digest)
    if fault=="cross_pool":
        create(c,vm,owner,a,b,pool="other");vm.sender=a
    before=snapshot(c)
    target="other" if fault=="cross_pool" else "pool"
    with pytest.raises(Exception):c.ratify_claim(target,digest)
    assert snapshot(c)==before

@pytest.mark.parametrize("classes,credits", [(('PRIORITY','STANDARD'),('2 GEN','0 GEN')), (('STANDARD','PRIORITY'),('0 GEN','2 GEN')), (('PRIORITY','PRIORITY'),('1 GEN','1 GEN')), (('STANDARD','STANDARD'),('1 GEN','1 GEN'))])
def test_semantic_classes_drive_waterfall(classes,credits,setup):
    c,vm,owner,a,b=setup;ratify(c,vm,a,b);settle(c,vm,owner,classes)
    assert c.get_credit("pool",a)==credits[0] and c.get_credit("pool",b)==credits[1]
    p=data(c.get_pool("pool"));assert p["phase"]=="SETTLED" and p["locked"]=="0 GEN" and p["credits"]=="2 GEN"
    assert data(c.get_accounting())["invariant"] is True
    before=snapshot(c)
    with pytest.raises(Exception,match="review state"):c.review_pool("pool")
    assert snapshot(c)==before

@pytest.mark.parametrize("offset", [-1,0,1])
def test_review_clock_with_stale_ready_phase(offset,setup):
    c,vm,owner,a,b=setup;ratify(c,vm,a,b);answer(vm);vm.sender=owner;clock(vm,REVIEW+offset)
    before=snapshot(c)
    if offset<0:c.review_pool("pool");assert data(c.get_pool("pool"))["phase"]=="SETTLED"
    else:
        with pytest.raises(Exception,match="review expired"):c.review_pool("pool")
        assert snapshot(c)==before

@pytest.mark.parametrize("phase", ['RATIFYING','READY','RETRYABLE'])
@pytest.mark.parametrize("offset", [-1,0,1])
def test_expiry_clock_and_no_double_refund(phase,offset,setup):
    c,vm,owner,a,b=setup
    if phase!='RATIFYING':ratify(c,vm,a,b)
    if phase=='RETRYABLE':settle(c,vm,owner,('UNVERIFIABLE','STANDARD'))
    clock(vm,REVIEW+offset);vm.sender=owner;before=snapshot(c)
    if offset<0:
        with pytest.raises(Exception,match="not expired"):c.expire_pool("pool")
        assert snapshot(c)==before
    else:
        c.expire_pool("pool");assert c.get_credit("pool",owner)=="2 GEN" and data(c.get_pool("pool"))["phase"]=="REFUNDED"
        after=snapshot(c)
        with pytest.raises(Exception,match="expiry state"):c.expire_pool("pool")
        assert snapshot(c)==after

def test_unverifiable_history_retry_bound_and_no_credit(setup):
    c,vm,owner,a,b=setup;ratify(c,vm,a,b)
    for i in range(2):
        settle(c,vm,owner,('UNVERIFIABLE','STANDARD'))
        assert c.get_credit("pool",a)=="0 GEN" and data(c.get_pool("pool"))["locked"]=="2 GEN"
        assert data(c.get_attempt("pool",i+1))["classes"]["pool:0"]=="UNVERIFIABLE"
    before=snapshot(c)
    with pytest.raises(Exception,match="attempts exhausted"):c.review_pool("pool")
    assert snapshot(c)==before

@pytest.mark.parametrize("classes", [{}, {'pool:0':'PRIORITY'}, {'pool:0':'PRIORITY','pool:1':'WRONG'}, {'pool:0':'PRIORITY','pool:1':'STANDARD','other:2':'PRIORITY'}])
def test_valid_shape_invalid_settlement_rejects_unchanged(classes,setup):
    c,vm,owner,a,b=setup;ratify(c,vm,a,b);answer(vm,classes=classes);vm.sender=owner
    before=snapshot(c)
    with pytest.raises(Exception,match="invalid semantic output"):c.review_pool("pool")
    assert snapshot(c)==before

@pytest.mark.parametrize("extra", [{'amount':'9 GEN'},{'payee':'0x'+'1'*40},{'coverage':'PARTIAL'},{'authority':'forged issuer'},{'rank':['pool:1','pool:0']}])
def test_injection_cannot_choose_authority_or_payout(extra,setup):
    c,vm,owner,a,b=setup;ratify(c,vm,a,b);answer(vm,**extra);vm.sender=owner;before=snapshot(c)
    with pytest.raises(Exception,match="invalid semantic output"):c.review_pool("pool")
    assert snapshot(c)==before

def test_recovery_wrong_callers_and_states(setup):
    c,vm,owner,a,b=setup;before=snapshot(c);vm.sender=b
    for method in (c.review_pool,c.expire_pool,c.withdraw_credit,c.close_pool):
        with pytest.raises(Exception):method("pool")
        assert snapshot(c)==before
    ratify(c,vm,a,b);settle(c,vm,owner);vm.sender=a;before=snapshot(c)
    with pytest.raises(Exception,match="sponsor"):c.close_pool("pool")
    with pytest.raises(Exception,match="sponsor"):c.expire_pool("pool")
    vm.sender=owner
    with pytest.raises(Exception,match="liability"):c.close_pool("pool")
    with pytest.raises(Exception,match="expiry state"):c.expire_pool("pool")
    assert snapshot(c)==before

def test_withdraw_exact_own_credit_zero_close_and_duplicates(setup):
    c,vm,owner,a,b=setup;ratify(c,vm,a,b);settle(c,vm,owner);vm.sender=b;before=snapshot(c)
    with pytest.raises(Exception,match="no credit"):c.withdraw_credit("pool")
    assert snapshot(c)==before
    vm.sender=a;c.withdraw_credit("pool")
    assert c.get_credit("pool",a)=="0 GEN" and data(c.get_pool("pool"))["withdrawn"]=="2 GEN"
    with pytest.raises(Exception,match="no credit"):c.withdraw_credit("pool")
    vm.sender=owner;c.close_pool("pool");assert data(c.get_pool("pool"))["phase"]=="CLOSED"
    before=snapshot(c)
    for method in (c.review_pool,c.expire_pool,c.withdraw_credit,c.close_pool):
        with pytest.raises(Exception):method("pool")
        assert snapshot(c)==before

def test_isolation_and_capped_proportional_residual(setup):
    c,vm,owner,a,b=setup;create(c,vm,owner,a,b,pool="other",faces=(1,2));before=snapshot(c)
    ratify(c,vm,a,b,pool="other");settle(c,vm,owner,('STANDARD','STANDARD'),pool="other")
    assert snapshot(c)[0]==before[0] and snapshot(c)[2:]==before[2:]
    p=data(c.get_pool("other"));assert p["credits"]=="2 GEN" and p["locked"]=="0 GEN"
    assert c.get_credit("other",owner)=="0.000000000000000001 GEN"
    assert data(c.get_accounting())["invariant"] is True
