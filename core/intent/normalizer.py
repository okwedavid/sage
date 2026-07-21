"""
core/intent/normalizer.py
OWNS: Text cleaning before classification
EXPOSES: IntentNormalizer.normalize()
FORBIDDEN: LLM calls, classification
"""
import re

class IntentNormalizer:
    def normalize(self, raw_text: str) -> str:
        if not raw_text:
            raise ValueError("Normalizer received empty input.")
        text = raw_text.strip()
        # Collapse whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove emojis
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"
            "\U0001F300-\U0001F5FF"
            "\U0001F680-\U0001F6FF"
            "\U0001F1E0-\U0001F1FF"
            "\U00002702-\U000027B0"
            "\U000024C2-\U0001F251"
            "]+",
            flags=re.UNICODE
        )
        text = emoji_pattern.sub('', text).strip()
        # Reduce repeated punctuation (!!! -> !)
        text = re.sub(r'([!?.])\1+', r'\1', text)
        # Lowercase for classifier consistency (but preserve original intent_text for execution later? we use cleaned for classify)
        text = text.lower()
        return text
