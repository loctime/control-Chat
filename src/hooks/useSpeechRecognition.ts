import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: {
      transcript: string;
    };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const AUTO_STOP_SILENCE_MS = 3500;

const mapSpeechError = (errorCode: string): string => {
  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
    return "Permiso de microfono denegado.";
  }
  if (errorCode === "no-speech") {
    return "No se detecto voz.";
  }
  if (errorCode === "audio-capture") {
    return "No se encontro un microfono disponible.";
  }
  return "No se pudo completar la dictacion por voz.";
};

export const useSpeechRecognition = () => {
  const isSupported = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimeoutRef = useRef<number | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const clearSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current !== null) {
      window.clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, []);

  const scheduleAutoStop = useCallback(() => {
    clearSilenceTimeout();
    silenceTimeoutRef.current = window.setTimeout(() => {
      recognitionRef.current?.stop();
      setIsProcessing(true);
    }, AUTO_STOP_SILENCE_MS);
  }, [clearSilenceTimeout]);

  useEffect(() => {
    if (!isSupported || recognitionRef.current) return;

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionCtor) return;

    const recognition = new RecognitionCtor();
    recognition.lang = "es-AR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
      setIsProcessing(false);
      scheduleAutoStop();
    };

    recognition.onresult = (event) => {
      let combined = "";

      for (let i = 0; i < event.results.length; i += 1) {
        combined += event.results[i]?.[0]?.transcript ?? "";
      }

      setTranscript(combined.trim());
      setIsProcessing(false);
      scheduleAutoStop();
    };

    recognition.onerror = (event) => {
      setError(mapSpeechError(event.error));
      setIsProcessing(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setIsProcessing(false);
      clearSilenceTimeout();
    };

    recognitionRef.current = recognition;

    return () => {
      clearSilenceTimeout();
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [clearSilenceTimeout, isSupported, scheduleAutoStop]);

  const startRecording = useCallback(() => {
    if (!isSupported) {
      setError("La dictacion por voz no esta disponible en este navegador.");
      return;
    }

    if (!recognitionRef.current || isRecording) return;

    setError(null);
    setTranscript("");
    setIsProcessing(false);

    try {
      recognitionRef.current.start();
    } catch {
      setError("No se pudo iniciar la grabacion de voz.");
    }
  }, [isRecording, isSupported]);

  const stopRecording = useCallback(() => {
    if (!recognitionRef.current || !isRecording) return;
    setIsProcessing(true);
    recognitionRef.current.stop();
  }, [isRecording]);

  return {
    startRecording,
    stopRecording,
    isRecording,
    isProcessing,
    transcript,
    error,
    isSupported
  };
};
