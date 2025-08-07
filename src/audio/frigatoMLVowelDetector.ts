// The code in this file is based on the Master's thesis of Francesco Frigato
// https://thesis.unipd.it/handle/20.500.12608/83031
// This implementation is limited to the model using MFCC and LPCC with
// HPSS pre-processing because we already know it is the one with the best
// accuracy of those proposed in the thesis

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Complex, Nullable, VowelResult } from "../soundrise-types";
import Meyda from "meyda";
import { NeuralNetwork } from "brain.js";
import model from "../assets/netDataHpssLpccMfcc.json";
import { isDefined } from "../miscTools";
import type { VowelDetector } from "./VowelDetector";

let ctx: Nullable<AudioContext>
let analyser: Nullable<AnalyserNode>

let network: any

function setAudioComponents(c: AudioContext, a: AnalyserNode) {
    ctx = c
    analyser = a
}

function initialize() {
    network = new NeuralNetwork()
    network.fromJSON(model)
}

function applyMask(x: Complex[][], mask: Float32Array[]): Complex[][] {
    const m_x: Complex[][] = [];
    for(let m = 0 ; m < x.length; m++) {
        m_x[m] = new Array(x[m].length); // Pre-allocate inner array
        for(let k = 0; k < x[m].length; k++) {
            m_x[m][k] = {
                real : x[m][k].real * mask[m][k],
                imaginary : x[m][k].imaginary * mask[m][k]
            };
        }
    }
    return m_x;
}

function createBinMask(y1: Float32Array[], y2: Float32Array[], mode: 'H'|'P'): Float32Array[] {
    const mask: Float32Array[] = [];
    switch(mode) {
        case 'H':
        for (let m = 0; m < y1.length; m++) {
            mask[m] = new Float32Array(y1[m].length);
            for (let k = 0; k < y1[m].length; k++) 
                if (y1[m][k] >= y2[m][k])
                    mask[m][k] = 1;
            else
                mask[m][k] = 0;
        }
        break;
        case 'P':
        for (let m = 0; m < y1.length; m++) {
            mask[m] = new Float32Array(y1[m].length);
            for (let k = 0; k < y1[m].length; k++) 
                if (y1[m][k] < y2[m][k])
                    mask[m][k] = 1;
            else
                mask[m][k] = 0;
        }
        
        break;
        default:
        break;
    }
    return mask;
}

function median_filter(signal: Float32Array[], L: number, dir: 'H'|'V'): Float32Array[] {
    const rows = signal.length;
    if (rows === 0) return [];
    const cols = signal[0].length;
    
    const out: Float32Array[] = new Array(rows);
    for (let r = 0; r < rows; r++) out[r] = new Float32Array(cols);
    
    // Reusable window buffer (filled fresh each pixel)
    const win = new Float32Array(L);
    
    // ---- quickselect helpers (in-place on typed arrays) ----
    // Partition around pivot, returns final pivot index
    function partition(a: Float32Array, left: number, right: number, pivotIndex: number): number {
        const pivotValue = a[pivotIndex];
        // move pivot to end
        [a[pivotIndex], a[right]] = [a[right], a[pivotIndex]];
        let storeIndex = left;
        for (let i = left; i < right; i++) {
            if (a[i] < pivotValue) {
                [a[i], a[storeIndex]] = [a[storeIndex], a[i]];
                storeIndex++;
            }
        }
        // move pivot to its final place
        [a[storeIndex], a[right]] = [a[right], a[storeIndex]];
        return storeIndex;
    }
    
    // Select k-th (0-based) smallest element
    function quickselect(a: Float32Array, k: number, left = 0, right = a.length - 1): number {
        while (true) {
            if (left === right) return a[left];
            // median-of-three for a decent pivot
            const mid = (left + right) >>> 1;
            let pivotIndex = left;
            // order (left, mid, right) and pick mid as pivot
            if (a[mid] < a[left]) [a[left], a[mid]] = [a[mid], a[left]];
            if (a[right] < a[left]) [a[left], a[right]] = [a[right], a[left]];
            if (a[right] < a[mid]) [a[mid], a[right]] = [a[right], a[mid]];
            pivotIndex = mid;
            
            pivotIndex = partition(a, left, right, pivotIndex);
            if (k === pivotIndex) return a[k];
            if (k < pivotIndex) {
                right = pivotIndex - 1;
            } else {
                left = pivotIndex + 1;
            }
        }
    }
    
    // Fill a window of length L centered on (m,k) along chosen direction
    function fillWindowH(m: number, k: number) {
        // integer start so that we take exactly L samples
        const start = Math.ceil(m - (L - 1) / 2);
        for (let i = 0; i < L; i++) {
            const mm = start + i;
            win[i] = (mm >= 0 && mm < rows) ? signal[mm][k] : 0;
        }
    }
    function fillWindowV(m: number, k: number) {
        const start = Math.ceil(k - (L - 1) / 2);
        for (let i = 0; i < L; i++) {
            const kk = start + i;
            win[i] = (kk >= 0 && kk < cols) ? signal[m][kk] : 0;
        }
    }
    
    const even = (L & 1) === 0;
    const kMedHi = L >>> 1;                 // for odd: this is the middle index; for even: upper median index
    const kMedLo = even ? (kMedHi - 1) : kMedHi;
    
    if (dir === 'H') {
        for (let m = 0; m < rows; m++) {
            const rowOut = out[m];
            for (let k = 0; k < cols; k++) {
                fillWindowH(m, k);
                // We’ll grab lower median first (this mutates win)
                const lo = quickselect(win, kMedLo);
                let med = lo;
                if (even) {
                    // Need upper median as well: quickselect again on the mutated array
                    const hi = quickselect(win, kMedHi);
                    med = (lo + hi) * 0.5;
                }
                rowOut[k] = med;
            }
        }
    } else {
        for (let m = 0; m < rows; m++) {
            const rowOut = out[m];
            for (let k = 0; k < cols; k++) {
                fillWindowV(m, k);
                const lo = quickselect(win, kMedLo);
                let med = lo;
                if (even) {
                    const hi = quickselect(win, kMedHi);
                    med = (lo + hi) * 0.5;
                }
                rowOut[k] = med;
            }
        }
    }
    
    return out;
}

function convert_l_sec_to_frames(L_h_sec: number, Fs: number, _N: number, H: number): number {
    return Math.ceil(L_h_sec * Fs / H);
}

function convert_l_hertz_to_bins(L_p_Hz: number, Fs: number, N: number, _H: number): number {
    return Math.ceil(L_p_Hz * N / Fs);
}

function make_integer_odd(n: number): number {
    if (n % 2 == 0)
        n += 1
    return n
}

function computePowerSpec(spec: Complex[][]): Float32Array[] {
    const pow = [];
    for (let i = 0; i < spec.length; i++) {
        pow[i] = new Float32Array(spec[i].length);
        for (let j = 0; j < spec[i].length; j++)
            pow[i][j] = Math.pow(spec[i][j].real, 2) + Math.pow(spec[i][j].imaginary, 2);
    }
    return pow;
}

function fft(x: Float32Array, N: number, K: number) {
    if (N !== K) throw new Error("FFT requires K === N");
    if ((N & (N - 1)) !== 0) throw new Error("N must be a power of 2");
    
    const X: Complex[] = Array(N);
    const input: Complex[] = Array.from({ length: N }, (_, i) => ({
        real: x[i],
        imaginary: 0
    }));
    
    function fftRecursive(buffer: Complex[]): Complex[] {
        const n = buffer.length;
        if (n === 1) return [buffer[0]];
        
        const even = fftRecursive(buffer.filter((_, i) => i % 2 === 0));
        const odd = fftRecursive(buffer.filter((_, i) => i % 2 !== 0));
        
        const results: Complex[] = Array(n);
        for (let k = 0; k < n / 2; k++) {
            const angle = -2 * Math.PI * k / n;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const o = odd[k];
            const twiddle: Complex = {
                real: cos * o.real - sin * o.imaginary,
                imaginary: cos * o.imaginary + sin * o.real
            };
            results[k] = {
                real: even[k].real + twiddle.real,
                imaginary: even[k].imaginary + twiddle.imaginary
            };
            results[k + n / 2] = {
                real: even[k].real - twiddle.real,
                imaginary: even[k].imaginary - twiddle.imaginary
            };
        }
        return results;
    }
    
    const transformed = fftRecursive(input);
    for (let i = 0; i < N; i++) {
        X[i] = transformed[i];
    }
    
    return X;
}

function ifft(X: Complex[], N: number, K: number): Float32Array {
    if (N !== K) throw new Error("iFFT requires K === N");
    if ((N & (N - 1)) !== 0) throw new Error("N must be a power of 2");
    
    // Conjugate the input
    const conjugated = X.map(({ real, imaginary }) => ({
        real,
        imaginary: -imaginary
    }));
    
    // Recursive FFT function
    function fftRecursive(input: Complex[]): Complex[] {
        const n = input.length;
        if (n === 1) return [input[0]];
        
        const even = fftRecursive(input.filter((_, i) => i % 2 === 0));
        const odd = fftRecursive(input.filter((_, i) => i % 2 !== 0));
        
        const result: Complex[] = Array(n);
        for (let k = 0; k < n / 2; k++) {
            const angle = -2 * Math.PI * k / n;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const o = odd[k];
            const twiddle: Complex = {
                real: cos * o.real - sin * o.imaginary,
                imaginary: cos * o.imaginary + sin * o.real
            };
            result[k] = {
                real: even[k].real + twiddle.real,
                imaginary: even[k].imaginary + twiddle.imaginary
            };
            result[k + n / 2] = {
                real: even[k].real - twiddle.real,
                imaginary: even[k].imaginary - twiddle.imaginary
            };
        }
        return result;
    }
    
    // Run FFT on conjugated input
    const transformed = fftRecursive(conjugated);
    
    // Conjugate again and divide by N to get the real signal
    const signal = new Float32Array(N);
    for (let n = 0; n < N; n++) {
        signal[n] = transformed[n].real / N;
    }
    
    return signal;
}

function stft(x: Float32Array, w: Float32Array, H: number, M: number): Complex[][] {
    const N = w.length;
    const K = N;
    
    const x_ret: Complex[][] = Array(M);
    
    for (let m = 0; m < M; m++) {
        const x_win = new Float32Array(N);
        const offset = m * H;
        
        for (let n = 0; n < N; n++) {
            x_win[n] = (x[offset + n] ?? 0) * w[n]; // Safer access with zero-padding
        }
        
        x_ret[m] = fft(x_win, N, K); // Using your drop-in FFT implementation
    }
    
    return x_ret;
}

function istft(X: Complex[][], w: Float32Array, H: number, M: number): Float32Array {
    const N = w.length;
    const K = N;
    const signalLength = (M - 1) * H + N;
    const signal = new Float32Array(signalLength);
    
    // Overlap-add each inverse FFT frame
    for (let m = 0; m < M; m++) {
        const frame = ifft(X[m], N, K); // Uses drop-in FFT-based iDFT
        const offset = m * H;
        
        for (let n = 0; n < N; n++) {
            signal[offset + n] += frame[n] * w[n];
        }
    }
    
    // Normalize by accumulated windowing
    for (let n = 0; n < signalLength; n++) {
        let winSum = 0;
        for (let m = 0; m < M; m++) {
            const idx = n - m * H;
            if (idx >= 0 && idx < N) {
                winSum += w[idx] ** 2;
            }
        }
        signal[n] = winSum > 0 ? signal[n] / winSum : 0;
    }
    
    return signal;
}

function hann(N: number): Float32Array {
    const w = new Float32Array(N).fill(0);
    for (let n = 0; n < N; n++) {
        w[n] = Math.pow(Math.sin(Math.PI * n / N), 2);
    }
    return w;
}

function harmonicComponentExtraction(audioFrame: Float32Array): Float32Array {
    if (!isDefined(ctx)) return Float32Array.from([]);
    
    const w = hann(256);
    //console.log("window function:", w);
    
    const shortTimeFT = stft(audioFrame, w, 64, 13);
    //console.log("stft:", shortTimeFT);
    
    const pow_s = computePowerSpec(shortTimeFT);
    //console.log("power spectrum:", pow_s);
    
    const L_h = make_integer_odd(convert_l_sec_to_frames((10 / 1000), ctx.sampleRate || 44100, 256, 64));
    //console.log(L_h);
    const L_p = make_integer_odd(convert_l_hertz_to_bins(50000, ctx.sampleRate || 44100, 256, 64));
    // console.log(L_p);
    
    const h_med_filt = median_filter(pow_s, L_h, 'H');
    //console.log("horizontal median filter:", h_med_filt);
    const v_med_filt = median_filter(pow_s, L_p, 'V');
    //console.log("vertical median filter:", v_med_filt);
    
    const h_m = createBinMask(h_med_filt, v_med_filt, 'H');
    //console.log("horizontal bin mask:", h_m);
    
    const X_h = applyMask(shortTimeFT, h_m);
    //console.log("horizontal masaked spec:", X_h);
    
    const x_h = istft(X_h, w, 64, 13);
    //console.log("harmonic signal:", x_h);
    
    return x_h;
}

function autocorrelation(audioFrame: Float32Array, order: number): Float32Array {
    const r = new Float32Array(order + 1).fill(0);
    
    for (let m = 0; m <= order; m++) {
        for (let n = 0; n <= audioFrame.length - 1 - m; n++) {
            r[m] += audioFrame[n] * audioFrame[n + m];
        }
    }
    
    return r;
}

function levinsonDurbin(r: Float32Array, order: number): [Float32Array, number] {
    const a = [];
    const e = new Float32Array(order + 1).fill(0);
    const k = new Float32Array(order + 1).fill(0);
    
    e[0] = r[0];
    
    for (let i = 1; i <= order; i++) {
        k[i] = r[i];
        for (let j = 1; j <= i - 1; j++) {
            k[i] -= a[j][i - 1] * r[i - j];
        }
        k[i] /= e[i - 1];
        
        a[i] = new Float32Array(order + 1).fill(0);
        a[i][i] = k[i];
        
        for(let j = 1; j <= i - 1; j++) {
            a[j][i] = a[j][i - 1] - k[i] * a[i - j][i - 1];
        }
        
        e[i] = (1 - k[i] * k[i]) * e[i - 1];
    }
    
    const lpc = new Float32Array(order + 1).fill(0);
    lpc[0] = 1;
    for (let i = 1; i <= order; i++)
        lpc[i] = a[i][order];
    
    const g = Math.sqrt(e[order]);
    
    return [ lpc, g ];
}

function computeLPCCfromLPC(a: Float32Array, p: number, g: number, Q: number): Float32Array {
    const c = new Float32Array(Q).fill(0);
    
    c[0] = Math.log(g);
    
    for (let m = 1; m < Q; m++) {
        if (m <= p) {
            c[m] = a[m];
            
            for (let k = 1; k <= m - 1; k++) {
                c[m] += ( k / m ) * c[k] * a[m - k];
            }
        }
        else {
            for (let k = m - p; k <= m - 1; k++) { 
                c[m] += ( k / m ) * c[k] * a[m - k];
            }
        }
    }
    
    const w = new Float32Array(Q).fill(0);
    for (let m = 1; m < Q; m++)
        w[m] = 1 + (Q / 2) * Math.sin((Math.PI * m) / Q);
    
    const altC = new Float32Array(Q).fill(0);
    for (let m = 1; m < Q; m++)
        altC[m] = w[m] * c[m];
    altC[0] = c[0];
    
    return altC;
}

function extractLPCC(audioFrame: Float32Array, order: number, Q: number): number[] {
    const r = autocorrelation(audioFrame, order);
    //console.log("AUTOCORRELATION APPLIED");
    //console.log(r);
    
    const [ lpc, gain ] = levinsonDurbin(r, order);
    //console.log("LPC EXTRACTED");
    //console.log(lpc, gain);
    
    const lpcc = computeLPCCfromLPC(lpc, order, gain, Q);
    //console.log("LPC CONVERTED TO LPCC");
    //console.log(lpcc);
    
    return Array.from(lpcc);
}

function extractMFCC(x: Float32Array): number[] {
    if (ctx && analyser) {
        Meyda.audioContext = ctx;
        // Meyda.fftSize = analyser.fftSize;
        Meyda.bufferSize = analyser.fftSize;
        Meyda.sampleRate = ctx.sampleRate;
        Meyda.windowingFunction = "hamming";
        Meyda.numberOfMFCCCoefficients = 20;
        
        const features = Meyda.extract(['mfcc'], x);
        if (isDefined(features) && isDefined(features["mfcc"])) {
            return features["mfcc"]
        } else {
            return []
        }
    }
    return []
    //console.log(features);
}

// We already know that the model with the highest accuracy is the one combining
// MFCC and LPCC with HPSS pre-processing so we'll just use that one
function extractFeatures(audioFrame: Float32Array) {
    // const _precoeff = 0.97;
    
    const order = 19;
    const Q = order + 1;
    
    const x_h = harmonicComponentExtraction(audioFrame);
    // console.log("HARMONIC COMPONENT EXTRACTION");
    //console.log(x_h);
    
    const lpcc = extractLPCC(x_h, order, Q);
    // console.log("LPCC COEFFICIENTS EXTRACTED");
    //console.log(lpcc);
    
    const mfcc = extractMFCC(x_h);
    // console.log("MFCC COEFFICIENTS EXTRACTED");
    //console.log(mfcc);
    
    return [...lpcc, ...mfcc];
}

function getVowelImpl(audioFrame: Float32Array, _samplerate: Nullable<number> = null): VowelResult[] {
    const sampleFeatures = extractFeatures(audioFrame);
    const results: Record<string, number> = network.run(sampleFeatures);
    let vowelResults: VowelResult[] = []
    if (Object.values(results).filter(e => isNaN(e)).length === 0) {
        vowelResults = [
            { vowel: "I", score: results["I"], percentage: "0.00"},
            { vowel: "E", score: results["E"], percentage: "0.00"},
            { vowel: "A", score: results["A"], percentage: "0.00"},
            { vowel: "O", score: results["O"], percentage: "0.00"},
            { vowel: "U", score: results["U"], percentage: "0.00"},
        ]
    } else {
        vowelResults = [
            { vowel: "I", score: 0, percentage: "0.00"},
            { vowel: "E", score: 0, percentage: "0.00"},
            { vowel: "A", score: 0, percentage: "0.00"},
            { vowel: "O", score: 0, percentage: "0.00"},
            { vowel: "U", score: 0, percentage: "0.00"},
        ]
    }
    const totalScore = vowelResults.reduce((sum, item) => sum + (item.score ?? 1.0), 0) || 0.000001;
    vowelResults.forEach((item) => {
        item.percentage = (((item.score ?? 0) / totalScore) * 100).toFixed(1); // FIXME I'm pretty sure we can do without this being a string but hey
    });
    return vowelResults
}

const mlVowelDetector: VowelDetector = {
    getVowelImpl, setAudioComponents, initialize
}

export default mlVowelDetector;