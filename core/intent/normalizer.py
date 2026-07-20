import re


class IntentNormalizer:
    """
    OWNS: Text cleaning and standardization.
    EXPOSES: A single 'normalize()' method.
    FORBIDDEN: Must never classify, route, or call external APIs.
    """
    
    def normalize(self, raw_text: str) -> str:
        """
        Takes messy human input and returns clean, standardized text.
        
        Example:
            Input:  "   HELP!!!  my   code is    BROKEN!!! 😡😡😡  "
            Output: "help! my code is broken!"
        """
        
        if not raw_text:
            raise ValueError("Normalizer received empty input.")
        
        text = raw_text
        
        # STEP 1: Strip leading/trailing whitespace
        text = text.strip()
        
        # STEP 2: Collapse multiple spaces into one
        # re.sub replaces patterns. '\s+' means "one or more whitespace characters"
        text = re.sub(r'\s+', ' ', text)
        
        # STEP 3: Remove emoji (they confuse LLMs during classification)
        # This regex pattern matches most emoji Unicode ranges
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"  # Emoticons
            "\U0001F300-\U0001F5FF"  # Symbols & Pictographs
            "\U0001F680-\U0001F6FF"  # Transport & Map
            "\U0001F1E0-\U0001F1FF"  # Flags
            "\U00002702-\U000027B0"  # Dingbats
            "\U000024C2-\U0001F251"  # Enclosed characters
            "]+", 
            flags=re.UNICODE
        )
        text = emoji_pattern.sub('', text).strip()
        
        # STEP 4: Reduce repeated punctuation ("!!!" → "!")
        text = re.sub(r'([!?.])\1+', r'\1', text)
        
        # STEP 5: Lowercase everything (LLMs classify better with uniform case)
        text = text.lower()
        
        return text