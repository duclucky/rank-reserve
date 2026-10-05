import json
import sys
from datetime import datetime, timezone

GEN = 10**18
NOW = 1893456000
RATIFY = NOW + 600
REVIEW = NOW + 1200
PATH = "contracts/rank_reserve.py"
CHARTER = "Restoring an unavailable existing production service is priority. Optional new features are standard."

def data(text):
    return json.loads(text)

def addr(actor):
    return actor.as_hex if hasattr(actor, "as_hex") else "0x" + bytes(actor).hex()

def clock(vm, timestamp):
    text = datetime.fromtimestamp(timestamp, timezone.utc).isoformat().replace("+00:00", "Z")
    vm.warp(text)
    message = sys.modules.get("genlayer.message")
    if message:
        message.raw["datetime"] = text
        message.datetime = text

def claims(alice, bob, faces=(2, 2)):
    return json.dumps([
        {"payee": addr(alice), "face_gen": faces[0], "scope": "Undertakes to restore failed production authentication."},
        {"payee": addr(bob), "face_gen": faces[1], "scope": "Undertakes to add optional dashboard themes."},
    ])

def create(c, vm, owner, alice, bob, pool="pool", faces=(2, 2), value=2*GEN):
    clock(vm, NOW)
    vm.sender = owner
    vm.value = value
    c.create_pool(pool, CHARTER, claims(alice, bob, faces), RATIFY, REVIEW)
    vm.value = 0

def ratify(c, vm, alice, bob, pool="pool"):
    digest = data(c.get_pool(pool))["definition_digest"]
    clock(vm, NOW+60)
    for actor in (alice, bob):
        vm.sender = actor
        c.ratify_claim(pool, digest)

def answer(vm, classes=("PRIORITY", "STANDARD"), pool="pool", **extra):
    vm.clear_mocks()
    mapping = classes if isinstance(classes, dict) else {pool+":"+str(i): v for i, v in enumerate(classes)}
    result = {"classes": mapping, "reason": "Meaning agrees."}
    result.update(extra)
    vm.mock_llm(r"(?s).*RankReserve meaning judge.*", json.dumps(json.dumps(result)))

def settle(c, vm, owner, classes=("PRIORITY", "STANDARD"), pool="pool"):
    answer(vm, classes, pool)
    clock(vm, NOW+90)
    vm.sender = owner
    c.review_pool(pool)

def snapshot(c, pool="pool"):
    return c.get_pool(pool), c.get_accounting(), c.get_claim(pool, 0), c.get_claim(pool, 1)
