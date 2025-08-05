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
	console.log(L)
	const sRet: Float32Array[] = [];

    const maxTmpSize = L;
    const tmp = new Float32Array(maxTmpSize); // Pre-allocate 'tmp' once for potential reuse

    switch(dir) {
        case 'H':
            for (let m = 0; m < signal.length; m++) {
                sRet[m] = new Float32Array(signal[m].length);
                for (let k = 0; k < signal[m].length; k++) {
                    let tmpIdx = 0; // Use an index for filling 'tmp'
                    for (let mAlt = m - ((L - 1) / 2); mAlt <= m + ((L - 1) / 2); mAlt++) {
                        // Ensure 'tmp' doesn't overflow if L is larger than expected maxTmpSize, though it shouldn't be.
                        if (tmpIdx < maxTmpSize) {
                            if (mAlt >= 0 && mAlt < signal.length) {
                                tmp[tmpIdx] = signal[mAlt][k];
                            } else {
                                tmp[tmpIdx] = 0; // Pad with zero if out of bounds
                            }
                            tmpIdx++;
                        }
                    }
                    // Sort only the relevant part of 'tmp' if tmpIdx < maxTmpSize (unlikely if L is consistent)
                    const subArrayToSort = tmp.slice(0, tmpIdx);
                    subArrayToSort.sort((a, b) => a - b); // Use a-b for numeric sort

                    if (L % 2 === 0) { // Using strict equality
                        sRet[m][k] = (subArrayToSort[(L / 2) - 1] + subArrayToSort[L / 2]) / 2; // Fixed index for even L
                    } else {
                        sRet[m][k] = subArrayToSort[Math.floor(L / 2)]; // Simplified index for odd L
                    }
                }
            }
            break;
        case 'V':
            for (let m = 0; m < signal.length; m++) {
                sRet[m] = new Float32Array(signal[m].length);
                for (let k = 0; k < signal[m].length; k++) {
                    let tmpIdx = 0;
                    for (let kAlt = k - ((L - 1) / 2); kAlt <= k + ((L - 1) / 2); kAlt++) {
                        if (tmpIdx < maxTmpSize) {
                            if (kAlt >= 0 && kAlt < signal[m].length) {
                                tmp[tmpIdx] = signal[m][kAlt];
                            } else {
                                tmp[tmpIdx] = 0; // Pad with zero if out of bounds
                            }
                            tmpIdx++;
                        }
                    }
                    const subArrayToSort = tmp.slice(0, tmpIdx);
                    subArrayToSort.sort((a, b) => a - b);

                    if (L % 2 === 0) {
                        sRet[m][k] = (subArrayToSort[(L / 2) - 1] + subArrayToSort[L / 2]) / 2;
                    } else {
                        sRet[m][k] = subArrayToSort[Math.floor(L / 2)];
                    }
                }
            }
            break;
        default:
            break;
    }
    return sRet;
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
	const L_p = make_integer_odd(convert_l_hertz_to_bins(6000, ctx.sampleRate || 44100, 256, 64));
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

export { getVowelImpl, setAudioComponents, initialize }