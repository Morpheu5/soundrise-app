"use client";
import Header from "../components/Header";
import SunSleep from "../components/sunSleep";
import SunAwake from "../components/sunAwake";
import * as dimsFunctions from "../audio/setDimsValue";
import * as vowelFunctions from "../audio/audioManager";
import React, { useState, useEffect } from "react";
import { ClientOnly } from "@bkwld/next-client-only";

export default function Play() {
  const [svgColor, setSvgColor] = useState("yellow");
  const [rad, setRad] = useState(dimsFunctions.minRad);

  const [yCoord, setYCoord] = useState(
    (dimsFunctions.height - Math.round((dimsFunctions.height * 35) / 100)) / 2
  );

  const [sunListen, setSunListen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pitch, setPitch] = useState("--");
  const [volume, setVolume] = useState("--");
  const [note, setNote] = useState("--");
  const [vowel, setVowel] = useState("--");
  const [valueVowels, setValueVowels] = useState(null)

  useEffect(() => {
    var audioContext = null;
    let analyser = null;
    let mediaStreamSource = null;
    let rafID = null;
    const buflen = 2048;
    const buf = new Float32Array(buflen);
    var buffer_pitch = [];
    var buffer_vol = [];
    var buffer_vocal = [];
    var buffer_percentage = [];
    var count_sil = 0;
    const noteStrings = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    function noteFromPitch(frequency) {
      var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
      return Math.round(noteNum) + 69;
    }

    // Implements the ACF2+ algorithm
    // Source: https://github.com/cwilso/PitchDetect/blob/main/js/pitchdetect.js (MIT License)
    // TODO Take this function out and reference the original code properly
    function setFrequency(audioBuffer, sampleRate) {
      // Calculate the RMS (root‑mean‑square) to check signal strength
      var bufferSize = audioBuffer.length;
      var rootMeanSquare = 0;

      for (var i = 0; i < bufferSize; i++) {
        var sample = audioBuffer[i];
        rootMeanSquare += sample * sample;
      }
      rootMeanSquare = Math.sqrt(rootMeanSquare / bufferSize);

      // Abort early if the signal is too weak
      if (rootMeanSquare < 0.01) {
        return -1;
      }

      // Trim leading and trailing silence below the threshold
      var startIndex = 0,
          endIndex = bufferSize - 1,
          threshold = 0.2;

      for (var i = 0; i < bufferSize / 2; i++) {
        if (Math.abs(audioBuffer[i]) < threshold) {
          startIndex = i;
          break;
        }
      }
      for (var i = 1; i < bufferSize / 2; i++) {
        if (Math.abs(audioBuffer[bufferSize - i]) < threshold) {
          endIndex = bufferSize - i;
          break;
        }
      }

      audioBuffer = audioBuffer.slice(startIndex, endIndex);
      bufferSize = audioBuffer.length;

      // Build the autocorrelation array
      var autoCorrelation = new Array(bufferSize).fill(0);
      for (var i = 0; i < bufferSize; i++) {
        for (var j = 0; j < bufferSize - i; j++) {
          autoCorrelation[i] += audioBuffer[j] * audioBuffer[j + i];
        }
      }

      // Find the first dip in the autocorrelation
      var dipIndex = 0;
      while (autoCorrelation[dipIndex] > autoCorrelation[dipIndex + 1]) {
        dipIndex++;
      }

      // Find the peak following the dip
      var peakValue = -1,
          peakIndex = -1;
      for (var i = dipIndex; i < bufferSize; i++) {
        if (autoCorrelation[i] > peakValue) {
          peakValue = autoCorrelation[i];
          peakIndex = i;
        }
      }
      var fundamentalPeriod = peakIndex;

      // Perform parabolic interpolation for better period accuracy
      var correlationLeft = autoCorrelation[fundamentalPeriod - 1],
          correlationCenter = autoCorrelation[fundamentalPeriod],
          correlationRight = autoCorrelation[fundamentalPeriod + 1];
      var quadraticCoeffA = (correlationLeft + correlationRight - 2 * correlationCenter) / 2;
      var quadraticCoeffB = (correlationRight - correlationLeft) / 2;
      if (quadraticCoeffA) {
        fundamentalPeriod = fundamentalPeriod - quadraticCoeffB / (2 * quadraticCoeffA);
      }

      // Convert period to frequency (Hz)
      return sampleRate / fundamentalPeriod;
    }
    // Define a buffer to store previous audio buffer data
    const previousBuffers = [];

    function getStableVolume(buf) {
      const sumSquares = buf.reduce(
        (sum, amplitude) => sum + amplitude * amplitude,
        0
      );
      const rootMeanSquare = Math.sqrt(sumSquares / buf.length);

      // Add the root mean square value to the previousBuffers array
      previousBuffers.push(rootMeanSquare);

      // Keep a limited history of previous volume values
      // (adjust the history size as needed)
      const historySize = 10;
      if (previousBuffers.length > historySize) {
        previousBuffers.shift();
      }

      // Calculate the average of the previous volume values
      const averageVolume =
        previousBuffers.reduce((sum, value) => sum + value, 0) /
        previousBuffers.length;

      return Math.round(averageVolume * 100);
    }

    function getVowel(buf, sampleRate) {
      // donna
      var form1 = [320, 400, 620, 920, 640, 400, 360];
      var form2 = [2750, 2500, 2400, 1400, 1200, 920, 760];
      var result = vowelFunctions.getVowel(buf, sampleRate);
      // console.log(result);
      // prende la vocale più probabile
      var max_p = 0;
      var max_v = "";
      for (var i = 0; i < result.length; i++) {
        if (parseFloat(result[i].percentage) > max_p) {
          max_p = parseFloat(result[i].percentage);
          max_v = result[i].vocale;
        }
      }
      
      //console.log(max_v, max_p);
      return max_v;
    }

    function getValueVowels(buf, sampleRate) {
      return vowelFunctions.getVowel(buf, sampleRate);
    }

    const initializeAudio = () => {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: "interactive", // Riduci la latenza
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
          mediaStreamSource = audioContext.createMediaStreamSource(stream);

          // Filtro passa-alto
          const highpassFilter = audioContext.createBiquadFilter();
          highpassFilter.type = "highpass";
          highpassFilter.frequency.value = 200;

          // Filtro passa-basso
          const lowpassFilter = audioContext.createBiquadFilter();
          lowpassFilter.type = "lowpass";
          lowpassFilter.frequency.value = 3000;

          // Filtro band-pass
          const bandpassFilter = audioContext.createBiquadFilter();
          bandpassFilter.type = "bandpass";
          bandpassFilter.frequency.value = 1000;
          bandpassFilter.Q.value = 0.7;

          // Compressore dinamico
          const compressor = audioContext.createDynamicsCompressor();
          compressor.threshold.value = -50;
          compressor.knee.value = 40;
          compressor.ratio.value = 4;

          // Gain
          const gainNode = audioContext.createGain();
          gainNode.gain.value = 1.5;

          // Analizzatore con dimensione FFT ridotta
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 1024; // FFT ridotta per maggiore velocità

          // Collegamenti
          mediaStreamSource.connect(highpassFilter);
          highpassFilter.connect(lowpassFilter);
          lowpassFilter.connect(bandpassFilter);
          bandpassFilter.connect(compressor);
          compressor.connect(gainNode);
          gainNode.connect(analyser);

          startListening();
        })
        .catch((err) => {
          console.error(`${err.name}: ${err.message}`);
        });
    };

    function ArrayAvg(myArray) {
      var i = 0,
        summ = 0,
        ArrayLen = myArray.length;
      while (i < ArrayLen) {
        summ = summ + myArray[i++];
      }
      return summ / ArrayLen;
    }
    function findMostRepeatedItem(arr) {
      let count = {};
      let mostRepeatedItem;
      let maxCount = 0;

      for (const item of arr) {
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
    const selectColor = (vocale) => {
      if (vocale == "I") {
        setSvgColor("blue");
      } else if (vocale == "É") {
        setSvgColor("#4CC94C");
      } else if (vocale == "È") {
        setSvgColor("#4CC94C");
      }
       else if (vocale == "A") {
        setSvgColor("red");
      } else if (vocale == "Ò") {
        setSvgColor("orange");
      } else if (vocale == "Ó") {
        setSvgColor("orange");
      } else if (vocale == "U") {
        setSvgColor("#C0C0C0");
      }
    };

    const startListening = () => {
      if (!analyser) {
        return;
      }

      analyser.getFloatTimeDomainData(buf);

      const frequency = setFrequency(buf, audioContext.sampleRate);
      const volume = getStableVolume(buf);
      const vowel = getVowel(buf, audioContext.sampleRate);
      const valueVowels = getValueVowels(buf, audioContext.sampleRate);
      
      var MAX_BUF = 600;
      if (
        (frequency == -1 ||
          frequency < dimsFunctions.minPitch ||
          frequency > dimsFunctions.maxPitch) &&
        (volume < dimsFunctions.minVol || volume > dimsFunctions.maxVol)
      ) {
        setPitch("...");
        setVolume("...");
        setNote("...");
        setVowel("..."); 
        setValueVowels("I: 0%\nÉ: 0%\nÈ: 0%\nA: 0%\nÒ: 0%\nÓ: 0%\nU: 0%");
        setSunListen(false);
        setRad(dimsFunctions.minRad);
        setSvgColor("yellow");
        setYCoord(
          (dimsFunctions.height -
            Math.round((dimsFunctions.height * 30) / 100)) /
            2
        );
        count_sil++;
        if (count_sil >= 50) {
          console.log("silence");
          buffer_pitch = [];
          buffer_vol = [];
          buffer_vocal = [];
          buffer_percentage = [];
          count_sil = 0;
        }
      } else {
        if (
          frequency != -1 &&
          frequency >= 100 &&
          frequency <= 600 &&
          volume > 0 &&
          volume <= 50 &&
          vowel != 0
        ) {
          if (buffer_pitch.length > MAX_BUF) {
            buffer_pitch.shift();
            buffer_pitch.push(frequency);
          } else {
            buffer_pitch.push(frequency);
          }

          if (buffer_vol.length > MAX_BUF) {
            buffer_vol.shift();
            buffer_vol.push(volume);
          } else {
            buffer_vol.push(volume);
          }
          if (vowel != 0) {
            if (buffer_vocal.length > MAX_BUF) {
              buffer_vocal.shift();
              buffer_vocal.push(vowel);
            } else {
              buffer_vocal.push(vowel);
            }

            if (buffer_percentage.length > MAX_BUF) {
              buffer_percentage.shift();
            }
            else{
              // Aggiungi il valore medio dei percentage al buffer_percentage
              buffer_percentage.push(valueVowels);
            }
            
          } else {
            // v == 0
            if (buffer_vocal.length > MAX_BUF) {
              buffer_vocal.shift();
              buffer_vocal.push(findMostRepeatedItem(buffer_vocal));
            } else {
              buffer_vocal.push(findMostRepeatedItem(buffer_vocal));
            }

            if (buffer_percentage.length > MAX_BUF) {
              buffer_percentage.shift();
            }
            else{
              // Aggiungi il valore medio dei percentage al buffer_percentage
              buffer_percentage.push(valueVowels);
            }
          }

          setSunListen(true);

          const pitchValue = Math.round(ArrayAvg(buffer_pitch));
          const yCoordValue = dimsFunctions.setPosPitch(pitchValue);
          var hz = pitchValue + "Hz";
          setPitch(hz);
          setYCoord(yCoordValue);

          const volValue = Math.round(ArrayAvg(buffer_vol));
          setVolume(volValue);
          const radValue = dimsFunctions.setRad(volValue);
          setRad(radValue);

          const n = noteFromPitch(pitchValue);
          setNote(noteStrings[n % 12]);

          const vocalValue = findMostRepeatedItem(buffer_vocal);
          selectColor(vocalValue);
          setVowel(vocalValue);

          setValueVowels(() => {
            const vowelSums = {}; // Per sommare le percentuali di ciascuna vocale
            const vowelCounts = {}; // Per contare le occorrenze di ciascuna vocale
          
            // Itera su ogni elemento nel buffer
            buffer_percentage.forEach((valueVowels) => {
              valueVowels.forEach((item) => {
                const { vocale, percentage } = item;
                if (!vowelSums[vocale]) {
                  vowelSums[vocale] = 0;
                  vowelCounts[vocale] = 0;
                }
                vowelSums[vocale] += parseFloat(percentage);
                vowelCounts[vocale] += 1;
              });
            });
          
            // Calcola le medie
            const averagedVowels = Object.keys(vowelSums).map((vocale) => {
              const avgPercentage = vowelSums[vocale] / vowelCounts[vocale];
              return `${vocale}: ${avgPercentage.toFixed(0)}%`; // Mostra con due decimali
            });
          
            return averagedVowels.join("\n"); // Concatena ogni vocale con la sua media
          });
          
          
        }
      }

      if (!window.requestAnimationFrame)
        window.requestAnimationFrame = window.webkitRequestAnimationFrame;
      rafID = window.requestAnimationFrame(startListening);
    };

    const stopListening = () => {
      buffer_pitch = [];
      buffer_vol = [];
      buffer_vocal = [];
      count_sil = 0;
      setSunListen(false);
      setRad(dimsFunctions.minRad);
      setSvgColor("yellow");
      setYCoord(
        (dimsFunctions.height - Math.round((dimsFunctions.height * 30) / 100)) /
          2
      );
      if (audioContext) {
        if (rafID) {
          window.cancelAnimationFrame(rafID);
        }
        mediaStreamSource.disconnect(); // Disconnect the mediaStreamSource
        audioContext
          .close()
          .then(() => {
            audioContext = null;
            analyser = null;
            mediaStreamSource = null;
            /* console.log(
              "Microphone stopped.\nlen: " +
                buffer_pitch.filter((x, i) => buffer_pitch.indexOf(x) === i)
                  .length
            );*/
            setPitch("--");
            setVolume("--");
            setNote("--");
            setVowel("--");
            setValueVowels("I: 0%\nÉ: 0%\nÈ: 0%\nA: 0%\nÒ: 0%\nÓ: 0%\nU: 0%");
          })
          .catch((err) => {
            console.error("Error stopping microphone:", err);
          });
      }
    };

    if (isListening) {
      initializeAudio();
    }

    return () => {
      stopListening();
    };
  }, [isListening]);

  const [startButtonDisabled, setStartButtonDisabled] = useState(false);
  const [stopButtonDisabled, setStopButtonDisabled] = useState(true);

  const handleStartListening = () => {
    setIsListening(true);
    setStartButtonDisabled(true);
    setStopButtonDisabled(false);
  };

  const handleStopListening = () => {
    setIsListening(false);
    setStartButtonDisabled(false);
    setStopButtonDisabled(true);
  };

  return (
    <ClientOnly><main className="flex h-screen flex-col text-neutral-content relative">
  {/* Header */}
  <Header />
 {/* Background Wave */}
      <div className="bg-wave absolute bottom-0 w-full min-h-[60vh]"></div>

      {sunListen ? (
        <SunAwake
          svgColor={svgColor}
          rad={rad}
          yCoordinate={yCoord}
          heightSpaceSun={"90vh"}
        />
      ) : (
        <SunSleep
          svgColor={svgColor}
          rad={rad}
          yCoordinate={yCoord}
          heightSpaceSun={"90vh"}
        />
      )}
      <div className="fixed-square z-20">
        <p>
          <b>pitch:</b> <br />
          {pitch}
        </p>
        <p>
          <b>intensity:</b> <br />
          {volume}
        </p>
        <p>
          <b>note:</b> <br />
          {note}
        </p>
        <p>
          <b>vowel:</b> <br />
        </p>
        <p style={{ whiteSpace: "pre-line" }}>
        {valueVowels 
          ? valueVowels // Mostra i valori calcolati
          : "I: 0%\nÉ: 0%\nÈ: 0%\nA: 0%\nÒ: 0%\nÓ: 0%\nU: 0%"
        }
        </p>
      </div>

      <div className="fixed inset-x-0 bg-base-100 bottom-0">
      <footer className="w-full flex justify-center text-white p-3 bg-black z-10">
          <div className="grid  grid-cols-2 btn-group">
            <button
              className={`btn w-32 ${
                startButtonDisabled ? "btn-disabled" : "btn-active"
              }`}
              onClick={handleStartListening}
              disabled={startButtonDisabled}
            >
              <span className="triangle-icon text-current"></span>
              Start
            </button>
            <button
              className={`btn w-32 ${
                stopButtonDisabled ? "btn-disabled" : "btn-active"
              }`}
              onClick={handleStopListening}
              disabled={stopButtonDisabled}
            >
              <span className="square-icon text-current"></span>
              Stop
            </button>
          </div>
        </footer>
      </div>
    </main></ClientOnly>
  );
}
