import { useState, useCallback, useEffect } from "react";
import Header from "../../components/Header";
import SunSleep from "../../components/SunSleep";
import SunAwake from "../../components/SunAwake";
import { minRad, height } from "../../audio/setDimsValue";
import Listener from "../../classes/Listener";
import { FormantClass, type Nullable, type PlayParams } from "../../soundrise-types";
import formantVowelDetector from "../../audio/formantVowelDetector";

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
  const [formantClass, setFormantClass] = useState<FormantClass>(FormantClass.Child)

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

  useEffect(() => {
    formantVowelDetector.setOptions?.({
      formantClass: formantClass
    })
  }, [formantClass])

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

      <footer className="fixed inset-x-0 bg-base-100 bottom-0">
        <div className="text-white bg-black z-10">
          <div className="w-full flex justify-center p-3 btn-group">
            <button className={`btn w-32`} onClick={isListening ? handleStopListening : handleStartListening}>
              { isListening ?
                <span className="square-icon text-current">Stop</span>
                :
                <span className="triangle-icon text-current">Start</span>
              }
            </button>
          </div>

          <div className={`w-full flex gap-7 justify-center bg-purple-950 p-3 btn-group ${isListening ? "text-purple-500" : "text-white"}`}>
            <div className="py-1">
              Formants
              <input id="detector_type" name="detector_type" type="checkbox" disabled={isListening} checked={useML} onChange={handleDetectorTypeChange} className="toggle mb-1 mx-4" />
              ML
            </div>
            <div className=" border-l-2 border-purple-700"></div>
            <div>
              <label className={`${useML ? "text-purple-500" : ""}`}>Formants:
                <div className="flex-row inline ml-3 py-1 border-1 border-purple-700 rounded">
                  <button className={`rounded px-2 py-1 ${formantClass == FormantClass.Child ? "bg-purple-700" : "bg-transparent"}`} onClick={() => setFormantClass(FormantClass.Child)}>Child</button>
                  <button className={`rounded px-2 py-1 ${formantClass == FormantClass.AdultFemale ? "bg-purple-700" : "bg-transparent"}`} onClick={() => setFormantClass(FormantClass.AdultFemale)}>Adult (F)</button>
                  <button className={`rounded px-2 py-1 ${formantClass == FormantClass.AdultMale ? "bg-purple-700" : "bg-transparent"}`} onClick={() => setFormantClass(FormantClass.AdultMale)}>Adult (M)</button>
                </div>
              </label>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
