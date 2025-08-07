// src/vowel-detector-types.ts
import type { VowelResult } from "../soundrise-types";

export interface VowelDetector {
  getVowelImpl(s: Float32Array, sampleRate: number): VowelResult[];
  setAudioComponents?(c: AudioContext, a: AnalyserNode): void;
  initialize?(): void;
}
