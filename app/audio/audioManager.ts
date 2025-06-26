let p = 15;
let N = 256;
let f0: number;
let f1 = 22050;
let form = [];

// Formanti donna per I, é, È, A, O, ó, U
// I valori a margine (primo e ultimo) sono inesistenti: servono solo per agevolare il calcolo dei range nell'algoritmo
let form1 = [120, 200, 337, 522, 773, 542, 342, 308, 150];
let form2 = [2900, 3200, 2512, 2400, 1392, 1195, 920, 762, 580];

let vocali = ["I", "É", "È", "A", "Ò", "Ó", "U"];
let signal: Float32Array;

interface Complex {
  real: number;
  imag: number;
}

interface Formant {
  freq: number;
  band: number;
}

function getVowelImpl(s: Float32Array, sampleRate: number): VowelResult[] {
  signal = s;
  f0 = sampleRate;
  
  // Applica un filtro pre-elaborazione per ridurre il rumore
  signal = preProcessSignal(signal);
  
  // Step di autocorrelazione e calcolo delle radici
  let R = autocorrelation();
  let lpc = durbin(R);
  let roots = durand(lpc);
  let valid = formants(roots, f1);
  
  // Confronto formanti con i range corretti e calcolo delle probabilità
  const probabilities = compare(valid);
  return probabilities;
}

function preProcessSignal(s: Float32Array) {
  // Esempio di filtro passa-basso per rimuovere il rumore ad alta frequenza
  const filteredSignal = s.map((sample, i) => {
    return sample * Math.exp(-0.002 * i); // Filtro semplice per attenuare
  });
  return filteredSignal;
}

function autocorrelation() {
  usx = new Float32Array((signal.length * f1) / f0);
  let R = new Float32Array(p + 1);
  
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
    let ratio = f0 / f1;
    usx[i] = 0;
    let index = Math.floor(i * ratio);
    
    for (let j = 0; j < ratio; j++) {
      // usx[i] += parseFloat(signal[index + j]) * ham(N, i);
      usx[i] += signal[index + j] * ham(N, i);
    }
    usx[i] /= ratio;
  }
  return usx[i];
}

function durbin(R: Float32Array) {
  let lpc = [];
  let alpha: number[][] = [];
  let k = [];
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
  let roots: Complex[] = [];
  for (let i = 0; i < deg; i++) {
    const theta = (2 * Math.PI * i) / deg;
    const root: Complex = { real: Math.cos(theta), imag: Math.sin(theta) };
    roots[i] = root;
  }
  
  for (let i = 0; i < n; i++) {
    let preroots = roots;
    for (let j = 0; j < deg; j++) {
      let p = { real: cf[0], imag: 0 };
      for (let k = 1; k <= deg; k++) {
        p = sumc(mulc(p, preroots[j]), { real: cf[k], imag: 0 });
      }
      
      let div = { real: 1, imag: 0 };
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
  return { real: a.real + b.real, imag: a.imag + b.imag };
}

function subc(a: Complex, b: Complex): Complex {
  return { real: a.real - b.real, imag: a.imag - b.imag };
}

function mulc(a: Complex, b: Complex): Complex {
  return {
    real: a.real * b.real - a.imag * b.imag,
    imag: a.real * b.imag + a.imag * b.real,
  };
}

function divc(a: Complex, b: Complex): Complex {
  const denominator = b.real * b.real + b.imag * b.imag;
  return {
    real: (a.real * b.real + a.imag * b.imag) / denominator,
    imag: (a.imag * b.real - a.real * b.imag) / denominator,
  };
}

function formants(roots: Complex[], fs: number): Formant[] {
  let ff = [];
  for (let i = 0; i < roots.length; i++) {
    let f = (fs * Math.atan2(roots[i].imag, roots[i].real)) / (2 * Math.PI);
    let b =
    (-fs * Math.log(Math.sqrt(roots[i].real ** 2 + roots[i].imag ** 2))) /
    Math.PI;
    if (f >= 0 && b >= 0 && b <= 6400) {
      ff.push({ freq: f, band: b });
    }
  }
  ff.sort((a, b) => a.freq - b.freq);
  
  let valid: Formant[] = [];
  let j = 0;
  let minval = [200, 700];
  let maxval = [1600, 3000];
  for (let i = 0; i < ff.length; i++) {
    if (ff[i].freq >= minval[j] && ff[i].freq <= maxval[j]) {
      valid[j + 1] = ff[i];
      j++;
    }
    if (j > 2) break;
  }
  return valid;
}

function getProbabilities(valid: Formant[]): VowelResult[] {
  const probabilities: VowelResult[] = [];
  
  for (let i = 1; i <= 7; i++) {
    let score = 0;
    
    // Calcola la distanza dalla formante F1
    if (valid[1] && valid[1].freq) {
      const diffF1 = Math.abs(valid[1].freq - form1[i]);
      score += Math.exp(-diffF1 / 200); // Penalizzazione esponenziale per F1
    }
    
    // Calcola la distanza dalla formante F2
    if (valid[2] && valid[2].freq) {
      const diffF2 = Math.abs(valid[2].freq - form2[i]);
      score += Math.exp(-diffF2 / 400); // Penalizzazione esponenziale per F2
    }
    
    probabilities.push({ vowel: vocali[i - 1], score });
  }
  
  // Normalizza i punteggi in percentuali
  const totalScore = probabilities.reduce((sum, item) => sum + (item.score ?? 0), 0);
  probabilities.forEach((item) => {
    item.percentage = (((item.score ?? 0) / totalScore) * 100).toFixed(1); // Percentuale con una cifra decimale
  });
  
  return probabilities;
}

function compare(valid: Formant[]) {
  if (valid.length === 0) {
    return vocali.map((v) => ({ vowel: v, score: 0, percentage: "0.0" })); // Nessuna probabilità
  }
  
  const probabilities = getProbabilities(valid);
  // console.log(probabilities); // Opzionale: stampa per debug
  return probabilities;
}

// module.exports = {
//   getVowelImpl,
// };

interface VowelResult {
  vowel: string;
  score?: number;
  percentage?: string;
}

export { getVowelImpl }
export type { VowelResult }
