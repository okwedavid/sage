"""
agents/registry.py
OWNS: Plugin-based agent phone book
EXPOSES: register_worker(), lookup()
FORBIDDEN: Executing tasks, LLM calls
"""
from core.intent.enums import TaskType, OutputFormat

class AgentRegistry:
    def __init__(self):
        self._registry = {
            OutputFormat.TEXT: {"default": "GeneralWorker"},
            OutputFormat.MARKDOWN: {
                TaskType.RESEARCH: "WebWorker",
                TaskType.ANALYZE: "WebWorker",
                "default": "GeneralWorker"
            },
            OutputFormat.PYTHON: {
                TaskType.BUILD: "GeneralWorker",
                TaskType.DEBUG: "GeneralWorker",
                "default": "GeneralWorker"
            },
            OutputFormat.IMAGE: {"default": "ImageWorker"},
            OutputFormat.VIDEO: {"default": "VideoWorker"},
            OutputFormat.PDF: {"default": "ReportWorker"},
            OutputFormat.JSON: {"default": "GeneralWorker"},
            OutputFormat.HTML: {"default": "GeneralWorker"},
        }
        self._workers = {}

    def register_worker(self, name: str, worker_instance):
        self._workers[name] = worker_instance
        print(f"   📦 Registered: {name}")

    def lookup(self, task_type: TaskType, output_format: OutputFormat):
        fmt_reg = self._registry.get(output_format, {})
        worker_name = fmt_reg.get(task_type) or fmt_reg.get("default", "GeneralWorker")
        worker = self._workers.get(worker_name)
        if not worker:
            worker = self._workers.get("GeneralWorker")
            worker_name = "GeneralWorker"
            if not worker:
                raise RuntimeError(f"No workers available: {list(self._workers.keys())}")
        return worker, worker_name

    def list_workers(self):
        return list(self._workers.keys())
