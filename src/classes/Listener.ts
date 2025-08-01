/* eslint-disable @typescript-eslint/no-explicit-any */
import * as formantVowelDetector from "../audio/formantVowelDetector";
import * as frigatoMLVowelDetector from "../audio/frigatoMLVowelDetector";
import { setRad, setPosPitch, minVol, maxVol, minPitch, maxPitch, minRad, height } from "../audio/setDimsValue";
import { isDefined } from "../miscTools";
import type { Nullable, PlayParams, VowelResult } from "../soundrise-types";


export default class Listener {
  audioContext: Nullable<AudioContext>;
  analyzer: Nullable<AnalyserNode>;
  mediaStreamSource: Nullable<MediaStreamAudioSourceNode | AudioBufferSourceNode>;
  rafID: Nullable<number>;
  buflen = 2048;
  buf = new Float32Array(this.buflen);
  buffer_pitch: Array<number> = [];
  acStore: Float32Array | null = null;          // recycled buffer for the autocorrelation function
  buffer_vol: Array<number> = [];
  buffer_vocal: Array<string> = [];
  buffer_percentage: Array<VowelResult> = [];
  count_sil = 0;
  noteStrings = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];
  // vowelColorMap: Record<string, string> = {
  //   "I": "blue",
  //   "É": "#4CC94C",
  //   "È": "#4CC94C",
  //   "A": "red",
  //   "Ó": "orange",
  //   "Ò": "orange",
  //   "U": "#C0C0C0",
  // }
  vowelColorMap: Record<string, string> = {
    "I": "blue",
    "E": "#4CC94C",
    "A": "red",
    "O": "orange",
    "U": "#C0C0C0",
  }
  previousBuffers: Array<number> = [];
  playParams!: PlayParams;

  private static instance: Nullable<Listener> = null;

  private detectors = {
    formant: formantVowelDetector,
    ml: frigatoMLVowelDetector,
  }

  static getInstance(): Listener {
    if (!isDefined(Listener.instance)) {
      Listener.instance = new Listener();
    }
    return Listener.instance!;
  }

  constructor() {
    if (!isDefined(window)) {
      return; // don't throw new Error("Listener can only be used in a browser environment.") or things go wrong
    }

    this.playParams = {
      pitch: "...",
      volume: "...",
      note: "...",
      vowel: "...",
      vowelScoresString: "I: 0%\nE: 0%\nA: 0%\nO: 0%\nU: 0%",
      sunListen: false,
      rad: minRad,
      yCoord: (height - Math.round((height * 30) / 100)) / 2,
      svgColor: "yellow",
    };

    (Object.keys(this.detectors) as Array<keyof typeof this.detectors>).forEach(k => {
      // UGH...
      this.detectors[k].initialize()
    })

  }

  startListening = () => {
    const AudioCtx = window.AudioContext;
    if (!isDefined(this.audioContext)) {
      this.audioContext = new AudioCtx({
        latencyHint: "interactive", // Reduce latency for real-time interaction
        // Apparently specifying a sampling rate here and further down creates
        // an issue on some systems/browsers where nodes of different rates
        // can't be connected together -- it seems like omitting the param
        // here isn't too much of an issue but further testing is required.
        // TODO: Further testing -- AF
        // sampleRate: 44100,
      });
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          // TODO: See comment above about sampling rates -- AF
          // sampleRate: 44100,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then((stream) => {
        if (!isDefined(this.audioContext)) { return }

        if (!isDefined(this.mediaStreamSource)) {
          this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
        }

        // High-pass filter
        const highpassFilter = this.audioContext.createBiquadFilter();
        highpassFilter.type = "highpass";
        highpassFilter.frequency.value = 200;
        highpassFilter.Q.value = -3; // Q values are a bit of a mystery

        // Low-pass filter
        const lowpassFilter = this.audioContext.createBiquadFilter();
        lowpassFilter.type = "lowpass";
        lowpassFilter.frequency.value = 3000;
        lowpassFilter.Q.value = -3;

        // Band-pass filter
        const bandpassFilter = this.audioContext.createBiquadFilter();
        bandpassFilter.type = "bandpass";
        bandpassFilter.frequency.value = 1000;
        bandpassFilter.Q.value = 0.7;

        // Dynamic compressor
        const compressor = this.audioContext.createDynamicsCompressor();
        compressor.threshold.value = -50;
        compressor.knee.value = 40;
        compressor.ratio.value = 4;

        // Gain
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 1.5;

        // FFT analyzer
        this.analyzer = this.audioContext.createAnalyser();
        this.analyzer.fftSize = 1024; // Make the FFT small for performance

        // console.log(this.detectors);

        (Object.keys(this.detectors) as Array<keyof typeof this.detectors>).forEach(k => {
          // UGH...
          this.detectors[k].setAudioComponents(this.audioContext!, this.analyzer!)
        })
  
        // Plug everything up
        this.mediaStreamSource.connect(highpassFilter);
        highpassFilter.connect(lowpassFilter);
        lowpassFilter.connect(bandpassFilter);
        bandpassFilter.connect(compressor);
        compressor.connect(gainNode);
        gainNode.connect(this.analyzer);

        this._listen();
      })
      .catch((err) => {
        console.error(`${err.name}: ${err.message}`);
      });
  }

  destroyAudioPipeline = () => {
    if (this.rafID) {
      window.cancelAnimationFrame(this.rafID);
    }
    this.analyzer?.disconnect();
    this.analyzer = null;
    if (this.mediaStreamSource instanceof MediaStreamAudioSourceNode) {
      const tracks = this.mediaStreamSource?.mediaStream.getAudioTracks()
      if (tracks) {
        for (const track of tracks) {
          track.stop();
        }
      }
    }
    this.mediaStreamSource?.disconnect();
    this.mediaStreamSource = null;
    return this.audioContext?.close();
  }

  noteFromPitch = (frequency: number) => {
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    return Math.round(noteNum) + 69;
  }

  // Optimized version of the ACF2+ algorithm from
  // https://github.com/cwilso/PitchDetect/blob/main/js/pitchdetect.js
  detectPitchACF2Fast = (buffer: Float32Array, sampleRate: number): number => {
    const n = buffer.length;

    // Cheap RMS gate
    let rms = 0;
    for (let i = 0; i < n; ++i) {
      const s = buffer[i];
      rms += s * s;
    }
    rms = Math.sqrt(rms / n);
    if (rms < 0.01) return -1;

    // Trim leading/trailing silence
    const SILENCE = 0.2;
    let start = 0;
    while (start < n && Math.abs(buffer[start]) < SILENCE) ++start;

    let end = n - 1;
    while (end > start && Math.abs(buffer[end]) < SILENCE) --end;

    const size = end - start + 1;
    if (size < 32) return -1;

    // Autocorrelation using pooled buffer
    if (!this.acStore || this.acStore.length < size) this.acStore = new Float32Array(size);
    const ac = this.acStore;

    for (let lag = 0; lag < size; ++lag) {
      let sum = 0;
      const limit = size - lag;
      let i = 0;

      const limit4 = limit & ~3;
      while (i < limit4) {
        sum += buffer[start + i]     * buffer[start + i + lag];
        sum += buffer[start + i + 1] * buffer[start + i + 1 + lag];
        sum += buffer[start + i + 2] * buffer[start + i + 2 + lag];
        sum += buffer[start + i + 3] * buffer[start + i + 3 + lag];
        i += 4;
      }
      for (; i < limit; ++i) {
        sum += buffer[start + i] * buffer[start + i + lag];
      }
      ac[lag] = sum;
    }

    // First dip -> following peak
    let dip = 0;
    while (dip + 1 < size && ac[dip] > ac[dip + 1]) ++dip;

    let bestLag = -1;
    let best = -Infinity;
    for (let lag = dip + 1; lag < size; ++lag) {
      const v = ac[lag];
      if (v > best) {
        best = v;
        bestLag = lag;
      }
    }
    if (bestLag <= 0) return -1;

    // Parabolic interpolation
    const x0 = ac[bestLag - 1] ?? 0;
    const x1 = ac[bestLag];
    const x2 = ac[bestLag + 1] ?? 0;

    const a = (x0 + x2 - 2 * x1) * 0.5;
    const b = (x2 - x0) * 0.5;
    const period = a ? bestLag - b / (2 * a) : bestLag;

    // Lag -> frequency
    return sampleRate / period;
  }
  
  getStableVolume = (audioBuffer: Float32Array) => {
    const sumSquares = audioBuffer.reduce(
      (sum, amplitude) => sum + amplitude * amplitude,
      0
    );
    const rootMeanSquare = Math.sqrt(sumSquares / audioBuffer.length);

    // Add the root mean square value to the previousBuffers array
    this.previousBuffers.push(rootMeanSquare);

    // Keep a limited history of previous volume values
    // (adjust the history size as needed)
    const historySize = 10;
    if (this.previousBuffers.length > historySize) {
      this.previousBuffers.shift();
    }

    // Calculate the average of the previous volume values
    const averageVolume =
      this.previousBuffers.reduce((sum, value) => sum + value, 0) /
      this.previousBuffers.length;

    return Math.round(averageVolume * 100);
  }

  getVowel = (results: VowelResult[]): string => {
    const result = results;
    // Picks the most likely vowel
    let max_p = 0;
    let max_v = "";
    for (let i = 0; i < result.length; i++) {
      // The parseFloat is necessary because of toFixed conversion in the upstream getVowel code (TODO: Perhaps remove it?)
      const p = parseFloat(result[i].percentage ?? "0.00");
      if (p > max_p) {
        max_p = p;
        max_v = result[i].vowel;
      }
    }
    return max_v;
  }

  getValueVowels = (audioBuffer: Float32Array, sampleRate: number) => {
    return this.detectors.ml.getVowelImpl(audioBuffer, sampleRate);
  }

  arrayAvg = (array: number[]) => array.reduce((a, b) => a + b) / array.length;

  findMostRepeatedItem = (array: string[]) => {
    const count: Record<string, any> = {};
    let mostRepeatedItem = "";
    let maxCount = 0;

    for (const item of array) {
      if (Object.hasOwn(count, item)) { // This is better than checking count[item] === undefined -- don't ask me, ask Javascript...
        count[item] = 1;
      } else {
        count[item]++;
      }

      if (count[item] > maxCount) {
        maxCount = count[item];
        mostRepeatedItem = item;
      }
    }

    return mostRepeatedItem;
  }

  private _listen = () => {
    if (!this.analyzer || !this.audioContext) { return }
    
    this.analyzer.getFloatTimeDomainData(this.buf);

    const frequency = this.detectPitchACF2Fast(this.buf, this.audioContext.sampleRate);
    const volume = this.getStableVolume(this.buf);
    const valueVowels = this.getValueVowels(this.buf, this.audioContext.sampleRate);
    const vowel = this.getVowel(valueVowels);
    
    const MAX_BUF = 600;
    if (
      (frequency == -1 ||
        frequency < minPitch ||
        frequency > maxPitch) &&
      (volume < minVol || volume > maxVol)
    ) {
      this.playParams = {
        pitch: "...",
        volume: "...",
        note: "...",
        vowel: "...",
        vowelScoresString: "I: 0%\nE: 0%\nA: 0%\nO: 0%\nU: 0%",
        sunListen: false,
        rad: minRad,
        yCoord: (height - Math.round((height * 30) / 100)) / 2,
        svgColor: "yellow",
      };

      dispatchEvent(new CustomEvent("setPlayParams", { detail: this.playParams }));

      this.count_sil++;
      if (this.count_sil >= 50) {
        console.log("silence");
        this.buffer_pitch = [];
        this.buffer_vol = [];
        this.buffer_vocal = [];
        this.buffer_percentage = [];
        this.count_sil = 0;
      }
    } else {
      if (
        frequency != -1 &&
        frequency >= 100 &&
        frequency <= 600 &&
        volume > 0 &&
        volume <= 50 &&
        vowel != ""
      ) {
        if (this.buffer_pitch.length > MAX_BUF) {
          this.buffer_pitch.shift();
          this.buffer_pitch.push(frequency);
        } else {
          this.buffer_pitch.push(frequency);
        }

        if (this.buffer_vol.length > MAX_BUF) {
          this.buffer_vol.shift();
          this.buffer_vol.push(volume);
        } else {
          this.buffer_vol.push(volume);
        }

        if (this.buffer_vocal.length > MAX_BUF) {
          this.buffer_vocal.shift();
          this.buffer_vocal.push(vowel);
        } else {
          this.buffer_vocal.push(vowel);
        }

        if (this.buffer_percentage.length > MAX_BUF) {
          this.buffer_percentage.shift();
        }
        else{
          // Add the average value of the percentages to buffer_percentage
          this.buffer_percentage.push(valueVowels as any);
        }

        this.playParams.sunListen = true;

        const pitchValue = Math.round(this.arrayAvg(this.buffer_pitch));
        const yCoordValue = setPosPitch(pitchValue);
        const hz = pitchValue + "Hz";

        this.playParams.pitch = hz;
        this.playParams.yCoord = yCoordValue;

        const volValue = Math.round(this.arrayAvg(this.buffer_vol));
        this.playParams.volume = `${volValue}`;
        const radValue = setRad(volValue);
        this.playParams.rad = radValue;

        const n = this.noteFromPitch(pitchValue);
        this.playParams.note = this.noteStrings[n % 12];

        const resultingVowel = this.findMostRepeatedItem(this.buffer_vocal);
        this.playParams.svgColor = this.vowelColorMap[resultingVowel] || this.playParams.svgColor;

        this.playParams.vowel = resultingVowel;
        const vowelScores = this.computeVowelScores()
        this.playParams.vowelScoresString = this.makeVowelScoresString(vowelScores)
        // console.log(vowelScores)
      }
    }

    this.rafID = window.requestAnimationFrame(this._listen);

    dispatchEvent(new CustomEvent("setPlayParams", { detail: this.playParams }));
  };

  computeVowelScores = () => {
    const vowelSums: Record<string, number> = {}; // To sum up the percentages of each vowel
    const vowelCounts: Record<string, number> = {}; // To count the occurrences of each vowel
  
    this.buffer_percentage.forEach((valueVowels: any) => {
      valueVowels.forEach((item: any) => {
        const { vowel, percentage } = item;
        if (!vowelSums[vowel]) {
          vowelSums[vowel] = 0;
          vowelCounts[vowel] = 0;
        }
        vowelSums[vowel] += parseFloat(percentage);
        vowelCounts[vowel] += 1;
      });
    });

    const a: { [index:string]: number } = {}
    Object.keys(vowelSums).forEach(vowel => {
      const p = vowelSums[vowel] / vowelCounts[vowel]
      a[vowel] = p
    })
    return a
  }

  makeVowelScoresString = (scores: {[index: string]: number}) => {
    const averagedVowels = Object.keys(scores).map((vowel) => {
      return `${vowel}: ${scores[vowel].toFixed(0)}%`;
    });
      return averagedVowels.join("\n");
  }

  stopListening = () => {
    this.buffer_pitch = [];
    this.buffer_vol = [];
    this.buffer_vocal = [];
    this.count_sil = 0;

    this.playParams.sunListen = false;
    this.playParams.rad = minRad;
    this.playParams.svgColor = "yellow";
    this.playParams.yCoord = (height - Math.round((height * 30) / 100)) / 2
    this.playParams.pitch = "--";
    this.playParams.volume = "--";
    this.playParams.note = "--";
    this.playParams.vowel = "--"
    this.playParams.vowelScoresString = "I: 0%\nE: 0%\nA: 0%\nO: 0%\nU: 0%";

    dispatchEvent(new CustomEvent("setPlayParams", { detail: this.playParams }));
    
    this.destroyAudioPipeline()?.then(() => {
      this.audioContext = null;
      })
      .catch((err) => {
        console.error("Error closing the microphone: ", err);
      }
    );
  };
}
