"use client";
import Header from "@/app/components/Header";
import { minRad, height } from "@/app/audio/setDimsValue";
import SunAwake from "@/app/components/SunAwake";
import Image from "next/image";
import { ClientOnly } from "@bkwld/next-client-only";

export default function Home() {
  return (
    <main className="flex h-screen flex-col text-neutral-content relative">
      {/* Header */}
      <Header />
      {/* Background Wave */}
      <div className="bg-wave absolute bottom-0 w-full h-[355px]"></div>

      {/* Hero Section with Image, Text, and SunAwake Component */}
      <div className="flex flex-col items-center justify-center text-center text-white h-full">
        <ClientOnly><Image
          src="/soundRise-scritta.svg"
          alt="SoundRise Logo"
          height={height/4}
          width={height/4}
          className="mx-auto mt-2"
        /></ClientOnly>
        <h1 className="font-extrabold mb-5 big-title leading-none tracking-tight title-settings">
          A New Sunrise for Speech Therapy:{" "}
          <span className="divisore"></span>Development of{" "}
          <span className="text-yellow-500"> SoundRise 2.0 </span> Application
        </h1>
        <p className="mb-2 leading-none tracking-tight text-small-desc">
          SoundRise is an educational application with the aim of assisting people, especially children and adolescents, in their vocal learning journey. Designed to be used as an extra support to a speech therapy pathway for young patients with hearing and communication difficulties, it combines the worlds of technology and education, with a focus on inclusivity.
          <br /><br />
          A friendly sun represents the tonal and timbral characteristics of the user&apos;s voice. When a vocal is emitted, the sun wakes up and smiles, and, based on note pitch, intensity, and timbre, changes its vertical position, size, and color, all in real time. This visual system helps to understand how one&apos;s voice works.
        </p>
        <div className="relative flex max-h-screen flex-col items-center">
        <SunAwake
          svgColor={"yellow"}
          rad={minRad * 1.5}
          yCoordinate={-10}  // Make the sun more visible
          heightSpaceSun={"20vh"}  // Reduce headroom
        />

        </div>
      </div>

      {/* Footer */}
      <footer className="w-full flex justify-center text-white p-3 bg-black z-10">
        <a
          href="https://www.gnu.org/licenses/agpl-3.0.txt"
          className="text-sm font-mono underline text-gray-300 hover:text-gray-400"
        >
          AGNU Affero General Public License v3.0
        </a>
      </footer>

    </main>
  );
}
