import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

// Create basic UI elements
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
statusPanelDiv.innerText = "No Cell Selected!";
document.body.append(statusPanelDiv);

const highScoreDiv = document.createElement("div");
highScoreDiv.id = "highScorePanel";
highScoreDiv.innerText = "Highest Value: 0";
document.body.insertBefore(highScoreDiv, statusPanelDiv);

// Pinpoint location
const WOLRD_LATLNG = leaflet.latLng(
  0,
  0,
);

// Gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const COLLECTION_RADIUS = 50; // meters
let playerToken: number | null = null;
let previousCell: {
  i: number;
  j: number;
  value: number;
  rect: leaflet.Rectangle;
  label: leaflet.Marker;
} | null = null;

// Create the map
const map = leaflet.map(mapDiv, {
  center: WOLRD_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Player
// Add a marker to represent the player
const playerMarker = leaflet.marker(WOLRD_LATLNG);
playerMarker.bindTooltip("Your Location!");
playerMarker.addTo(map);

// Player Movement
let latitude = WOLRD_LATLNG.lat;
let longitude = WOLRD_LATLNG.lng;
const step = TILE_DEGREES * 1;

// Arrow control container
const arrowContainer = document.createElement("div");
arrowContainer.id = "arrowControls";
document.body.append(arrowContainer);

const directions = [
  {
    key: "up",
    label: "↑",
    move: () => {
      latitude += step;
    },
  },
  {
    key: "down",
    label: "↓",
    move: () => {
      latitude -= step;
    },
  },
  {
    key: "left",
    label: "←",
    move: () => {
      longitude -= step;
    },
  },
  {
    key: "right",
    label: "→",
    move: () => {
      longitude += step;
    },
  },
];

directions.forEach((dir) => {
  const btn = document.createElement("button");
  btn.innerText = dir.label;
  btn.id = dir.key;
  btn.addEventListener("click", () => movePlayer(dir.move));
  arrowContainer.appendChild(btn);
});

// Move player function
function movePlayer(moveFn: () => void) {
  moveFn();
  const newPos = leaflet.latLng(latitude, longitude);
  playerMarker.setLatLng(newPos);
  playerRangeCircle.setLatLng(newPos);
  map.panTo(newPos);
  updateVisibleCells();
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  let moved = false;

  if (key == "w") {
    // North
    latitude += step;
    moved = true;
  } else if (key == "s") {
    // South
    latitude -= step;
    moved = true;
  } else if (key == "a") {
    // West
    longitude -= step;
    moved = true;
  } else if (key == "d") {
    // East
    longitude += step;
    moved = true;
  }

  if (moved) {
    const newPos = leaflet.latLng(latitude, longitude);
    playerMarker.setLatLng(newPos);
    playerRangeCircle.setLatLng(newPos);
    map.panTo(newPos);
  }
});

// Draw a circle showing the player's range
const playerRangeCircle = leaflet.circle(WOLRD_LATLNG, {
  radius: COLLECTION_RADIUS,
  color: "blue",
  fillColor: "blue",
  fillOpacity: 0.1,
});
playerRangeCircle.addTo(map);

// Cell cache/data
const cellCache: Record<string, number> = {};
const cellLabels: Record<string, leaflet.Marker> = {};
const cellGroup = leaflet.featureGroup().addTo(map);
let highestValue = 0;
const VALUE_THRESHOLD = 2048;

// Update highest value
function updateHighestValue(newValue: number) {
  if (newValue > highestValue) {
    highestValue = newValue;
    highScoreDiv.innerText = `Highest Value: ${highestValue}`;

    if (highestValue >= VALUE_THRESHOLD) {
      displayDistanceStatus(
        `🏆 2048 reached! ${highestValue} ≥ ${VALUE_THRESHOLD}`,
      );
      alert("🏆 Congratulations!");
    }
  }
}

// Helper functions
function isTooFar(distance: number) {
  return distance > COLLECTION_RADIUS;
}

function displayDistanceStatus(message: string) {
  statusPanelDiv.innerText = message;
}

function setCell(i: number, j: number, value: number) {
  cellCache[`${i},${j}`] = value;
  updateCellLabel(i, j, value);
  updateHighestValue(value);
}

function updateRectStyle(
  rect: leaflet.Rectangle,
  fillColor: string,
  opacity: number,
) {
  rect.setStyle({ fillColor, color: fillColor, fillOpacity: opacity });
}

// Update or create a label showing the value on the map
function updateCellLabel(i: number, j: number, value: number) {
  const origin = WOLRD_LATLNG;
  const key = `${i},${j}`;
  const lat = origin.lat + (i + 0.5) * TILE_DEGREES;
  const lng = origin.lng + (j + 0.5) * TILE_DEGREES;

  const existingLabel = cellLabels[key];
  if (existingLabel) {
    existingLabel.setIcon(
      leaflet.divIcon({
        className: "cell-label",
        html: value > 0
          ? `<div style="font-size:12px;font-weight:bold;color:black;">${value}</div>`
          : "",
      }),
    );
  } else {
    const label = leaflet.marker([lat, lng], {
      icon: leaflet.divIcon({
        className: "cell-label",
        html: value > 0
          ? `<div style="font-size:12px;font-weight:bold;color:black;">${value}</div>`
          : "",
      }),
      interactive: false,
    });
    label.addTo(cellGroup);
    cellLabels[key] = label;
  }
}

// Collect tokens function
function collectToken(
  i: number,
  j: number,
  rect: leaflet.Rectangle,
  value: number,
  distance: number,
  label: leaflet.Marker,
) {
  if (isTooFar(distance)) {
    displayDistanceStatus(`Too far! (${Math.round(distance)}m)`);
    return;
  }

  // If already holding a token, return previous into its original cell
  if (playerToken !== null && previousCell) {
    const { i: pi, j: pj, rect: prevRect, value: prevValue, label: prevLabel } =
      previousCell;
    setCell(pi, pj, prevValue);
    updateRectStyle(prevRect, "gold", 0.6);
    prevRect.bindPopup(() => makePopup(pi, pj, prevRect, prevValue, prevLabel));
  }

  // Collect the new token
  playerToken = value;
  previousCell = { i, j, rect, value, label };
  displayDistanceStatus(`Holding: Cell [${i}, ${j}] → Value: ${playerToken}`);

  // Remove token visually
  setCell(i, j, 0);
  updateRectStyle(rect, "white", 0.2);
  rect.unbindPopup();
}

// Doubling token function
function doubleToken(
  i: number,
  j: number,
  rect: leaflet.Rectangle,
  value: number,
  distance: number,
  label: leaflet.Marker,
) {
  if (isTooFar(distance)) {
    displayDistanceStatus(`Too far! (${Math.round(distance)}m)`);
    return;
  }

  const newValue = value * 2;
  setCell(i, j, newValue);
  updateRectStyle(rect, "orange", 0.7);
  rect.unbindPopup();
  rect.bindPopup(() => makePopup(i, j, rect, newValue, label));

  playerToken = null;
  previousCell = null;

  displayDistanceStatus(`Double: Cell [${i}, ${j}] → Value: ${newValue}`);
}

// Popup Function
function makePopup(
  i: number,
  j: number,
  rect: leaflet.Rectangle,
  value: number,
  label: leaflet.Marker,
) {
  const popupDiv = document.createElement("div");
  popupDiv.innerHTML = `
    <div>Cell [${i}, ${j}] has token value: <span id="value">${value}</span></div>
    <button id="collect">Collect</button>
    <button id="double">Double</button>
  `;

  const collectButton = popupDiv.querySelector<HTMLButtonElement>("#collect")!;
  const doubleButton = popupDiv.querySelector<HTMLButtonElement>("#double")!;
  const cellCenter = rect.getBounds().getCenter();
  const distance = map.distance(playerMarker.getLatLng(), cellCenter);

  // Disable button parameters
  if (isTooFar(distance)) {
    collectButton.disabled = true;
    collectButton.innerText = `Too Far! (${Math.round(distance)}m)`;
    doubleButton.disabled = true;
    doubleButton.innerText = `Too Far! (${Math.round(distance)}m)`;
  } else if (playerToken == null) {
    doubleButton.disabled = true;
    doubleButton.innerText = "No Token to Double!";
  } else if (playerToken !== value) {
    doubleButton.disabled = true;
    doubleButton.innerText = `Invalid Double!`;
  }

  collectButton.addEventListener("click", () => {
    collectToken(i, j, rect, value, distance, label);
  });

  doubleButton.addEventListener("click", () => {
    doubleToken(i, j, rect, value, distance, label);
  });

  return popupDiv;
}

// Function to spawn one rectangle (cache)
function spawnCache(i: number, j: number) {
  const origin = WOLRD_LATLNG;

  // Calculate rectangle corners
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Generate token value
  let value = Math.floor(luck(`${i},${j}`) * 10);
  if (value === 3) value = 0;

  let fillColor = "white";
  let fillOpacity = 0.4;

  // Only gold tiles get label, popup, and highlighted style
  if (value >= 1 && value <= 4) {
    fillColor = "gold";
    fillOpacity = 0.6;
    setCell(i, j, value);
  }

  // Create the rectangle and add to map
  const rect = leaflet.rectangle(bounds, {
    color: fillColor,
    fillColor,
    fillOpacity,
  }).addTo(cellGroup);

  if (value >= 1 && value <= 4) {
    const label = cellLabels[`${i},${j}`];
    rect.bindPopup(() => makePopup(i, j, rect, value, label));
  }
}

// Update visable cells on the map
function updateVisibleCells() {
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  const { i: iMin, j: jMin } = conversion(sw.lat, sw.lng);
  const { i: iMax, j: jMax } = conversion(ne.lat, ne.lng);

  // Clear all old cells and labels
  cellGroup.clearLayers();
  Object.keys(cellCache).forEach((k) => delete cellCache[k]);
  Object.keys(cellLabels).forEach((k) => delete cellLabels[k]);

  // Rebuild only visible cells
  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      spawnCache(i, j);
    }
  }
}

// Convert lag/lng to cell indices
function conversion(lat: number, lng: number) {
  const origin = WOLRD_LATLNG;
  const i = Math.floor((lat - origin.lat) / TILE_DEGREES);
  const j = Math.floor((lng - origin.lng) / TILE_DEGREES);
  return { i, j };
}

// Show visable cells
updateVisibleCells();
map.on("moveend", updateVisibleCells);
document.addEventListener("keydown", () => {
  updateVisibleCells();
});
