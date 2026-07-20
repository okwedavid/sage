from core.intent.schemas import IntentSchema
from core.intent.enums import TaskType, Priority, Status, OutputFormat

if __name__ == "__main__":
    print("🧪 SAGE Sprint 2 — Domain Model Test Suite")
    print("=" * 50)
    
    # TEST 1: Create a valid Intent
    print("\n📋 Test 1: Valid Intent Creation")
    intent = IntentSchema(
        input_text="Research why my ping script failed on ubuntu",
        task_type=TaskType.DEBUG,
        target_domain="Networking",
        confidence_score=0.95,
        priority=Priority.HIGH
    )
    print(f"   ✅ {intent}")
    print(f"   ID: {intent.intent_id}")
    print(f"   Status: {intent.status.name}")
    
    # TEST 2: Advance lifecycle
    print("\n📋 Test 2: Lifecycle Advancement")
    intent.advance_status(Status.ROUTED)
    print(f"   ✅ Advanced to: {intent.status.name}")
    intent.advance_status(Status.EXECUTING)
    print(f"   ✅ Advanced to: {intent.status.name}")
    
    # TEST 3: Try to go BACKWARD (Should FAIL)
    print("\n📋 Test 3: Backward Movement (Should Fail)")
    try:
        intent.advance_status(Status.RECEIVED)
        print("   ❌ ERROR: This should not have worked!")
    except ValueError as e:
        print(f"   ✅ Correctly rejected: {e}")
    
    # TEST 4: Bad confidence score (Should FAIL)
    print("\n📋 Test 4: Invalid Confidence (Should Fail)")
    try:
        bad_intent = IntentSchema(input_text="test", confidence_score=5.0)
        print("   ❌ ERROR: This should not have worked!")
    except ValueError as e:
        print(f"   ✅ Correctly rejected: {e}")
    
    # TEST 5: Serialization
    print("\n📋 Test 5: Serialization to Dict")
    data = intent.to_dict()
    print(f"   ✅ Keys: {list(data.keys())}")
    
    print("\n" + "=" * 50)
    print("🏁 All Domain Model Tests Complete.")