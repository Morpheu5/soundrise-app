'use client'

import Listener from "@/app/classes/Listener";
import { isDefined } from "@/app/miscTools";
import { Nullable } from "@/types/types";
import { ClientOnly } from "@bkwld/next-client-only";
import { useEffect, useState } from "react";

export default function Tests() {
    let [audioContext, setAudioContext] = useState<Nullable<AudioContext>>()
    const [listener, setListener] = useState<Nullable<Listener>>()
    const [audioFiles, setAudioFiles] = useState<AudioBuffer[]>([])
    
    useEffect(() => {
        setAudioContext(new AudioContext())
        setListener(new Listener())
        if (!isDefined(listener) || !isDefined(audioContext)) return
        listener.audioContext = audioContext
        fetch('/test_assets/87778__marcgascon7__vocals.wav')
        .then(response => {
            return response.arrayBuffer()
        })
        .then(buffer => {
            // if (!isDefined(audioContext)) return false
            audioContext.decodeAudioData(buffer, decoded => {
                audioFiles.push(decoded)
            })
            doTheThing()
        })
    }, [])

    function doTheThing() {
        const audioBufferSourceNode = audioContext!.createBufferSource()
        if (!isDefined(audioBufferSourceNode)) return;
        if (!isDefined(listener)) return;

        audioBufferSourceNode.buffer = audioFiles[0]
        audioBufferSourceNode.loop = false
        audioBufferSourceNode.connect(audioContext!.destination)
        listener.mediaStreamSource = audioBufferSourceNode
        console.log(listener)
        listener.startListening()
        audioBufferSourceNode.start()
    }

    return (
        <ClientOnly>
            <div>
                <h1>Tests</h1>
            </div>
        </ClientOnly>
    )
}
