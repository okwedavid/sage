from core.intent.enums import TaskType, OutputFormat


class AgentRegistry:
    """
    OWNS: The mapping between Intent properties and available Workers.
    EXPOSES: lookup() and register_worker() methods.
    FORBIDDEN: Must never execute tasks or call APIs.
    """
    
    def __init__(self):
        self._registry = {
            # --- TEXT-BASED AGENTS ---
            OutputFormat.TEXT: {"default": "GeneralWorker"},
            OutputFormat.MARKDOWN: {
                TaskType.RESEARCH: "WebWorker",    # Research tasks check for URLs
                TaskType.ANALYZE: "WebWorker",     # Analysis tasks check for URLs
                "default": "GeneralWorker"
            },
            OutputFormat.PYTHON: {
                TaskType.BUILD: "GeneralWorker",
                TaskType.DEBUG: "GeneralWorker",
                "default": "GeneralWorker"
            },
            
            # --- FUTURE AGENTS (Stubs) ---
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
        format_registry = self._registry.get(output_format, {})
        worker_name = format_registry.get(task_type)
        if not worker_name:
            worker_name = format_registry.get("default", "GeneralWorker")
        worker = self._workers.get(worker_name)
        if not worker:
            # FALLBACK: If the specific worker doesn't exist, use GeneralWorker
            worker = self._workers.get("GeneralWorker")
            worker_name = "GeneralWorker"
            if not worker:
                raise RuntimeError(
                    f"No worker registered. "
                    f"Available: {list(self._workers.keys())}"
                )
        return worker, worker_name