from .schemas import IntentSchema
from .enums import Status, TaskType


class IntentValidator:
    """
    OWNS: Post-classification quality assurance.
    EXPOSES: A single 'validate()' method that returns a pass/fail verdict.
    FORBIDDEN: Must never modify the intent's task_type or call APIs.
    """
    
    # Minimum confidence threshold. Below this, we reject the classification.
    CONFIDENCE_THRESHOLD = 0.4
    
    def validate(self, intent: IntentSchema) -> IntentSchema:
        """
        Inspects a classified IntentSchema for quality.
        
        Rules:
            1. task_type must not be None (Classifier must have assigned something)
            2. confidence_score must exceed the threshold
            3. target_domain must not be empty
            
        If validation passes: status advances to VALIDATED
        If validation fails:  status advances to FAILED with a reason
        """
        
        errors = []
        
        # CHECK 1: Was a task type assigned?
        if intent.task_type is None:
            errors.append("Classifier failed to assign a task_type.")
        
        # CHECK 2: Is the AI confident enough?
        if intent.confidence_score < self.CONFIDENCE_THRESHOLD:
            errors.append(
                f"Confidence too low: {intent.confidence_score:.0%} "
                f"(minimum: {self.CONFIDENCE_THRESHOLD:.0%})"
            )
        
        # CHECK 3: Did the AI identify a domain?
        if not intent.target_domain or intent.target_domain.strip() == "":
            errors.append("No target_domain was identified.")
        
        # --- VERDICT ---
        if errors:
            print(f"❌ [Validator] Intent REJECTED: {errors}")
            intent.advance_status(Status.FAILED)
            # Store the failure reason inside the intent's context field
            intent.context = f"Validation failed: {'; '.join(errors)}"
        else:
            print(f"✅ [Validator] Intent APPROVED (Confidence: {intent.confidence_score:.0%})")
            intent.advance_status(Status.VALIDATED)
        
        return intent