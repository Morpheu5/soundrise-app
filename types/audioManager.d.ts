// types/audioManager.d.ts
declare module "app/audio/audioManager" {
  export interface VowelResult {
    vowel: string;
    score: number;
    percentage: string;
  }
  export function getVowelImpl(audioBuffer: Float32Array, sampleRate: number): VowelResult[];
}
