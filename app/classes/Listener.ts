import { getVowelImpl, VowelResult } from "@/app/audio/audioManager";
import {
  setRad,
  setPosPitch,
  minVol,
  maxVol,
  minPitch,
  maxPitch,
  minRad,
  height,
} from "@/app/audio/setDimsValue";

export default class Listener {
  audioContext: Nullable<AudioContext>;
  analyzer: Nullable<AnalyserNode>;
  mediaStreamSource: Nullable<MediaStreamAudioSourceNode>;
  rafID: Nullable<number>;
  buflen = 2048;
  buf = new Float32Array(this.buflen);
  buffer_pitch: Array<number> = [];
  buffer_vol: Array<number> = [];
  buffer_vocal: Array<string> = [];
  buffer_percentage: Array<VowelResult> = [];
  count_sil = 0;
  noteStrings = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];

  previousBuffers: Array<number> = [];

  private static instance: Nullable<Listener> = null;

  static getInstance(): Listener {
    if (Listener.instance === null) {
      Listener.instance = new Listener();
    }
    return Listener.instance!;
  }

  constructor() {
    if (typeof window === "undefined") {
      return; // don't throw new Error("Listener can only be used in a browser environment.") or things go wrong
    }
  }

  startListening = () => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = null;
    this.audioContext = new AudioCtx({
      latencyHint: "interactive", // Reduce latency for real-time interaction
      // Apparently specifying a sampling rate here and further down creates
      // an issue on some systems/browsers where nodes of different rates
      // can't be connected together -- it seems like omitting the param
      // here isn't too much of an issue but further testing is required.
      // TODO: Further testing -- AF
      // sampleRate: 44100,
    });

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
        if (!this.audioContext) { return }
        
        this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);

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
debugger;
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
    const tracks = this.mediaStreamSource?.mediaStream.getAudioTracks()
    if (tracks) {
      for (const track of tracks) {
        track.stop();
      }
    }
    this.mediaStreamSource?.disconnect();
    this.mediaStreamSource = null;
    return this.audioContext?.close();
  }

  noteFromPitch = (frequency: number) => {
    let noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    return Math.round(noteNum) + 69;
  }

  // Implements the ACF2+ algorithm
  // Source: https://github.com/cwilso/PitchDetect/blob/main/js/pitchdetect.js (MIT License)
  // TODO Take this out and reference the original code properly
  setFrequency = (audioBuffer: Float32Array, sampleRate: number) => {
    // Calculate the RMS (root‑mean‑square) to check signal strength
    let bufferSize = audioBuffer.length;
    let rootMeanSquare = 0;

    for (let i = 0; i < bufferSize; i++) {
      let sample = audioBuffer[i];
      rootMeanSquare += sample * sample;
    }
    rootMeanSquare = Math.sqrt(rootMeanSquare / bufferSize);

    // Abort early if the signal is too weak
    if (rootMeanSquare < 0.01) {
      return -1;
    }

    // Trim leading and trailing silence below the threshold
    let startIndex = 0,
        endIndex = bufferSize - 1,
        threshold = 0.2;

    for (let i = 0; i < bufferSize / 2; i++) {
      if (Math.abs(audioBuffer[i]) < threshold) {
        startIndex = i;
        break;
      }
    }
    for (let i = 1; i < bufferSize / 2; i++) {
      if (Math.abs(audioBuffer[bufferSize - i]) < threshold) {
        endIndex = bufferSize - i;
        break;
      }
    }

    audioBuffer = audioBuffer.slice(startIndex, endIndex);
    bufferSize = audioBuffer.length;

    // Build the autocorrelation array
    let autoCorrelation = new Array(bufferSize).fill(0);
    for (let i = 0; i < bufferSize; i++) {
      for (let j = 0; j < bufferSize - i; j++) {
        autoCorrelation[i] += audioBuffer[j] * audioBuffer[j + i];
      }
    }

    // Find the first dip in the autocorrelation
    let dipIndex = 0;
    while (autoCorrelation[dipIndex] > autoCorrelation[dipIndex + 1]) {
      dipIndex++;
    }

    // Find the peak following the dip
    let peakValue = -1,
        peakIndex = -1;
    for (let i = dipIndex; i < bufferSize; i++) {
      if (autoCorrelation[i] > peakValue) {
        peakValue = autoCorrelation[i];
        peakIndex = i;
      }
    }
    let fundamentalPeriod = peakIndex;

    // Perform parabolic interpolation for better period accuracy
    let correlationLeft = autoCorrelation[fundamentalPeriod - 1],
        correlationCenter = autoCorrelation[fundamentalPeriod],
        correlationRight = autoCorrelation[fundamentalPeriod + 1];
    let quadraticCoeffA = (correlationLeft + correlationRight - 2 * correlationCenter) / 2;
    let quadraticCoeffB = (correlationRight - correlationLeft) / 2;
    if (quadraticCoeffA) {
      fundamentalPeriod = fundamentalPeriod - quadraticCoeffB / (2 * quadraticCoeffA);
    }

    // Convert period to frequency (Hz)
    return sampleRate / fundamentalPeriod;
  }
  // Define a buffer to store previous audio buffer data
  
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

  getVowel = (audioBuffer: Float32Array, sampleRate: number): string => {
    let result = getVowelImpl(audioBuffer, sampleRate);
    // Picks the most likely vowel
    let max_p = 0;
    let max_v = "";
    for (let i = 0; i < result.length; i++) {
      // The parseFloat is necessary because of toFixed conversion in the upstream getVowel code (TODO: Perhaps remove it?)
      let p = parseFloat(result[i].percentage ?? "0.00");
      if (p > max_p) {
        max_p = p;
        max_v = result[i].vowel;
      }
    }
    return max_v;
  }

  getValueVowels = (audioBuffer: Float32Array, sampleRate: number) => {
    return getVowelImpl(audioBuffer, sampleRate);
  }

  ArrayAvg = (myArray: number[]) => {
    let i = 0,
      summ = 0,
      ArrayLen = myArray.length;
    while (i < ArrayLen) {
      summ = summ + myArray[i++];
    }
    return summ / ArrayLen;
  }

  findMostRepeatedItem = (array: any[]) => {
    let count: Record<string, any> = {};
    let mostRepeatedItem;
    let maxCount = 0;

    for (const item of array) {
      if (count[item] === undefined) {
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

  selectColor = (vowel: string) => {
    if (vowel === "I") {
      dispatchEvent(new CustomEvent("setSvgColor", { detail: "blue" }));
    } else if (vowel === "É") {
      dispatchEvent(new CustomEvent("setSvgColor", { detail: "#4CC94C" }));
    } else if (vowel === "È") {
      dispatchEvent(new CustomEvent("setSvgColor", { detail: "#4CC94C" }));
    } else if (vowel === "A") {
      dispatchEvent(new CustomEvent("setSvgColor", { detail: "red" }));
    } else if (vowel === "Ò") {
      dispatchEvent(new CustomEvent("setSvgColor", { detail: "orange" }));
    } else if (vowel === "Ó") {
      dispatchEvent(new CustomEvent("setSvgColor", { detail: "orange" }));
    } else if (vowel === "U") {
      dispatchEvent(new CustomEvent("setSvgColor", { detail: "#C0C0C0" }));
    }
  };

  private _listen = () => {
    if (!this.analyzer || !this.audioContext) { return }
    
    this.analyzer.getFloatTimeDomainData(this.buf);

    const frequency = this.setFrequency(this.buf, this.audioContext.sampleRate);
    const volume = this.getStableVolume(this.buf);
    const vowel = this.getVowel(this.buf, this.audioContext.sampleRate);
    const valueVowels = this.getValueVowels(this.buf, this.audioContext.sampleRate);
    
    let MAX_BUF = 600;
    if (
      (frequency == -1 ||
        frequency < minPitch ||
        frequency > maxPitch) &&
      (volume < minVol || volume > maxVol)
    ) {
      dispatchEvent(new CustomEvent("setPitch", { detail: "..." }));
      dispatchEvent(new CustomEvent("setVolume", { detail: "..." }));
      dispatchEvent(new CustomEvent("setNote", { detail: "..." }));
      dispatchEvent(new CustomEvent("setVowel", { detail: "..." })); 
      dispatchEvent(new CustomEvent("setValueVowels", { detail: "I: 0%\nÉ: 0%\nÈ: 0%\nA: 0%\nÒ: 0%\nÓ: 0%\nU: 0%" }));
      dispatchEvent(new CustomEvent("setSunListen", { detail: false }));
      dispatchEvent(new CustomEvent("setRad", { detail: minRad }));
      dispatchEvent(new CustomEvent("setSvgColor", { detail: "yellow" }));
      dispatchEvent(new CustomEvent("setYCoord", { detail: (
        (height -
          Math.round((height * 30) / 100)) /
          2
      ) }));
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

        if (vowel != "") { // TODO Unnecessary test?
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
            // Aggiungi il valore medio dei percentage al buffer_percentage
            this.buffer_percentage.push(valueVowels as any);
          }
        } else {
          // v == 0
          if (this.buffer_vocal.length > MAX_BUF) {
            this.buffer_vocal.shift();
            this.buffer_vocal.push(this.findMostRepeatedItem(this.buffer_vocal));
          } else {
            this.buffer_vocal.push(this.findMostRepeatedItem(this.buffer_vocal));
          }

          if (this.buffer_percentage.length > MAX_BUF) {
            this.buffer_percentage.shift();
          } else{
            // Aggiungi il valore medio dei percentage al buffer_percentage
            this.buffer_percentage.push(valueVowels as any);
          }
        }

        dispatchEvent(new CustomEvent("setSunListen", { detail: true }));

        const pitchValue = Math.round(this.ArrayAvg(this.buffer_pitch));
        const yCoordValue = setPosPitch(pitchValue);
        const hz = pitchValue + "Hz";
        dispatchEvent(new CustomEvent("setPitch", { detail: hz }));
        dispatchEvent(new CustomEvent("setYCoord", { detail: yCoordValue }));

        const volValue = Math.round(this.ArrayAvg(this.buffer_vol));
        dispatchEvent(new CustomEvent("setVolume", { detail: volValue }));
        const radValue = setRad(volValue);
        dispatchEvent(new CustomEvent("setRad", { detail: radValue }));

        const n = this.noteFromPitch(pitchValue);
        dispatchEvent(new CustomEvent("setNote", { detail: this.noteStrings[n % 12] }));

        const vocalValue = this.findMostRepeatedItem(this.buffer_vocal);
        this.selectColor(vocalValue);
        dispatchEvent(new CustomEvent("setVowel", { detail: vocalValue }));

        dispatchEvent(new CustomEvent("setValueVowels", { detail: () => {
          const vowelSums: Record<string, number> = {}; // Per sommare le percentuali di ciascuna vocale
          const vowelCounts: Record<string, number> = {}; // Per contare le occorrenze di ciascuna vocale
        
          // Itera su ogni elemento nel buffer
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
        
          // Calcola le medie
          const averagedVowels = Object.keys(vowelSums).map((vowel) => {
            const avgPercentage = vowelSums[vowel] / vowelCounts[vowel];
            return `${vowel}: ${avgPercentage.toFixed(0)}%`; // Mostra con due decimali
          });
        
          return averagedVowels.join("\n"); // Concatena ogni vocale con la sua media
        } }));
      }
    }

    // if (!window.requestAnimationFrame)
    //   window.requestAnimationFrame = window.webkitRequestAnimationFrame;
    this.rafID = window.requestAnimationFrame(this._listen);
  };

  stopListening = () => {
    this.buffer_pitch = [];
    this.buffer_vol = [];
    this.buffer_vocal = [];
    this.count_sil = 0;
    dispatchEvent(new CustomEvent("setSunListen", { detail: false }));
    dispatchEvent(new CustomEvent("setRad", { detail: minRad }));
    dispatchEvent(new CustomEvent("setSvgColor", { detail: "yellow" }));
    dispatchEvent(new CustomEvent("setYCoord", { detail: (height - Math.round((height * 30) / 100)) / 2 }));
    
    this.destroyAudioPipeline()?.then(() => {
      this.audioContext = null;
        dispatchEvent(new CustomEvent("setPitch", { detail: "--" }));
        dispatchEvent(new CustomEvent("setVolume", { detail: "--" }));
        dispatchEvent(new CustomEvent("setNote", { detail: "--" }));
        dispatchEvent(new CustomEvent("setVowel", { detail: "--" }));
        dispatchEvent(new CustomEvent("setValueVowels", { detail: "I: 0%\nÉ: 0%\nÈ: 0%\nA: 0%\nÒ: 0%\nÓ: 0%\nU: 0%" }));
      })
      .catch((err) => {
        console.error("Error closing the microphone: ", err);
      }
    );
  };
}
