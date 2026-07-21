"""
run_sage.py — CLI interactive interface
"""
import sys, os, getpass
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.intent.pipeline import IntentPipeline
from agents.registry import AgentRegistry
from agents.general_worker import GeneralWorker
from agents.web_worker import WebWorker
from agents.vision_worker import VisionWorker

def boot_system(api_key):
    print("\n🔧 SAGE Boot v6.0")
    print("-" * 40)
    reg = AgentRegistry()
    reg.register_worker("GeneralWorker", GeneralWorker(api_key=api_key))
    reg.register_worker("WebWorker", WebWorker(api_key=api_key))
    reg.register_worker("VisionWorker", VisionWorker(api_key=api_key))
    pipeline = IntentPipeline(api_key=api_key, registry=reg)
    print("-" * 40)
    print("🟢 SAGE ONLINE.\n")
    return pipeline

def main():
    print("=" * 60)
    print("    SAGE v6.0 — Systemic Agentic General Engine")
    print("    Think. Understand. Act. Evolve.")
    print("=" * 60)
    key = os.getenv("GROQ_API_KEY") or getpass.getpass("🔑 API Key (gsk_...): ").strip()
    if not key:
        print("No key provided. Exit.")
        return
    if not key.startswith("gsk_"):
        print("❌ Invalid key format. Must start with gsk_")
        return
    
    pipe = boot_system(key)
    print("Type your query. Type exit/quit/q to leave.\n")
    while True:
        try:
            inp = input("⌨️  > ")
        except (EOFError, KeyboardInterrupt):
            break
        if inp.lower() in ('exit','quit','q'):
            break
        if not inp.strip():
            continue
        
        r = pipe.process(inp)
        print("\n" + "=" * 50)
        if r["success"]:
            i = r["intent"]
            print(f"🏷️ {i.task_type.name} | 🎯 {i.target_domain} | 🤖 {r['agent']} | 📊 {i.confidence_score:.0%}")
            print("-" * 50)
            print(f"\n{r['response']}\n")
        else:
            print(f"⚠️ {r['response']}")
        print("=" * 50 + "\n")

if __name__ == "__main__":
    main()
