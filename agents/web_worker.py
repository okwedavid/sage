import requests
from bs4 import BeautifulSoup
from groq import Groq
from agents.base_worker import BaseWorker
from core.intent.schemas import IntentSchema
from core.intent.enums import TaskType


class WebWorker(BaseWorker):
    """
    OWNS: Fetching, parsing, and analyzing web content.
    EXPOSES: execute() method that accepts intents containing URLs.
    FORBIDDEN: Must never store cookies, login to sites, or execute JavaScript.
    """
    
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)
        # Pretend to be a normal browser so websites don't block us
        self.headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
        }
    
    def _extract_urls(self, text: str) -> list:
        """
        Finds all URLs inside a block of text.
        Returns a list of URL strings.
        """
        import re
        url_pattern = re.compile(
            r'https?://[^\s<>"\')\]]+',
            re.IGNORECASE
        )
        return url_pattern.findall(text)
    
    def _fetch_page(self, url: str) -> str:
        """
        Downloads a web page and extracts only the readable text.
        Strips out HTML tags, scripts, styles, and navigation elements.
        """
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove non-content elements
            for element in soup(['script', 'style', 'nav', 'header', 
                                 'footer', 'aside', 'form', 'iframe']):
                element.decompose()
            
            # Extract clean text
            text = soup.get_text(separator='\n', strip=True)
            
            # Collapse excessive blank lines
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            clean_text = '\n'.join(lines)
            
            # Limit to first 3000 characters (LLM context window protection)
            return clean_text[:3000]
            
        except requests.exceptions.Timeout:
            return "[ERROR] Website took too long to respond (>10 seconds)."
        except requests.exceptions.ConnectionError:
            return "[ERROR] Could not connect to the website."
        except Exception as e:
            return f"[ERROR] Failed to fetch page: {e}"
    
    def execute(self, intent: IntentSchema) -> str:
        """
        1. Extract URLs from the user's input
        2. Fetch each page's content
        3. Feed the content + user's question to the LLM
        """
        
        print(f"🌐 [WebWorker] Scanning for URLs...")
        
        urls = self._extract_urls(intent.input_text)
        
        if not urls:
            return self._fallback_execute(intent)
        
        # Fetch content from the first URL found
        target_url = urls[0]
        print(f"🌐 [WebWorker] Fetching: {target_url}")
        
        page_content = self._fetch_page(target_url)
        
        if page_content.startswith("[ERROR]"):
            return page_content
        
        print(f"🌐 [WebWorker] Extracted {len(page_content)} characters. Analyzing...")
        
        # Now ask the LLM to analyze the fetched content
        try:
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system", 
                        "content": """You are SAGE-WebAnalyst. You receive web page content 
                        and the user's original question. Analyze the content and provide 
                        a clear, structured answer. Always cite specific details from 
                        the page content. If the content doesn't answer the question, 
                        say so honestly."""
                    },
                    {
                        "role": "user", 
                        "content": f"""
                        USER'S QUESTION: {intent.input_text}
                        
                        SOURCE URL: {target_url}
                        
                        PAGE CONTENT:
                        ---
                        {page_content}
                        ---
                        
                        Analyze this content and answer the user's question.
                        """
                    }
                ],
                temperature=0.3,
                max_tokens=1500
            )
            
            answer = response.choices[0].message.content
            return f"🌐 **Source:** [{target_url}]({target_url})\n\n---\n\n{answer}"
            
        except Exception as e:
            return f"[WebWorker ERROR] Analysis failed: {e}"
    
    def _fallback_execute(self, intent: IntentSchema) -> str:
        """
        If no URL is found, behave like a normal research worker.
        """
        try:
            response = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a helpful research assistant."},
                    {"role": "user", "content": intent.input_text}
                ],
                temperature=0.7,
                max_tokens=1024
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"[WebWorker ERROR] Fallback failed: {e}"