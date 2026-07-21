import io
from groq import Groq
from gtts import gTTS
from config.settings import Settings


class AudioService:
    """
    OWNS: All audio transformations (Speech-to-Text, Text-to-Speech).
    EXPOSES: transcribe() and synthesize() methods.
    FORBIDDEN: Must never classify intents, route agents, or render UI.
    """
    
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)
    
    def transcribe(self, audio_bytes: bytes, filename: str = "recording.wav") -> str:
        """
        Speech-to-Text using Groq's Whisper model.
        
        Takes: Raw audio bytes from microphone
        Returns: Transcribed text string
        """
        print("🎤 [AudioService] Transcribing speech...")
        
        try:
            transcription = self.client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model=Settings.WHISPER_MODEL,
                language="en"
            )
            
            text = transcription.text.strip()
            print(f"🎤 [AudioService] Transcribed: \"{text[:50]}...\"")
            return text
            
        except Exception as e:
            print(f"❌ [AudioService] Transcription failed: {e}")
            raise RuntimeError(f"Speech-to-Text failed: {e}")
    
    def synthesize(self, text: str, language: str = None) -> bytes:
        """
        Text-to-Speech using Google TTS (free, no API key needed).
        
        Takes: Text string to speak
        Returns: MP3 audio bytes ready for playback
        """
        if not language:
            language = Settings.TTS_LANGUAGE
        
        print("🔊 [AudioService] Generating speech...")
        
        try:
            # Clean the text for better speech output
            # Remove markdown formatting that sounds weird when spoken
            clean_text = text
            clean_text = clean_text.replace("**", "")
            clean_text = clean_text.replace("##", "")
            clean_text = clean_text.replace("```", "")
            clean_text = clean_text.replace("`", "")
            clean_text = clean_text.replace("---", "")
            clean_text = clean_text.replace("*", "")
            
            # Limit length (gTTS has practical limits for speed)
            if len(clean_text) > 3000:
                clean_text = clean_text[:3000] + "... Response truncated for audio."
            
            # Generate speech
            tts = gTTS(text=clean_text, lang=language, slow=False)
            
            # Write to memory buffer (not disk)
            audio_buffer = io.BytesIO()
            tts.write_to_fp(audio_buffer)
            audio_buffer.seek(0)
            
            audio_bytes = audio_buffer.read()
            print(f"🔊 [AudioService] Generated {len(audio_bytes)} bytes of audio.")
            return audio_bytes
            
        except Exception as e:
            print(f"❌ [AudioService] Speech synthesis failed: {e}")
            raise RuntimeError(f"Text-to-Speech failed: {e}")