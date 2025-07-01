'use client'

import Listener from "@/app/classes/Listener";
import { isDefined } from "@/app/miscTools";
import { Nullable } from "@/types/types";
import { ClientOnly } from "@bkwld/next-client-only";
import { useEffect, useState } from "react";

export default function Tests() {
    let [audioContext, setAudioContext] = useState<AudioContext>()
    const [listener, setListener] = useState<Listener>()
    const [audioFiles, setAudioFiles] = useState<AudioBuffer[]>([])
    
    useEffect(() => {
        setAudioContext(new AudioContext())
        setListener(new Listener())
    }, [])

    useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listener, audioContext])

    function doTheThing() {
        if (!isDefined(listener) || !isDefined(audioContext)) return
        debugger
        const audioBufferSourceNode = audioContext.createBufferSource()
        audioBufferSourceNode.buffer = audioFiles[0]
        audioBufferSourceNode.loop = false
        audioBufferSourceNode.connect(audioContext.destination)
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
