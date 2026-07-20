import sys
import os
import getpass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the Pipeline and Registry
from core.intent.pipeline import IntentPipeline
from agents.registry import AgentRegistry
from agents.general_worker import GeneralWorker


def boot_system(api_key: str) -> IntentPipeline:
    """
    Initializes all components and returns a ready-to-use Pipeline.
    This is the 'Power On' sequence for SAGE.
    """
    print("\n🔧 SAGE Boot Sequence")
    print("-" * 40)
    
    # 1. Create the Phone Book
    registry = AgentRegistry()
    
    # 2. Create Workers and Register them
    print("   Loading Workers...")
    general = GeneralWorker(api_key=api_key)
    registry.register_worker("GeneralWorker", general)
    
    # Future: Uncomment when you build these agents
    # image_worker = ImageWorker(api_key=stability_key)
    # registry.register_worker("ImageWorker", image_worker)
    
    # 3. Build the Pipeline with all components
    print("   Assembling Pipeline...")
    pipeline = IntentPipeline(api_key=api_key, registry=registry)
    
    print("-" * 40)
    print("🟢 SAGE is ONLINE.\n")
    
    return pipeline


def main():
    print("=" * 60)
    print("    SYSTEMIC AGENTIC GENERAL ENGINE (SAGE) v3.0")
    print("    Sprint 3: Full Pipeline Architecture")
    print("=" * 60)
    
    # Authentication
    api_key = getpass.getpass("🔑 Enter Groq API Key: ")
    if not api_key:
        print("❌ No key provided.")
        return
    
    # Boot
    pipeline = boot_system(api_key)
    
    # Interactive Loop
    while True:
        user_input = input("⌨️  YOU > ")
        
        if user_input.lower() in ('exit', 'quit', 'q'):
            print("👋 Shutting down SAGE.")
            break
        
        if not user_input.strip():
            continue
        
        # ONE CALL does everything now
        result = pipeline.process(user_input)
        
        # Display
        print("\n" + "=" * 50)
        if result["success"]:
            intent = result["intent"]
            print(f"🏷️  INTENT  : {intent.task_type.name}")
            print(f"🎯 DOMAIN  : {intent.target_domain}")
            print(f"🤖 AGENT   : {result['agent']}")
            print(f"📊 STATUS  : {intent.status.name}")
            print("-" * 50)
            print(f"\n{result['response']}\n")
        else:
            print(f"⚠️  {result['response']}")
        print("=" * 50 + "\n")


if __name__ == "__main__":
    main()