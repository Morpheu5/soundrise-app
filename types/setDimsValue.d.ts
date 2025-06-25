// app/audio/setDimsValue.d.ts
declare module "app/audio/setDimsValue" {
  /** Minimum volume accepted by `setRad` ( 2 ). */
  export const minVol: number;
  /** Maximum volume accepted by `setRad` ( 100 ). */
  export const maxVol: number;

  /** Minimum pitch accepted by `setPosPitch` ( 150 ). */
  export const minPitch: number;
  /** Maximum pitch accepted by `setPosPitch` ( 500 ). */
  export const maxPitch: number;

  /** Minimum radius returned by `setRad` ( 25 ). */
  export const minRad: number;

  /** View-port height (defaults to 1000 px in non-DOM environments). */
  export const height: number;
  /** View-port width (defaults to 1000 px in non-DOM environments). */
  export const width: number;

  /**
   * Scale a volume value to a circle radius, clamped to
   * the [`minRad`, `maxRad`] range.
   *
   * @param volume – A number typically between `minVol` and `maxVol`.
   * @returns Integer radius in pixels.
   */
  export function setRad(volume: number): number;

  /**
   * Map a pitch value to a Y-axis coordinate, clamped to the
   * internally computed `lowest_pitch` ⇄ `highest_pitch` range.
   *
   * @param pitch – A number typically between `minPitch` and `maxPitch`.
   * @returns Integer Y position in pixels.
   */
  export function setPosPitch(pitch: number): number;
}
