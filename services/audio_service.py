"""
services/audio_service.py
OWNS: Speech-to-Text (Whisper) + Text-to-Speech (gTTS)
EXPOSES: transcribe(), synthesize()
FORBIDDEN: UI, routing
"""
import io
import re
from groq import Groq
from gtts import gTTS
from config.settings import Settings

class AudioService:
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key.strip())

    def transcribe(self, audio_bytes: bytes, filename: str = "recording.wav") -> str:
        print("🎤 [AudioService] Transcribing...")
        if not audio_bytes:
            raise ValueError("No audio bytes provided")
        try:
            # Groq expects file tuple (filename, bytes)
            result = self.client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model=Settings.WHISPER_MODEL,
                language="en",
                response_format="text"
            )
            # Handle both string and object response
            if isinstance(result, str):
                text = result
            else:
                text = getattr(result, 'text', str(result))
            text = text.strip()
            print(f"🎤 Transcribed: \"{text[:80]}...\"")
            return text
        except Exception as e:
            raise RuntimeError(f"STT failed: {e}")

    def synthesize(self, text: str, language: str = None) -> bytes:
        lang = language or Settings.TTS_LANGUAGE
        print("🔊 [AudioService] Synthesizing...")
        try:
            # Strip markdown for cleaner speech
            clean = re.sub(r'[*#`_\[\]\(\)]', '', text)
            clean = clean.replace("---", " ").replace("**", "")
            clean = re.sub(r'\s+', ' ', clean).strip()
            if len(clean) > 3000:
                clean = clean[:3000] + "... truncated for audio."
            if not clean:
                clean = "No speech content available."
            
            tts = gTTS(text=clean, lang=lang, slow=False)
            buf = io.BytesIO()
            tts.write_to_fp(buf)
            buf.seek(0)
            audio = buf.read()
            print(f"🔊 Generated {len(audio)} bytes")
            return audio
        except Exception as e:
            raise RuntimeError(f"TTS failed: {e}")
