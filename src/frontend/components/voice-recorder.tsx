'use client';

import { useState, useEffect, useRef } from 'react'; // useState — bar heights; useRef — animation frame, audio nodes, MediaStream
import { X, Check } from 'lucide-react';

interface VoiceRecorderProps {
  isRecording: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const Tooltip = ({ text, children }: { text: string, children: React.ReactNode }) => (
    <div className="relative group"> 
      {children}
      <div className="absolute z-50 px-3 py-2 text-sm text-white bg-black rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 delay-500 whitespace-nowrap bottom-full left-1/2 transform -translate-x-1/2 mb-3">
        {text}
        <div className="absolute w-2 h-2 bg-black transform rotate-45 top-full left-1/2 -translate-x-1/2 -mt-1" /> 
      </div>
    </div>
);

export function VoiceRecorder({ isRecording, onCancel, onConfirm }: VoiceRecorderProps) {
  const [waveAnimation, setWaveAnimation] = useState<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const NUM_BARS = 60;

  useEffect(() => {
    let localStream: MediaStream | null = null;
    let audioContext: AudioContext | null = null; // Web Audio API context — mic graph root
    let analyser: AnalyserNode | null = null; // FFT analyser — getByteFrequencyData source
    let source: MediaStreamAudioSourceNode | null = null; // mic MediaStream → analyser bridge

    const cleanup = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (source) {
        source.disconnect();
      }
      if (analyser) {
        analyser.disconnect();
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      streamRef.current = null; // ref reset
      setWaveAnimation([]);
    };
    
    const animate = () => {
      if (!analyser) {
        const time = Date.now();
        const newWaves = Array.from({ length: NUM_BARS }, (_, i) => {
          const offset = time * 0.002;
          const phase = (i / (NUM_BARS - 1)) * Math.PI * 2; // bar index → wave phase
          const movement = Math.sin(offset - phase);
          return movement > 0.9 ? 4 : 2;
        });
        setWaveAnimation(newWaves);
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount); // FFT output buffer — byte values 0–255
      analyser.getByteFrequencyData(dataArray);
      const activeAnalyser = analyser;

      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      
      const newWaves = Array.from({ length: NUM_BARS }, (_, i) => {
        if (average < 10) {
            const time = Date.now();
            const offset = time * 0.002;
            const phase = (i / (NUM_BARS - 1)) * Math.PI * 2;
            const movement = Math.sin(offset - phase);
            return movement > 0.9 ? 4 : 2;
        }

        const frequencyBinCount = activeAnalyser.frequencyBinCount; // fftSize/2 bins
        const index = Math.floor((i / NUM_BARS) * (frequencyBinCount * 0.8));
        const value = dataArray[index];
        const percent = value / 255; // 0–1 normalize
        const baseHeight = 2;
        const maxHeight = 22;
        
        let height = baseHeight + (percent * maxHeight); // amplitude → visual height linear map
        return Math.max(baseHeight, height);
      });
      setWaveAnimation(newWaves); // React state — bars re-render
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // setupAudio — getUserMedia, AudioContext, analyser graph, visualization loop start
    const setupAudio = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn('getUserMedia not supported, using fallback animation.');
          animationFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true }); // mic permission + MediaStream
        streamRef.current = localStream;

        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)(); // Safari webkit prefix fallback
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256; // FFT resolution — frequencyBinCount = fftSize / 2
        analyser.smoothingTimeConstant = 0.8;

        source = audioContext.createMediaStreamSource(localStream); // mic stream → Web Audio graph
        source.connect(analyser);
        
        animationFrameRef.current = requestAnimationFrame(animate);

      } catch {
        animationFrameRef.current = requestAnimationFrame(animate); // permission error — fallback silent animation
      }
    };

    if (isRecording) {
      setupAudio();
    } else {
      cleanup();
    }

    return cleanup;
  }, [isRecording]);

  return (
    <div className="flex flex-1 items-center gap-2 animate-in fade-in duration-300 min-w-0"> 
      <div className="flex-1 flex items-center h-11 bg-muted rounded-full px-4 min-w-0"> {/* waveform capsule — rounded pill */}
        <div className="flex items-center justify-center gap-0.5 w-full h-full">
          {waveAnimation.map((height, i) => (
            <div
              key={i}
              className="w-1 bg-primary rounded-full"
              style={{
                height: `${height}px`,
                transition: 'height 0.1s ease-out', // bar height changes smooth
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3"> 
        <Tooltip text="Cancel recording">
          <button 
            onClick={onCancel}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-gray-200 text-gray-700 hover:bg-zinc-800 no-hover-overlay hover:text-white transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </Tooltip>
        <Tooltip text="Send voice message">
          <button 
            onClick={onConfirm}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-gray-200 text-gray-700 hover:bg-zinc-800 no-hover-overlay hover:text-white transition-all duration-200"
          >
            <Check className="w-5 h-5" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
