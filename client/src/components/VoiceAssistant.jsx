import React, { useState } from 'react';

export default function VoiceAssistant({ textToSpeak }) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeech = () => {
    if ('speechSynthesis' in window) {
      // If system is already talking, cancel it toggling off
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      // Attempting to set a warmer, slightly higher rounded pitch voice suited for kids
      utterance.pitch = 1.2;
      utterance.rate = 0.95;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } else {
      alert("⚠️ Audio system is unavailable on this device browser profile.");
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={handleSpeech}
        className={`w-16 h-16 rounded-full border-4 border-[#2D2D2D] shadow-game-md flex items-center justify-center text-3xl font-black transition-all duration-200 active:translate-y-1 active:shadow-none
          ${isSpeaking 
            ? 'bg-playfulCoral text-white animate-pulse' 
            : 'bg-playfulTeal text-white hover:scale-105'
          }
        `}
        title="Tap for voice help!"
      >
        {isSpeaking ? "🔊" : "🗣️"}
      </button>
    </div>
  );
}