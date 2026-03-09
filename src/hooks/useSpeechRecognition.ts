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

type SpeechPhase = "idle" | "starting" | "recording" | "processing";

interface UseSpeechRecognitionOptions {
  onTranscriptChange?: (nextTranscript: string) => void;
  onEnd?: (finalTranscript: string) => void | Promise<void>;
  onStart?: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

const AUTO_STOP_SILENCE_MS = 3500;

const appendChunk = (base: string, chunk: string) => {
  const normalizedBase = base.trim();
  const normalizedChunk = chunk.trim();

  if (!normalizedChunk) return normalizedBase;
  if (!normalizedBase) return normalizedChunk;
  return `${normalizedBase} ${normalizedChunk}`;
};

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
  if (errorCode === "aborted") {
    return "Dictado cancelado.";
  }
  return "No se pudo completar la dictacion por voz.";
};

export const useSpeechRecognition = (options?: UseSpeechRecognitionOptions) => {
  const isSupported = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const transcriptBufferRef = useRef("");
  const interimBufferRef = useRef("");

  const pendingStopRef = useRef(false);
  const suppressEndRef = useRef(false);

  const onTranscriptChangeRef = useRef<UseSpeechRecognitionOptions["onTranscriptChange"]>(options?.onTranscriptChange);
  const onEndRef = useRef<UseSpeechRecognitionOptions["onEnd"]>(options?.onEnd);
  const onStartRef = useRef<UseSpeechRecognitionOptions["onStart"]>(options?.onStart);

  const [phase, setPhase] = useState<SpeechPhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const phaseRef = useRef<SpeechPhase>("idle");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    onTranscriptChangeRef.current = options?.onTranscriptChange;
    onEndRef.current = options?.onEnd;
    onStartRef.current = options?.onStart;
  }, [options?.onEnd, options?.onStart, options?.onTranscriptChange]);

  const clearSilenceTimeout = useCallback(() => {
    if (silenceTimeoutRef.current !== null) {
      window.clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, []);

  const scheduleAutoStop = useCallback(() => {
    clearSilenceTimeout();
    silenceTimeoutRef.current = window.setTimeout(() => {
      pendingStopRef.current = false;
      if (!recognitionRef.current) return;
      setPhase("processing");
      recognitionRef.current.stop();
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
      setPhase("recording");
      onStartRef.current?.();
      scheduleAutoStop();

      if (pendingStopRef.current) {
        pendingStopRef.current = false;
        setPhase("processing");
        recognition.stop();
      }
    };

    recognition.onresult = (event) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i]?.[0]?.transcript ?? "";
        if (!piece) continue;

        if (event.results[i]?.isFinal) {
          transcriptBufferRef.current = appendChunk(transcriptBufferRef.current, piece);
        } else {
          interim = appendChunk(interim, piece);
        }
      }

      interimBufferRef.current = interim;
      const combinedTranscript = appendChunk(transcriptBufferRef.current, interimBufferRef.current);
      setTranscript(combinedTranscript);
      onTranscriptChangeRef.current?.(combinedTranscript);
      scheduleAutoStop();
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        setError(mapSpeechError(event.error));
      }

      if (phaseRef.current !== "idle") {
        setPhase("processing");
      }
    };

    recognition.onend = () => {
      clearSilenceTimeout();
      pendingStopRef.current = false;

      const suppressed = suppressEndRef.current;
      suppressEndRef.current = false;

      setPhase("idle");

      if (suppressed) {
        transcriptBufferRef.current = "";
        interimBufferRef.current = "";
        setTranscript("");
        onTranscriptChangeRef.current?.("");
        return;
      }

      const finalTranscript = appendChunk(transcriptBufferRef.current, interimBufferRef.current);
      transcriptBufferRef.current = finalTranscript;
      interimBufferRef.current = "";
      setTranscript(finalTranscript);
      onTranscriptChangeRef.current?.(finalTranscript);
      void onEndRef.current?.(finalTranscript);
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

    if (!recognitionRef.current || phaseRef.current !== "idle") return;

    setError(null);
    transcriptBufferRef.current = "";
    interimBufferRef.current = "";
    pendingStopRef.current = false;
    suppressEndRef.current = false;
    setTranscript("");
    onTranscriptChangeRef.current?.("");
    setPhase("starting");

    try {
      recognitionRef.current.start();
    } catch {
      setPhase("idle");
      setError("No se pudo iniciar la grabacion de voz.");
    }
  }, [isSupported]);

  const stopRecording = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (phaseRef.current === "starting") {
      pendingStopRef.current = true;
      setPhase("processing");
      return;
    }

    if (phaseRef.current === "recording") {
      pendingStopRef.current = false;
      setPhase("processing");
      recognition.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    const recognition = recognitionRef.current;

    pendingStopRef.current = false;
    suppressEndRef.current = true;
    transcriptBufferRef.current = "";
    interimBufferRef.current = "";
    setTranscript("");
    onTranscriptChangeRef.current?.("");
    clearSilenceTimeout();

    if (recognition && phaseRef.current !== "idle") {
      recognition.abort();
    }

    setPhase("idle");
  }, [clearSilenceTimeout]);

  return {
    startRecording,
    stopRecording,
    cancelRecording,
    isStarting: phase === "starting",
    isRecording: phase === "recording",
    isProcessing: phase === "processing",
    phase,
    transcript,
    error,
    isSupported
  };
};
