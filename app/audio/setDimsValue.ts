function getCurrentDimension() {
  if (typeof window !== "undefined") {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  } else {
    // Handle the case where window is not available, e.g., provide default values
    return {
      width: 1000,
      height: 1000,
    };
  }
}

/*********************** variable PART ***********************/

const height = getCurrentDimension().height;
const width = getCurrentDimension().width;

const minVol = 2;
const maxVol = 100;

const minPitch = 150;
const maxPitch = 500;

const minRad = 25;
const maxRad = 200;

/*********************** rad PART ***********************/

function setRad(volume: number) {
  if (volume <= minVol) {
    return minRad;
  }
  if (volume >= maxVol) {
    return maxRad;
  }
  return minRad + Math.round((volume * (maxRad - minRad)) / (maxVol - minVol));
}

/*********************** yC PART ***********************/

const usable_height = getCurrentDimension().height - Math.round((getCurrentDimension().height * 30) / 100);

// lowest point = > when pitch <= 100      250
const lowest_pitch = usable_height / 2;
// highest point = > when pitch >= 600    -250
const highest_pitch = -lowest_pitch;

function setPosPitch(pitch: number) {
  if (pitch <= minPitch) {
    return lowest_pitch;
  }
  if (pitch >= maxPitch) {
    return highest_pitch;
  }
  return (
    lowest_pitch -
    Math.round(
      ((pitch - minPitch) * (lowest_pitch - highest_pitch)) /
        (maxPitch - minPitch)
    )
  );
}

/******************** VOWELS ************************ */
function getVocali() {}

// Export the functions to make them accessible in other files
export {
  setRad,
  setPosPitch,
  minVol,
  maxVol,
  minPitch,
  maxPitch,
  minRad,
  height,
  width,
};
