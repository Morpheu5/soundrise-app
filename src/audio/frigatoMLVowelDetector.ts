// The code in this file is based on the Master's thesis of Francesco Frigato
// https://thesis.unipd.it/handle/20.500.12608/83031
// This implementation is limited to the model using MFCC and LPCC with
// HPSS pre-processing because we already know it is the one with the best
// accuracy of those proposed in the thesis

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Complex, Nullable } from "../soundrise-types";
import Meyda from "meyda";
import { NeuralNetwork } from "brain.js";
// import model from "../assets/netDataHpssLpccMfcc.json";
import { isDefined } from "../miscTools";

let ctx: Nullable<AudioContext>
let analyser: Nullable<AnalyserNode>

let network: any

function setAudioComponents(c: AudioContext, a: AnalyserNode) {
	ctx = c
	analyser = a
}

async function initialize() {
	network = new NeuralNetwork()
	const modelJSON = await fetch('/mlmodel/netDataHpssLpccMfcc.json')
	.then(response => response.json())
	.catch(error => console.log(error))
	console.log(modelJSON)
	network.fromJSON(modelJSON)
}

function applyMask(x: Complex[][], mask: Float32Array[]): Complex[][] {
	const m_x: Complex[][] = [];
	for(let m = 0 ; m < x.length; m++) {
		m_x[m] = [];
		for(let k = 0; k < x[m].length; k++) {
			m_x[m][k] = {real : 0, imaginary : 0};
			m_x[m][k].real = x[m][k].real * mask[m][k];
			m_x[m][k].imaginary = x[m][k].imaginary * mask[m][k];
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
	let tmp = []
	const sRet = [];
	switch(dir) {
		case 'H':
			for (let m = 0; m < signal.length; m++) {
			  	sRet[m] = new Float32Array(signal[m].length);
				for (let k = 0; k < signal[m].length; k++) {
				  	tmp = [];
				  	for (let mAlt = m - ((L - 1) / 2), i = 0; mAlt <= m + ((L - 1) / 2); mAlt++, i++) {
						tmp[i] = 0;
					  	if (mAlt >= 0 && mAlt < signal.length)
							tmp[i] = signal[mAlt][k];
				  	}
					tmp.sort((a, b) => a - b);

					if (L % 2 == 0)
						sRet[m][k] = (tmp[(L / 2) - 1] + tmp[((L / 2) + 1) - 1]) / 2;
				  	else
						sRet[m][k] = tmp[((L + 1) / 2) - 1];
			  }
		  }
		  break;
		case 'V':
		  	for (let m = 0; m < signal.length; m++) {
				sRet[m] = new Float32Array(signal[m].length);
		  		for (let k = 0; k < signal[m].length; k++) {
					tmp = [];
					for (let kAlt = k - ((L - 1) / 2), i = 0; kAlt <= k + ((L - 1) / 2); kAlt++, i++) {
						tmp[i] = 0;
						if (kAlt >= 0 && kAlt < signal[m].length)
							tmp[i] = signal[m][kAlt]; 
					}
					tmp.sort((a, b) => a - b);

					if (L % 2 == 0)
						sRet[m][k] = (tmp[(L / 2) - 1] + tmp[((L / 2) + 1) - 1]) / 2;
					else
						sRet[m][k] = tmp[((L + 1) / 2) - 1];
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

function dft(x: Float32Array, N: number, K: number) {
	const dft: Complex[] = [];
	for (let k = 0; k < K; k++) { 
		dft[k] = {real : 0, imaginary : 0};
		for (let n = 0; n < N; n++) {
			const angle = -(2 * Math.PI * k * n) / N;
			dft[k].real += x[n] * Math.cos(angle);
			dft[k].imaginary += x[n] * Math.sin(angle);
		}
	}
	return dft;
}

function idft(X: Complex[], N: number, K: number): Float32Array {
    const signal = new Float32Array(N);
    for (let n = 0; n < N; n++) {
        let sumReal = 0;
        // let sumImag = 0;
        for (let k = 0; k < K; k++) {
            const angle = (2 * Math.PI * k * n) / N;
            sumReal += X[k].real * Math.cos(angle) - X[k].imaginary * Math.sin(angle);
            // sumImag += X[k].real * Math.sin(angle) + X[k].imaginary * Math.cos(angle);
        }
        signal[n] = sumReal / N;
    }
    return signal;
}

function stft(x: Float32Array, w: Float32Array, H: number, M: number): Complex[][] {
	const N = w.length;
	const K = N;

	const x_win = [];
	for (let m = 0; m < M; m++) {
		x_win[m] = new Float32Array(N).fill(0);
		for (let n = 0; n < N; n++)
			x_win[m][n] = x[n + m * H] * w[n];
	}

	const x_ret = [];
	for (let m = 0; m < M; m++)
		x_ret[m] = dft(x_win[m], N, K);

	return x_ret;
}

function istft(X: Complex[][], w: Float32Array, H: number, M: number): Float32Array {
    const signalLength = (M - 1) * H + w.length;
    const signal = new Float32Array(signalLength);
	const N = w.length;
	const K = N;

    for (let i = 0; i < M; i++) {
        const frame = idft(X[i], N, K);
        for (let j = 0; j < w.length; j++) {
            signal[i * H + j] += frame[j];
        }
    }

	let win;
	for (let n = 0; n < signalLength; n++) {
		win = 0;
		for(let m = 0; m < M; m++) {
			if (n - H * m >= 0 && n - H * m < N)
				win += w[n - H * m];
		}
		if (win > 0)
			signal[n] = signal[n] / win;
		else
			signal[n] = 0;
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
	//console.log(L_p);

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
    //console.log("HARMONIC COMPONENT EXTRACTION");
    //console.log(x_h);

    const lpcc = extractLPCC(x_h, order, Q);
    //console.log("LPCC COEFFICIENTS EXTRACTED");
    //console.log(lpcc);

    const mfcc = extractMFCC(x_h);
    //console.log("MFCC COEFFICIENTS EXTRACTED");
    //console.log(mfcc);

    return [...lpcc, ...mfcc];
}

function getVowelImpl(audioFrame: Float32Array, _samplerate: Nullable<number> = null) {
	const sampleFeatures = extractFeatures(audioFrame);
	const results = network.run(sampleFeatures);
	
	return results;
}

export { getVowelImpl, setAudioComponents, initialize }