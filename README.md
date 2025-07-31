
# A New Sunrise for Speech Therapy: Development of SoundRise 2.0 Application

![SoundRise Logo](./public/soundRise-presentation.png)

SoundRise is an **educational application** with the aim of assisting people, especially children and adolescents, in their vocal learning journey. Designed to be used as an extra support to a *speech therapy pathway* for young patients with hearing and communication difficulties, making therapeutic exercises accessible anytime, and anywhere, it combines technology and education, with a focus on inclusivity.

The interface includes an animated friendly sun that reflects vocal changes in **real-time**. As users vocalize, the sun wakes up and smiles, and, based on note **pitch**, **intensity**, and **timbre**, changes its *vertical position*, *size*, and *color*. SoundRise leverages voice analysis to create a bridge between abstract vocal concepts and tangible, visual feedback: the sun’s animation mirrors tonal and timbric characteristics of the user's voice, which can build a *mental model* of its voice.

The timbral characteristics of the voice are evaluated according to the **vowels** traits of the **Italian** language. The colors of the sun that correspond to vowels have been selected based on a study of non-random associations between graphemes and colors in synaesthetic and non-synaesthetic populations: it was decided to represent:
-  *A* with *red*; 
-  *E* with *green*;
-  *I* with *blue*;
-  *O* with *orange*;
-  *U* with *gray*.

## Try SoundRise!
Go to [SoundRise Page](https://soundrise-82999.web.app/) and open SoundRise on your device. Explore its features directly from your smartphone, tablet, or computer.


## Feeback

And now it's your turn: **your contribution is invaluable**!

Whether you’re a developer, researcher, or simply a user, let us know your thoughts and advice on SoundRise.

Fill in this Google form to help us improve SoundRise: [SoundRise Feedback Collection](https://forms.gle/R1S2vfRgDT1DWsCW6).

We would love to hear from you for ideas and possible collaboration -- help us build a tool that truly makes a difference!


## Features

-  **Real-time voice recognition:** The app uses an advanced voice recognition system to identify and display vowels spoken by users.
-  **User-friendly interface:** A simple and colorful design, optimized for children, that facilitates interaction.
-  **Multi-device accessibility:** SoundRise can be accessed from any Internet-connected browser on both desktop and mobile devices.

## Used technologies

-  **Web Audio API:** For audio processing and voice recognition.
-  **React:** front-end JavaScript library for creating user interfaces.
-  **Firebase:** Used for deploying and hosting the application.

## Developers... Getting Started!

Before running the application, make sure you have the following dependencies installed:

-  **Node.js** (version >= 24).
You can download it from [Node.js](https://nodejs.org/).
-  **bun**.
Or, alternatively, you can use **yarn** or **pnpm** or **npm**.

Check whether Node.js and npm are installed correctly by running these commands in the terminal:

```bash
node  -v
npm  -v
```

If you want to use yarn or pnpm:

-  **Yarn** or **Pnpm**
You can install it globally by running:

```bash
npm  install  -g  yarn
# or
npm  install  -g  pnpm
```

## Installation

After installing Node.js and npm (or yarn/pnpm), follow these steps to start the application:

1. Clone the repository
2. Enter the project directory
3. Install the dependencies:

```bash
npm  install
# or
yarn  install
# or
pnpm  install
```

4. Start the server:

```bash
npm  run  dev
# ``or
yarn  dev
# or
pnpm  dev
```

5. Open http://localhost:3000 in your browser to view the application.

## License

This project is distributed under the **GNU Affero General Public License v3.0**. For more information, see the full text of the license available at the following link:
[GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.txt)

## Contact us

For more information or questions about the project, you may contact:
-  **Dott.ssa Giada Zuccolo**: [zuccologia@dei.unipd.it](mailto:zuccologiada@gmail.com)
-  **Dott. Andrea Franceschini**: [andrea.franceschini@dei.unipd.it](mailto:andrea.franceschini@dei.unipd.it)
-  **Prof. Sergio Canazza**: [canazza@dei.unipd.it](mailto:canazza@dei.unipd.it)