
import React, { useRef, useEffect } from 'react';

interface VisualizerProps {
  analyzer: AnalyserNode | undefined;
  isPlaying: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ analyzer, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Fix: useRef requires an initial value argument in some strict TypeScript configurations to avoid "Expected 1 arguments, but got 0"
  const requestRef = useRef<number | undefined>(undefined);

  // Fix: Added optional 'time' parameter to match requestAnimationFrame callback signature and handle manual calls
  const draw = (time?: number) => {
    if (!canvasRef.current || !analyzer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyzer.getByteTimeDomainData(dataArray);

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
    for(let i = 0; i < canvas.width; i += 40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for(let i = 0; i < canvas.height; i += 40) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // Oscilloscope trace
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#38bdf8';
    ctx.beginPath();

    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * canvas.height / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Spectrum bars (overlayed)
    const freqData = new Uint8Array(bufferLength);
    analyzer.getByteFrequencyData(freqData);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barX = 0;
    for(let i = 0; i < bufferLength; i++) {
      const barHeight = freqData[i] / 2;
      ctx.fillRect(barX, canvas.height - barHeight, barWidth, barHeight);
      barX += barWidth + 1;
    }

    // Fix: Only reschedule the next frame if the audio is currently playing to prevent infinite loops when paused
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(draw);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(draw);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      // Still draw once to clear or show static
      draw();
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, analyzer]);

  return (
    <canvas 
      ref={canvasRef} 
      width={1200} 
      height={400} 
      className="w-full h-full block"
    />
  );
};

export default Visualizer;
