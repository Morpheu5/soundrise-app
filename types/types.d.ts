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