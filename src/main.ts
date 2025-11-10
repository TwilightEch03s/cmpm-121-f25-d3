import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
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
statusPanelDiv.innerText = "Zero tokens Implemented";
document.body.append(statusPanelDiv);

// Pinpoint classroom location
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const GRID_SIZE = 24;
const COLLECTION_RADIUS = 50; // meters
let playerToken: number | null = null;
let previousCell: {
  i: number;
  j: number;
  value: number;
  rect: leaflet.Rectangle;
} | null = null;

// Create the map
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
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

// Add a marker to represent the player
const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
playerMarker.bindTooltip("Your Location!");
playerMarker.addTo(map);

// Draw a circle showing the player's range
const playerRangeCircle = leaflet.circle(CLASSROOM_LATLNG, {
  radius: COLLECTION_RADIUS,
  color: "blue",
  fillColor: "blue",
  fillOpacity: 0.1,
});
playerRangeCircle.addTo(map);

// Cell cache/data
const cellCache: Record<string, number> = {};

// Collect tokens function
function collectToken(
  i: number,
  j: number,
  rect: leaflet.Rectangle,
  value: number,
  distance: number,
) {
  if (distance > COLLECTION_RADIUS) {
    statusPanelDiv.innerText = `Too far! (${Math.round(distance)}m)`;
    return;
  }

  // If already holding a token, return previous into its original cell
  if (playerToken !== null && previousCell) {
    const { i: pi, j: pj, rect: prevRect, value: prevValue } = previousCell;
    cellCache[`${pi},${pj}`] = prevValue;
    prevRect.setStyle({
      fillColor: "gold",
      color: "gold",
      fillOpacity: 0.6,
    });
    prevRect.bindPopup(() => makePopup(pi, pj, prevRect, prevValue));
  }

  // Collect the new token
  playerToken = value;
  previousCell = { i, j, rect, value };
  statusPanelDiv.innerText =
    `Holding: Cell [${i}, ${j}] → Value: ${playerToken}`;

  // Remove token visually
  cellCache[`${i},${j}`] = 0;
  rect.setStyle({ fillColor: "white", color: "white", fillOpacity: 0.2 });
  rect.unbindPopup();
}

// Doubling token funciton
function doubleToken(
  i: number,
  j: number,
  rect: leaflet.Rectangle,
  value: number,
  distance: number,
) {
  if (distance > COLLECTION_RADIUS) {
    statusPanelDiv.innerText = `Too far! (${Math.round(distance)}m)`;
    return;
  }

  const newValue = value * 2;
  cellCache[`${i},${j}`] = newValue;
  rect.setStyle({ fillColor: "orange", color: "orange", fillOpacity: 0.7 });
  rect.unbindPopup();
  rect.bindPopup(() => makePopup(i, j, rect, newValue));

  playerToken = null;
  previousCell = null;

  statusPanelDiv.innerText = `Double: Cell [${i}, ${j}] → Value: ${newValue}`;
}

// Popup Function
function makePopup(
  i: number,
  j: number,
  rect: leaflet.Rectangle,
  value: number,
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

  // Disable collect if too far
  if (distance > COLLECTION_RADIUS) {
    collectButton.disabled = true;
    collectButton.innerText = `Too Far! (${Math.round(distance)}m)`;
  }

  // Disable double if can't double
  if (distance > COLLECTION_RADIUS) {
    doubleButton.disabled = true;
    doubleButton.innerText = `Too Far! (${Math.round(distance)}m)`;
  } else if (playerToken === null) {
    doubleButton.disabled = true;
    doubleButton.innerText = "No Token to Double!";
  } else if (playerToken !== value) {
    doubleButton.disabled = true;
    doubleButton.innerText = `Invalid Double, Need:(${playerToken})`;
  }

  collectButton.addEventListener("click", () => {
    collectToken(i, j, rect, value, distance);
  });

  doubleButton.addEventListener("click", () => {
    doubleToken(i, j, rect, value, distance);
  });

  return popupDiv;
}

// Function to spawn one rectangle (cache)
function spawnCache(i: number, j: number) {
  const origin = CLASSROOM_LATLNG;

  // Calculate rectangle corners
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Generate token value
  let value = Math.floor(luck(`${i},${j}`) * 10);
  if (value === 3) value = 0;
  cellCache[`${i},${j}`] = value;

  let fillColor = "white";
  let fillOpacity = 0.4;

  if (value >= 1 && value <= 4) {
    fillColor = "gold";
    fillOpacity = 0.6;
  }

  // Create the rectangle and add to map
  const rect = leaflet.rectangle(bounds, {
    color: fillColor,
    fillColor,
    fillOpacity,
  }).addTo(map);

  if (value >= 1 && value <= 4) {
    rect.bindPopup(() => makePopup(i, j, rect, value));
  }
}

// Use loops to draw the grid
for (let i = -GRID_SIZE; i < GRID_SIZE; i++) {
  for (let j = -GRID_SIZE; j < GRID_SIZE; j++) {
    spawnCache(i, j);
  }
}
