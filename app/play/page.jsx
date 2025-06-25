"use client";
import Header from "../components/Header";
import SunSleep from "../components/sunSleep";
import SunAwake from "../components/sunAwake";
import * as dimsFunctions from "../audio/setDimsValue";
import React, { useState, useEffect } from "react";
import { ClientOnly } from "@bkwld/next-client-only";
import Listener from "../classes/Listener";

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
  const [_vowel, setVowel] = useState("--");
  const [valueVowels, setValueVowels] = useState(null)

  useEffect(() => {
    const listener = new Listener();
    addEventListener("setSvgColor", e => { setSvgColor(e.detail)})
    addEventListener("setPitch", e => { setPitch(e.detail)})
    addEventListener("setVolume", e => { setVolume(e.detail)})
    addEventListener("setNote", e => { setNote(e.detail)})
    addEventListener("setVowel", e => { setVowel(e.detail)})
    addEventListener("setValueVowels", e => { setValueVowels(e.detail)})
    addEventListener("setSunListen", e => { setSunListen(e.detail)})
    addEventListener("setRad", e => { setRad(e.detail)})
    addEventListener("setSvgColor", e => { setSvgColor(e.detail)})
    addEventListener("setYCoord", e => { setYCoord(e.detail)})

    if (isListening) {
      listener.initializeAudio();
    }

    return () => {
      listener.stopListening();
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
