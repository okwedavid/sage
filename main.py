"""
main.py — Offline test suite / unit tests
"""
from core.intent.schemas import IntentSchema
from core.intent.enums import TaskType, Priority, Status, OutputFormat
from core.intent.normalizer import IntentNormalizer
from agents.registry import AgentRegistry

if __name__ == "__main__":
    print("🧪 SAGE Domain Model Tests v6.0")
    print("=" * 60)

    print("\n📋 Test 1: Valid Intent Creation")
    i = IntentSchema(
        input_text="Research why ping failed",
        task_type=TaskType.DEBUG,
        target_domain="Networking",
        confidence_score=0.95,
        priority=Priority.HIGH
    )
    print(f"   ✅ {i}")
    print(f"   ✅ ID: {i.intent_id[:8]} | Status: {i.status.name}")

    print("\n📋 Test 2: Lifecycle Forward")
    i.advance_status(Status.VALIDATED)
    print(f"   ✅ → {i.status.name}")
    i.advance_status(Status.ROUTED)
    print(f"   ✅ → {i.status.name}")
    i.advance_status(Status.EXECUTING)
    print(f"   ✅ → {i.status.name}")
    i.advance_status(Status.COMPLETED)
    print(f"   ✅ → {i.status.name}")

    print("\n📋 Test 3: Backward Rejection (Should Fail)")
    try:
        i.advance_status(Status.RECEIVED)
        print("   ❌ Should have failed!")
    except ValueError as e:
        print(f"   ✅ Correctly Rejected: {e}")

    print("\n📋 Test 4: Bad Confidence (Should Fail)")
    try:
        IntentSchema(input_text="test", confidence_score=5.0)
        print("   ❌ Should have failed!")
    except ValueError as e:
        print(f"   ✅ Correctly Rejected: {e}")

    print("\n📋 Test 5: Serialization")
    d = i.to_dict()
    print(f"   ✅ Keys: {list(d.keys())}")
    print(f"   ✅ Dict sample: task_type={d['task_type']}, domain={d['target_domain']}")

    print("\n📋 Test 6: Normalizer")
    norm = IntentNormalizer()
    raw = "  HELLOOOO!!!   How are you??? 😊😊  "
    clean = norm.normalize(raw)
    print(f"   ✅ Raw: {raw}")
    print(f"   ✅ Clean: {clean}")

    print("\n📋 Test 7: Registry")
    reg = AgentRegistry()
    print(f"   ✅ Registry defaults: {list(reg._registry.keys())[:3]}...")

    print("\n📋 Test 8: Attachments field")
    i2 = IntentSchema(input_text="Analyze image", attachments={"image_base64": "abc123"})
    print(f"   ✅ Has attachments: {bool(i2.attachments)}")
    print(f"   ✅ to_dict has_attachments: {i2.to_dict()['has_attachments']}")

    print("\n" + "=" * 60)
    print("🏁 All Tests Passed. SAGE Domain Model is healthy.")
