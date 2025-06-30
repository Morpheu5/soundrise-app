import { VowelResult } from "@/app/audio/audioManager";

type Nullable<T> = T | null | undefined

type SunProps = {
  svgColor: string,
  rad: number,
  yCoordinate: number,
  heightSpaceSun: string,
}

type Complex = {
  real: number;
  imag: number;
}

type Formant = {
  freq: number;
  band: number;
}

type PlayParams = {
  svgColor: string ;
  pitch: string;
  volume: string;
  note: string;
  vowel: string;
  valueVowels: string;
  sunListen: boolean;
  rad: number;
  yCoord: number;
}