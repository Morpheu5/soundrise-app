"use client";
import { useState, useEffect } from "react";
import { ClientOnly } from "@bkwld/next-client-only";
import Header from "@/app/components/Header";
import SunSleep from "@/app/components/SunSleep";
import SunAwake from "@/app/components/SunAwake";
import { minRad, height } from "@/app/audio/setDimsValue";
import Listener from "@/app/classes/Listener";

export default function Play() {
  const [svgColor, setSvgColor] = useState("yellow");
  const [rad, setRad] = useState(minRad);

  const [yCoord, setYCoord] = useState(
    (height - Math.round((height * 35) / 100)) / 2
  );

  const [sunListen, setSunListen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pitch, setPitch] = useState("--");
  const [volume, setVolume] = useState("--");
  const [note, setNote] = useState("--");
  const [_vowel, setVowel] = useState("--");
  const [valueVowels, setValueVowels] = useState(null)

  const [listener, setListener] = useState<Nullable<Listener>>(undefined);

  const handleSetSvgColor: EventListener = (e: Event) => setSvgColor((e as CustomEvent).detail);
  const handleSetPitch: EventListener = (e: Event) => setPitch((e as CustomEvent).detail);
  const handleSetVolume: EventListener = (e: Event) => setVolume((e as CustomEvent).detail);
  const handleSetNote: EventListener = (e: Event) => setNote((e as CustomEvent).detail);
  const handleSetVowel: EventListener = (e: Event) => setVowel((e as CustomEvent).detail);
  const handleSetValueVowels: EventListener = (e: Event) => setValueVowels((e as CustomEvent).detail);
  const handleSetSunListen: EventListener = (e: Event) => setSunListen((e as CustomEvent).detail);
  const handleSetRad: EventListener = (e: Event) => setRad((e as CustomEvent).detail);
  const handleSetYCoord: EventListener = (e: Event) => setYCoord((e as CustomEvent).detail);

  useEffect(() => {
    // OK, I don't like this approach but otherwise I can't see how to add the event listeners.
    setListener(new Listener());

    // Add event listeners
    // See this for reference https://github.com/microsoft/TypeScript/issues/28357#issue-377642397
    addEventListener("setSvgColor", handleSetSvgColor);
    addEventListener("setPitch", handleSetPitch);
    addEventListener("setVolume", handleSetVolume);
    addEventListener("setNote", handleSetNote);
    addEventListener("setVowel", handleSetVowel);
    addEventListener("setValueVowels", handleSetValueVowels);
    addEventListener("setSunListen", handleSetSunListen);
    addEventListener("setRad", handleSetRad);
    addEventListener("setYCoord", handleSetYCoord);

    if (listener && isListening) {
      listener.startListening();
    }

    return () => {
      if (!listener) return;
      listener.stopListening();
      setListener(undefined)
      removeEventListener("setSvgColor", handleSetSvgColor)
      removeEventListener("setPitch", handleSetPitch);
      removeEventListener("setVolume", handleSetVolume);
      removeEventListener("setNote", handleSetNote);
      removeEventListener("setVowel", handleSetVowel);
      removeEventListener("setValueVowels", handleSetValueVowels);
      removeEventListener("setSunListen", handleSetSunListen);
      removeEventListener("setRad", handleSetRad);
      removeEventListener("setYCoord", handleSetYCoord);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <ClientOnly>
      <main className="flex h-screen flex-col text-neutral-content relative">
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
      </main>
    </ClientOnly>
  );
}
