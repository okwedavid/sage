from core.intent.enums import TaskType, OutputFormat


class AgentRegistry:
    """
    OWNS: The mapping between Intent properties and available Workers.
    EXPOSES: lookup() method for the Router.
    FORBIDDEN: Must never execute tasks or call APIs.
    
    Think of this as a Phone Book:
        "If the task is DEBUG → call the CodeWorker"
        "If the output is IMAGE → call the ImageWorker"
    """
    
    def __init__(self):
        # The Registry is a dictionary of dictionaries.
        # Outer key: OutputFormat (what KIND of output)
        # Inner key: TaskType (what KIND of task)
        # Value: The string name of the Agent class to use
        
        self._registry = {
            # --- TEXT-BASED AGENTS ---
            OutputFormat.TEXT: {
                "default": "GeneralWorker"
            },
            OutputFormat.MARKDOWN: {
                "default": "GeneralWorker"
            },
            OutputFormat.PYTHON: {
                TaskType.BUILD: "GeneralWorker",
                TaskType.DEBUG: "GeneralWorker",
                "default": "GeneralWorker"
            },
            
            # --- FUTURE AGENTS (Stubs) ---
            OutputFormat.IMAGE: {
                "default": "ImageWorker"     # Future: Stability AI
            },
            OutputFormat.VIDEO: {
                "default": "VideoWorker"     # Future: Runway ML
            },
            OutputFormat.PDF: {
                "default": "ReportWorker"    # Future: PDF Generator
            },
        }
        
        # The actual instantiated worker objects live here
        self._workers = {}
    
    def register_worker(self, name: str, worker_instance):
        """
        Adds a live worker to the registry.
        Called during system boot to 'plug in' available agents.
        """
        self._workers[name] = worker_instance
        print(f"   📦 Registered: {name}")
    
    def lookup(self, task_type: TaskType, output_format: OutputFormat):
        """
        Given a task type and output format, returns the best available worker.
        
        Lookup Priority:
            1. Exact match (task_type + output_format)
            2. Default worker for that output_format
            3. Global fallback (GeneralWorker)
        """
        
        # Step 1: Find the format-specific registry
        format_registry = self._registry.get(output_format, {})
        
        # Step 2: Look for exact task match
        worker_name = format_registry.get(task_type)
        
        # Step 3: Fall back to default for that format
        if not worker_name:
            worker_name = format_registry.get("default", "GeneralWorker")
        
        # Step 4: Return the actual worker object
        worker = self._workers.get(worker_name)
        
        if not worker:
            raise RuntimeError(
                f"No worker registered for '{worker_name}'. "
                f"Available workers: {list(self._workers.keys())}"
            )
        
        return worker, worker_name