import sys
import os
import getpass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.intent.pipeline import IntentPipeline
from agents.registry import AgentRegistry
from agents.general_worker import GeneralWorker
from agents.web_worker import WebWorker
from agents.vision_worker import VisionWorker


def boot_system(api_key: str) -> IntentPipeline:
    print("\n🔧 SAGE Boot Sequence v5.0")
    print("-" * 40)
    registry = AgentRegistry()
    
    print("   Loading Workers...")
    registry.register_worker("GeneralWorker", GeneralWorker(api_key=api_key))
    registry.register_worker("WebWorker", WebWorker(api_key=api_key))
    registry.register_worker("VisionWorker", VisionWorker(api_key=api_key))
    
    print("   Assembling Pipeline...")
    pipeline = IntentPipeline(api_key=api_key, registry=registry)
    print("-" * 40)
    print("🟢 SAGE is ONLINE.\n")
    return pipeline


def main():
    print("=" * 60)
    print("    SYSTEMIC AGENTIC GENERAL ENGINE (SAGE) v5.0")
    print("    Sprint 5: Multimodal Intelligence")
    print("=" * 60)
    
    api_key = getpass.getpass("🔑 Enter Groq API Key: ")
    if not api_key:
        print("❌ No key provided.")
        return
    
    pipeline = boot_system(api_key)
    
    while True:
        user_input = input("⌨️  YOU > ")
        
        if user_input.lower() in ('exit', 'quit', 'q'):
            print("👋 Shutting down SAGE.")
            break
        if not user_input.strip():
            continue
        
        result = pipeline.process(user_input)
        
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