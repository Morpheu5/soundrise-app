'use client'

import Listener from "@/app/classes/Listener";
import { isDefined } from "@/app/miscTools";
import { ClientOnly } from "@bkwld/next-client-only";
import { useEffect, useState } from "react";
import test_files from "./test_files.json";
import { Nullable } from "../soundrise-types";

export default function Tests() {

    type TestItem = {
        filename: string,
        vowel: string,
        gender: "male" | "female" | "other",
        ageGroup: "child" | "adult" | "unknown",
        isPlaying?: Nullable<boolean>,
        audioBufferSourceNode?: Nullable<AudioBufferSourceNode>,
    }

    let [audioContext, setAudioContext] = useState<AudioContext>()
    const [listener, setListener] = useState<Listener>()
    const [testItems, setTestItems] = useState<TestItem[]>()
    
    useEffect(() => {
        setAudioContext(new AudioContext())
        setListener(new Listener())

        const ti = test_files.map(f => f as TestItem)
        setTestItems(ti)
    }, [])

    function playTestItem(i: number) {
        if (!isDefined(listener) || !isDefined(audioContext) || !isDefined(testItems)) return

        const ti = [...testItems]

        listener.audioContext = audioContext
        fetch('/test_assets/' + ti[i].filename)
        .then(response => {
            return response.arrayBuffer()
        })
        .then(buffer => {
            audioContext?.decodeAudioData(buffer, decoded => {
                ti[i].audioBufferSourceNode = audioContext.createBufferSource()
                ti[i].audioBufferSourceNode.buffer = decoded
                ti[i].audioBufferSourceNode.loop = false
                ti[i].audioBufferSourceNode.connect(audioContext.destination)
                listener.mediaStreamSource = ti[i].audioBufferSourceNode
                listener.startListening()
                ti[i].audioBufferSourceNode.onended = () => stopTestItem(i)
                ti[i].audioBufferSourceNode.start()

                ti[i].isPlaying = true
                setTestItems(ti)
            })
        })

    }

    function stopTestItem(i: number) {
        if (!isDefined(testItems) ) return
        const ti = [...testItems]
        if (!isDefined(ti[i].audioBufferSourceNode)) return
        ti[i].audioBufferSourceNode.stop()
        ti[i].audioBufferSourceNode.disconnect()
        ti[i].audioBufferSourceNode.buffer = null
        ti[i].audioBufferSourceNode = null
        ti[i].isPlaying = false
        setTestItems(ti)
    }

    return (
        <ClientOnly>
            <div>
                <h1 className="text-white text-2xl text-center p-6">audio tests</h1>

                <div className="header">
                    <div className="row p-2 bg-white grid grid-cols-12">
                        <div></div>
                        <div className="text-center">vowel</div>
                        <div className="col-span-2">test result</div>
                        <div className="col-span-8">filename</div>
                    </div>
                </div>
                <div className="body pb-2 bg-blue-100">
                    {testItems && testItems.map((item, i) =>
                    <div className="row p-2 pb-0 grid grid-cols-12" key={i}>
                        <div className="text-center">
                            <button className="btn" onClick={() => testItems[i].isPlaying ? stopTestItem(i) : playTestItem(i)}>
                                {item.isPlaying ?
                                <span className="square-icon text-lg">Stop</span>
                                :
                                <span className="triangle-icon text-lg">Play</span>
                                }
                            </button>
                        </div>
                        <div className="text-center">{item.vowel}</div>
                        <div className="col-span-2"></div>
                        <div className="col-span-8">{item.filename}</div>
                    </div>)
                    }
                </div>
            </div>
        </ClientOnly>
    )
}
