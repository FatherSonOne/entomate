/**
 * useMicLevel — writes the microphone's loudness into voiceSignal while `active`.
 *
 * The Web Speech API the panel already uses for transcription never exposes audio
 * samples, so a second, parallel capture is the only way to make the orb and the
 * matrix move with the user's voice. It reuses the permission the recognizer
 * already asked for (same origin, same device), so there is no second prompt.
 *
 * Level is RMS over the time-domain buffer, asymmetrically smoothed: quick to rise
 * so the first syllable registers, slow to fall so the shape reads as speech
 * rather than flicker. Everything is torn down the moment `active` drops — tracks
 * stopped, context closed, level zeroed — so the mic indicator in the browser tab
 * goes dark exactly when the panel says it stopped listening.
 */
import { useEffect } from 'react';
import { setVoiceLevel } from './voiceSignal';

export function useMicLevel(active: boolean): void {
  useEffect(() => {
    if (!active) {
      setVoiceLevel(0);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    const AudioCtx: typeof AudioContext | undefined =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(s);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        let smoothed = 0;

        const tick = () => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i]! - 128) / 128; // i < buf.length
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          // Speech at a normal distance sits around 0.05–0.25 RMS; ×4 maps that to
          // a useful 0.2–1.0 without a loud room pinning it at the ceiling.
          const target = Math.min(1, rms * 4);
          smoothed += (target - smoothed) * (target > smoothed ? 0.45 : 0.1);
          setVoiceLevel(smoothed);
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {
        /* Permission denied or no device: the recognizer will report it; the orb
           simply stays in its listening tint without amplitude. */
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
      setVoiceLevel(0);
    };
  }, [active]);
}
