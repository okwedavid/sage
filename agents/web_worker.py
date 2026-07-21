"""
agents/web_worker.py
OWNS: URL fetching + web analysis worker
EXPOSES: execute()
FORBIDDEN: Routing logic
"""
import re
import requests
from bs4 import BeautifulSoup
from groq import Groq
from agents.base_worker import BaseWorker
from core.intent.schemas import IntentSchema
from config.settings import Settings

class WebWorker(BaseWorker):
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key.strip())
        self.headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}

    def _extract_urls(self, text: str) -> list:
        return re.findall(r'https?://[^\s<>"\')\]]+', text, re.IGNORECASE)

    def _fetch_page(self, url: str) -> str:
        try:
            resp = requests.get(url, headers=self.headers, timeout=12)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, 'html.parser')
            for el in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'form', 'iframe', 'noscript']):
                el.decompose()
            text = soup.get_text(separator='\n', strip=True)
            lines = [l.strip() for l in text.splitlines() if l.strip()]
            # Remove very short lines, dedupe
            cleaned = []
            seen = set()
            for l in lines:
                if len(l) < 20:
                    continue
                if l not in seen:
                    cleaned.append(l)
                    seen.add(l)
            return '\n'.join(cleaned)[:4000]
        except Exception as e:
            return f"[FETCH ERROR] {e}"

    def execute(self, intent: IntentSchema) -> str:
        urls = self._extract_urls(intent.input_text)
        if not urls:
            return self._fallback(intent)
        
        url = urls[0]
        print(f"🌐 [WebWorker] Fetching: {url}")
        content = self._fetch_page(url)
        if content.startswith("[FETCH ERROR]") or content.startswith("[ERROR]"):
            return f"⚠️ Could not fetch {url}\n\n{content}\n\nFalling back to knowledge synthesis:\n\n" + self._fallback(intent)
        
        try:
            resp = self.client.chat.completions.create(
                model=Settings.DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": "You are SAGE-WebAnalyst, a web intelligence specialist. Analyze web content deeply. Structure your answer with: Summary, Key Insights, Detailed Analysis. Cite specifics from source. Use markdown with headers and bullets."},
                    {"role": "user", "content": f"USER QUESTION: {intent.input_text}\n\nSOURCE URL: {url}\n\nPAGE CONTENT:\n{content}\n\nTask: Provide Web Intelligence Report answering the question using the source content."}
                ],
                temperature=0.3,
                max_tokens=1500
            )
            answer = resp.choices[0].message.content
            return f"🌐 **Source:** [{url}]({url})\n\n---\n\n{answer}"
        except Exception as e:
            return f"[WebWorker ERROR] {e}\n\nFallback: {self._fallback(intent)}"

    def _fallback(self, intent):
        try:
            resp = self.client.chat.completions.create(
                model=Settings.DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": "You are SAGE research assistant. Provide structured factual reports."},
                    {"role": "user", "content": intent.input_text}
                ],
                temperature=0.7, max_tokens=Settings.MAX_TOKENS
            )
            return resp.choices[0].message.content
        except Exception as e:
            return f"[WebWorker Fallback ERROR] {e}"
