// import { VowelResult } from "@/app/audio/audioManager";

export type Nullable<T> = T | null | undefined

export type SunProps = {
  svgColor: string,
  rad: number,
  yCoordinate: number,
  heightSpaceSun: string,
}

export type Complex = {
  real: number;
  imag: number;
}

export type Formant = {
  freq: number;
  band: number;
}

export type PlayParams = {
  svgColor: string ;
  pitch: string;
  volume: string;
  note: string;
  vowel: string;
  vowelScoresString: string;
  sunListen: boolean;
  rad: number;
  yCoord: number;
}