"""
core/intent/validator.py
OWNS: Post-classification quality assurance
EXPOSES: IntentValidator.validate()
FORBIDDEN: LLM calls, execution
"""
from .schemas import IntentSchema
from .enums import Status

class IntentValidator:
    CONFIDENCE_THRESHOLD = 0.4

    def validate(self, intent: IntentSchema) -> IntentSchema:
        errors = []
        if intent.task_type is None:
            errors.append("No task_type assigned.")
        if intent.confidence_score < self.CONFIDENCE_THRESHOLD:
            errors.append(
                f"Confidence too low: {intent.confidence_score:.0%} "
                f"(min: {self.CONFIDENCE_THRESHOLD:.0%})"
            )
        if not intent.target_domain or not intent.target_domain.strip():
            errors.append("No target_domain identified.")
        
        if errors:
            print(f"❌ [Validator] REJECTED: {errors}")
            intent.advance_status(Status.FAILED)
            intent.context = f"Validation failed: {'; '.join(errors)}"
        else:
            print(f"✅ [Validator] APPROVED ({intent.confidence_score:.0%})")
            intent.advance_status(Status.VALIDATED)
        return intent
