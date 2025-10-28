import { FormantClass, type Complex, type Formant, type VowelResult } from "../soundrise-types";
import type { VowelDetector } from "./VowelDetector";

const p = 15;
const N = 256;
let f0: number;
const f1 = 22050;

// *** VERY IMPORTANT NOTE ***
// The ML code does not differentiate between grave/acute variants of E and O
// so to make a fair comparison we have to combine these in the formant code
// as well. To do that, we'll just average the two F1 and F2.

// The following are the original values based on an adult female mezzo/alto voice
// const F1s =    [ 120,  200,  337,  522,  773,  542,  342,  308,  150];
// const F2s =    [2900, 3200, 2512, 2400, 1392, 1195,  920,  762,  580];
// const vowels = [       "I",  "É",  "È",  "A",  "Ò",  "Ó",  "U"      ];

// Formants based on an adult female mezzo/alto voice
// NOTE: The first and last values do not exist: they are only used to simplify range calculations in the algorithm
// const F1s =    [ 120,  268,  522,  773,  442,  308,  150];
// const F2s =    [2900, 2856, 2400, 1392, 1057,  762,  580];
// const vowels = [       "I",  "E",  "A",  "O",  "U"      ];

// The following values are based/adapted from
// - https://doi.org/10.1044/1092-4388(2007/104)
// - Ferrari-Disner, Sandra. "Insights on vowel spacing." Maddieson, I. Patterns of Sounds (1984).

const F1s = {
  'adult_f':   [ 120,  270,  520,  750,  420,  300,  150 ],
  'adult_m':   [ 105,  240,  460,  660,  370,  260,  130 ],
  'child':     [ 150,  340,  650,  950,  520,  360,  180 ],
}

const F2s = {
  'adult_f':   [2900, 2600, 1700,  950,  750,  600,  500 ],
  'adult_m':   [2552, 2513, 2112, 1225,  930,  671,  510 ],
  'child':     [3700, 3300, 2150, 1150,  910,  700,  550 ],
}

const vowels = [       "I",  "E",  "A",  "O",  "U"       ];

let formantClass: FormantClass = FormantClass.Child

function setOptions(options: { formantClass: FormantClass }) {
  console.log("Current: ", formantClass)
  console.log("Setting options: ", options)
  formantClass = options.formantClass
  console.log("New: ", formantClass)
}

let signal: Float32Array;

function getVowelImpl(s: Float32Array, sampleRate: number): VowelResult[] {
  signal = s;
  f0 = sampleRate;
  
  // Noise reduction
  signal = preProcessSignal(signal);
  
  // Autocorrelation and LPC analysis
  const R = autocorrelation();
  const lpc = durbin(R);
  const roots = durand(lpc);
  const valid = formants(roots, f1);
  
  // Compare formants with the correct ranges and calculate probabilities
  const probabilities = compare(valid);
  return probabilities;
}

function preProcessSignal(s: Float32Array) {
  return exponentialMovingAverage(s, 0.2); // Low-pass filter
  // Although probably not necessary because of how the signal is preprocessed via the WebAudio API
}

function exponentialMovingAverage(signal: Float32Array, alpha = 0.2) {
  if (alpha <= 0 || alpha > 1) {
    throw new Error("Alpha must be between 0 (exclusive) and 1 (inclusive).");
  }

  const filteredSignal = new Float32Array(signal.length);
  
  // The first filtered value is just the first input value
  filteredSignal[0] = signal[0];

  for (let i = 1; i < signal.length; i++) {
    const currentInput = signal[i];
    const previousOutput = filteredSignal[i - 1];
    
    filteredSignal[i] = alpha * currentInput + (1 - alpha) * previousOutput;
  }
  return filteredSignal;
}

function autocorrelation() {
  usx = new Float32Array((signal.length * f1) / f0);
  const R = new Float32Array(p + 1);
  
  for (let k = 0; k <= p; k++) {
    R[k] = 0;
    for (let m = 0; m <= N - 1 - k; m++) {
      R[k] += efficientUs(m) * efficientUs(m + k);
    }
  }
  return R;
}

function ham(N: number, i: number) {
  return 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1));
}

let usx: Float32Array;
function efficientUs(i: number) {
  if (usx[i] == 0) {
    const ratio = f0 / f1;
    usx[i] = 0;
    const index = Math.floor(i * ratio);
    
    for (let j = 0; j < ratio; j++) {
      usx[i] += signal[index + j] * ham(N, i);
    }
    usx[i] /= ratio;
  }
  return usx[i];
}

function durbin(R: Float32Array) {
  const lpc = [];
  const alpha: number[][] = [];
  const k = [];
  let E = R[0];
  
  for (let i = 1; i <= p; i++) {
    k[i] = R[i];
    for (let j = 1; j <= i - 1; j++) {
      k[i] -= alpha[j][i - 1] * R[i - j];
    }
    k[i] /= E;
    alpha[i] = [];
    alpha[i][i] = k[i];
    for (let j = 1; j <= i - 1; j++) {
      alpha[j][i] = alpha[j][i - 1] - k[i] * alpha[i - j][i - 1];
    }
    E = (1 - k[i] * k[i]) * E;
  }
  
  for (let i = 0; i < p; i++) {
    lpc[i + 1] = -alpha[i + 1][p];
  }
  lpc[0] = 1;
  return lpc;
}

function durand(cf: number[]) {
  const deg = cf.length - 1;
  const n = 8;
  const roots: Complex[] = [];
  for (let i = 0; i < deg; i++) {
    const theta = (2 * Math.PI * i) / deg;
    const root: Complex = { real: Math.cos(theta), imaginary: Math.sin(theta) };
    roots[i] = root;
  }
  
  for (let i = 0; i < n; i++) {
    const preroots = roots;
    for (let j = 0; j < deg; j++) {
      let p = { real: cf[0], imaginary: 0 };
      for (let k = 1; k <= deg; k++) {
        p = sumc(mulc(p, preroots[j]), { real: cf[k], imaginary: 0 });
      }
      
      let div = { real: 1, imaginary: 0 };
      for (let k = 0; k < deg; k++) {
        if (j != k) {
          div = mulc(div, subc(preroots[j], preroots[k]));
        }
      }
      roots[j] = subc(preroots[j], divc(p, div));
    }
  }
  
  return roots;
}

function sumc(a: Complex, b: Complex): Complex {
  return { real: a.real + b.real, imaginary: a.imaginary + b.imaginary };
}

function subc(a: Complex, b: Complex): Complex {
  return { real: a.real - b.real, imaginary: a.imaginary - b.imaginary };
}

function mulc(a: Complex, b: Complex): Complex {
  return {
    real: a.real * b.real - a.imaginary * b.imaginary,
    imaginary: a.real * b.imaginary + a.imaginary * b.real,
  };
}

function divc(a: Complex, b: Complex): Complex {
  const denominator = b.real * b.real + b.imaginary * b.imaginary;
  return {
    real: (a.real * b.real + a.imaginary * b.imaginary) / denominator,
    imaginary: (a.imaginary * b.real - a.real * b.imaginary) / denominator,
  };
}

function formants(roots: Complex[], fs: number): Formant[] {
  const ff = [];
  for (let i = 0; i < roots.length; i++) {
    const f = (fs * Math.atan2(roots[i].imaginary, roots[i].real)) / (2 * Math.PI);
    const b =
    (-fs * Math.log(Math.sqrt(roots[i].real ** 2 + roots[i].imaginary ** 2))) /
    Math.PI;
    if (f >= 0 && b >= 0 && b <= 6400) {
      ff.push({ freq: f, band: b });
    }
  }
  ff.sort((a, b) => a.freq - b.freq);
  
  const valid: Formant[] = [];
  const minval = [200, 700];   // Bottom limits for [F1, F2]
  const maxval = [1600, 3000]; // Top limits for [F1, F2]
  let j = 0;
  for (let i = 0; i < ff.length; i++) {
    if (ff[i].freq >= minval[j] && ff[i].freq <= maxval[j]) {
      valid[j++] = ff[i];
    }
    if (j > 2) break;
  }
  return valid;
}

function getVowelResults(valid: Formant[]): VowelResult[] {
  const probabilities: VowelResult[] = [];
  
  for (let i = 1; i <= 5; i++) {
    let score = 0;
    
    // Calculate the distance from F1
    if (valid[1] && valid[1].freq) {
      const diffF1 = Math.abs(valid[1].freq - F1s[formantClass][i]);
      score += Math.exp(-diffF1 / 200); // Exponential penalty for F1
    }
    
    // Calculate the distance from F2
    if (valid[2] && valid[2].freq) {
      const diffF2 = Math.abs(valid[2].freq - F2s[formantClass][i]);
      score += Math.exp(-diffF2 / 400); // Exponential penalty for F2
    }
    
    probabilities.push({ vowel: vowels[i - 1], score });
  }
  
  // Translate scores to percentages
  const totalScore = probabilities.reduce((sum, item) => sum + (item.score ?? 0), 0);
  probabilities.forEach((item) => {
    item.percentage = (((item.score ?? 0) / totalScore) * 100).toFixed(1); // FIXME I'm pretty sure we can do without this being a string but hey
  });
  
  return probabilities;
}

function compare(valid: Formant[]): VowelResult[] {
  if (valid.length === 0) {
    return vowels.map((v) => ({ vowel: v, score: 0, percentage: "0.0" })); // silence
  }
  
  const probabilities = getVowelResults(valid);
  return probabilities;
}

function setAudioComponents(_c: AudioContext, _a: AnalyserNode) {}

function initialize() {}

const formantVowelDetector: VowelDetector = {
    getVowelImpl, setAudioComponents, initialize, setOptions
}

export default formantVowelDetector;