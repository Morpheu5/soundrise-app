import { useState, useCallback, useEffect } from "react";
import Header from "../../components/Header";
import SunSleep from "../../components/SunSleep";
import SunAwake from "../../components/SunAwake";
import { minRad, height } from "../../audio/setDimsValue";
import Listener from "../../classes/Listener";
import type { Nullable, PlayParams } from "../../soundrise-types";

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
  const [vowelScoresString, setVowelScoresString] = useState<Nullable<string>>(null)
  const [useML, setUseML] = useState<boolean>(false)

  const [listener, setListener] = useState<Listener>();

  useEffect(() => {
    setListener(Listener.getInstance())
  }, [])

  useEffect(() => {
    if (useML) {
        listener?.setCurrentDetector("ml")
    } else {
        listener?.setCurrentDetector("formant")
    }
  }, [useML, listener])

  function handleDetectorTypeChange() {
    setUseML(!useML)
  }

  const handleSetPlayParams: EventListener = useCallback((e: Event) => {
    const data: PlayParams = (e as CustomEvent).detail;
    setSvgColor(data.svgColor);
    setPitch(data.pitch);
    setVolume(data.volume);
    setNote(data.note);
    setVowel(data.vowel);
    setVowelScoresString(data.vowelScoresString);
    setSunListen(data.sunListen);
    setRad(data.rad);
    setYCoord(data.yCoord);
  }, [])

  const handleStartListening = () => {
    setIsListening(true);
    
    // Add event listeners
    // See this for reference https://github.com/microsoft/TypeScript/issues/28357#issue-377642397
    addEventListener("setPlayParams", handleSetPlayParams);
    listener?.startListening();
  };

  const handleStopListening = () => {
    listener?.stopListening();
    removeEventListener("setPlayParams", handleSetPlayParams);

    setIsListening(false);
  };
  
  return (
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
        {vowelScoresString 
          ? vowelScoresString
          : "I: 0%\nE: 0%\nA: 0%\nO: 0%\nU: 0%"
        }
        </p>
      </div>

      <div className="fixed inset-x-0 bg-base-100 bottom-0">
      <footer className="w-full flex justify-center text-white p-3 bg-black z-10">
          <div className="flex items-center btn-group">
            <div className={`pr-24 ${isListening ? 'text-neutral-500' : 'text-white'}`}>
                <p>
                    Formants
                    <input id="detector_type" name="detector_type" type="checkbox" disabled={isListening} checked={useML} onChange={handleDetectorTypeChange} className="toggle mb-1 mx-4" />
                    ML
                </p>
            </div>
            <button
              className={`btn w-32`}
              onClick={isListening ? handleStopListening : handleStartListening}
            >
              { isListening ?
                <span className="square-icon text-current">Stop</span>
                :
                <span className="triangle-icon text-current">Start</span>
              }
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
