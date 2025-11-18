import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

// Cell data interface
interface CellData {
  i: number;
  j: number;
  hasToken: boolean;
  tokenValue: number | null;
  rect: leaflet.Rectangle;
  label: leaflet.Marker;
}

// Cell values
interface CellValue {
  hasToken: boolean;
  tokenValue: number | null;
}

const grid: Map<string, CellData> = new Map();
const cellRects: Map<string, leaflet.Rectangle> = new Map();
const cellLabelsMap: Map<string, leaflet.Marker> = new Map();

// Constants
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const COLLECTION_RADIUS = 50; // In meters
const WORLD_LATLNG = leaflet.latLng(0, 0); // Center of the world
const VALUE_THRESHOLD = 2048;

// Player states
let latitude = WORLD_LATLNG.lat;
let longitude = WORLD_LATLNG.lng;
let highestValue = 0;
let movingNorth = false;
let movingSouth = false;
let movingEast = false;
let movingWest = false;
const step = TILE_DEGREES * 1;
let playerToken: number | null = null;
let previousCell: CellData | null = null;

//
// Helper/Utility functions
//
// Check if distance is too far
function isTooFar(distance: number) {
  return distance > COLLECTION_RADIUS;
}

// Display distance status
function displayDistanceStatus(message: string) {
  statusPanelDiv.innerText = message;
}

// Set cell value in cache and update label
function setCell(i: number, j: number, value: number) {
  cellCache[`${i},${j}`] = value;
  updateCellLabel(i, j, value);
  updateHighestValue(value);
}

// Update rectangle style
function updateRectStyle(
  rect: leaflet.Rectangle,
  fillColor: string,
  opacity: number,
) {
  rect.setStyle({ fillColor, color: fillColor, fillOpacity: opacity });
}

// Convert lag/lng to cell indices
function conversion(lat: number, lng: number) {
  const origin = WORLD_LATLNG;
  const i = Math.floor((lat - origin.lat) / TILE_DEGREES);
  const j = Math.floor((lng - origin.lng) / TILE_DEGREES);
  return { i, j };
}

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

// Create the map
const map = leaflet.map(mapDiv, {
  center: WORLD_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

//
// Player
//
// Add a marker to represent the player
const playerMarker = leaflet.marker(WORLD_LATLNG);
playerMarker.bindTooltip("Your Location!");
playerMarker.addTo(map);

// Draw a circle showing the player's range
const playerRangeCircle = leaflet.circle(WORLD_LATLNG, {
  radius: COLLECTION_RADIUS,
  color: "blue",
  fillColor: "blue",
  fillOpacity: 0.1,
});
playerRangeCircle.addTo(map);

// Arrow controls container
const arrowContainer = document.createElement("div");
arrowContainer.id = "arrowControls";
document.body.append(arrowContainer);

// Central movement function using booleans
function movePlayerByDirection() {
  if (movingNorth) {
    latitude += step;
  }
  if (movingSouth) {
    latitude -= step;
  }
  if (movingEast) {
    longitude += step;
  }
  if (movingWest) {
    longitude -= step;
  }

  const newPos = leaflet.latLng(latitude, longitude);
  playerMarker.setLatLng(newPos);
  playerRangeCircle.setLatLng(newPos);
  map.panTo(newPos);
  updateVisibleCells();
}

// Arrow buttons
const directions = [
  { key: "up", label: "↑" },
  { key: "down", label: "↓" },
  { key: "left", label: "←" },
  { key: "right", label: "→" },
];

directions.forEach((dir) => {
  const btn = document.createElement("button");
  btn.innerText = dir.label;
  btn.id = dir.key;

  // Mouse down = start moving
  btn.addEventListener("mousedown", () => {
    if (dir.key === "up") movingNorth = true;
    if (dir.key === "down") movingSouth = true;
    if (dir.key === "left") movingWest = true;
    if (dir.key === "right") movingEast = true;

    movePlayerByDirection();
  });

  // Mouse up = stop moving
  btn.addEventListener("mouseup", () => {
    if (dir.key === "up") movingNorth = false;
    if (dir.key === "down") movingSouth = false;
    if (dir.key === "left") movingWest = false;
    if (dir.key === "right") movingEast = false;
  });

  arrowContainer.appendChild(btn);
});

// Keyboard controls
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "w" || key === "arrowup") movingNorth = true;
  if (key === "s" || key === "arrowdown") movingSouth = true;
  if (key === "a" || key === "arrowleft") movingWest = true;
  if (key === "d" || key === "arrowright") movingEast = true;

  movePlayerByDirection();
});

document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key === "w" || key === "arrowup") movingNorth = false;
  if (key === "s" || key === "arrowdown") movingSouth = false;
  if (key === "a" || key === "arrowleft") movingWest = false;
  if (key === "d" || key === "arrowright") movingEast = false;
});

// Cell cache/data
const cellCache: Record<string, number> = {};
const cellLabels: Record<string, leaflet.Marker> = {};
const cellGroup = leaflet.featureGroup().addTo(map);

// Update highest value
function updateHighestValue(newValue: number) {
  if (newValue > highestValue) {
    highestValue = newValue;
    highScoreDiv.innerText = `Highest Value: ${highestValue}`;

    if (highestValue >= VALUE_THRESHOLD) {
      alert("🏆 Congratulations!");
    }
  }
}

// Update or create a label showing the value on the map
function updateCellLabel(i: number, j: number, value: number) {
  const key = `${i},${j}`;
  const existingLabel = cellLabels[key];

  if (value > 0) {
    const origin = WORLD_LATLNG;
    const lat = origin.lat + (i + 0.5) * TILE_DEGREES;
    const lng = origin.lng + (j + 0.5) * TILE_DEGREES;

    if (existingLabel) {
      existingLabel.setIcon(
        leaflet.divIcon({
          className: "cell-label",
          html:
            `<div style="font-size:12px;font-weight:bold;color:black;">${value}</div>`,
        }),
      );
    } else {
      const label = leaflet.marker([lat, lng], {
        icon: leaflet.divIcon({
          className: "cell-label",
          html:
            `<div style="font-size:12px;font-weight:bold;color:black;">${value}</div>`,
        }),
        interactive: false,
      }).addTo(cellGroup);
      cellLabels[key] = label;
    }
  } else {
    // Remove the label completely if value is 0
    if (existingLabel) {
      map.removeLayer(existingLabel);
      delete cellLabels[key];
    }
  }
}

// Collect tokens function
function collectToken(
  i: number,
  j: number,
  rect: leaflet.Rectangle,
) {
  const key = `${i},${j}`;
  const cell = grid.get(key);
  if (!cell || !cell.hasToken) return;

  // Save before modifying
  modifiedCells.save(key, cell);

  // Return previous token
  if (playerToken !== null && previousCell) {
    const prevKey = `${previousCell.i},${previousCell.j}`;
    const prevCell = grid.get(prevKey)!;
    modifiedCells.save(prevKey, prevCell);
    prevCell.hasToken = true;
    prevCell.tokenValue = previousCell.tokenValue;
    updateRectStyle(prevCell.rect, "gold", 0.6);
    prevCell.rect.bindPopup(() =>
      makePopup(
        prevCell.i,
        prevCell.j,
        prevCell.rect,
        prevCell.tokenValue!,
        prevCell.label,
      )
    );
  }

  // Pick up new token
  playerToken = cell.tokenValue;
  previousCell = { ...cell };
  displayDistanceStatus(`Holding: Cell [${i}, ${j}] → Value: ${playerToken}`);

  cell.hasToken = false;
  cell.tokenValue = null;

  setCell(i, j, 0);
  updateRectStyle(rect, "white", 0.2);
}

// Doubling token function
function doubleToken(
  i: number,
  j: number,
  rect: leaflet.Rectangle,
  label: leaflet.Marker,
) {
  const key = `${i},${j}`;
  const cell = grid.get(key);
  if (!cell || cell.tokenValue === null) return;
  modifiedCells.save(key, cell);
  const newValue = cell.tokenValue * 2;
  cell.tokenValue = newValue;
  setCell(i, j, newValue);
  updateRectStyle(rect, "orange", 0.7);

  // Re-bind popup
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
    collectToken(i, j, rect);
  });

  doubleButton.addEventListener("click", () => {
    doubleToken(i, j, rect, label);
  });

  return popupDiv;
}

// Memento stores only the mutable gameplay state
class CellMemento {
  hasToken: boolean;
  tokenValue: number | null;

  constructor(cell: CellData) {
    this.hasToken = cell.hasToken;
    this.tokenValue = cell.tokenValue;
  }
}

// Caretaker for modified cells
class ModifiedCells {
  private mementos: Map<string, CellMemento> = new Map();

  save(cellID: string, cell: CellData) {
    this.mementos.set(cellID, new CellMemento(cell));
  }

  restore(cellID: string): CellValue | null {
    const memento = this.mementos.get(cellID);
    if (!memento) return null;
    return {
      hasToken: memento.hasToken,
      tokenValue: memento.tokenValue,
    };
  }
}

const modifiedCells = new ModifiedCells();

// Function to spawn one rectangle (cache)
// Flywheel-style spawnCache
function spawnCache(i: number, j: number) {
  const key = `${i},${j}`;
  const origin = WORLD_LATLNG;

  // Declare only once
  let value: number;
  let hasToken: boolean;

  // If cell exists
  if (grid.has(key)) {
    const cell = grid.get(key)!;
    const rect = cellRects.get(key)!;
    const label = cellLabelsMap.get(key)!;
    value = cell.tokenValue ?? 0; // assign, not declare
    hasToken = value > 0;
    setCell(i, j, value);
    updateRectStyle(rect, hasToken ? "gold" : "white", hasToken ? 0.6 : 0.2);
    rect.bindPopup(() => makePopup(i, j, rect, value, label));
    return;
  }

  // Check if we have a saved memento
  const saved = modifiedCells.restore(key);
  if (saved) {
    hasToken = saved.hasToken;
    value = saved.tokenValue ?? 0;
  } else {
    value = Math.floor(luck(`${i},${j}`) * 10);
    if (value === 3) value = 0;
    hasToken = value >= 1 && value <= 4;
  }

  // Calculate rectangle corners
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  // Rectangle style
  const fillColor = hasToken ? "gold" : "white";
  const fillOpacity = hasToken ? 0.6 : 0.2;

  // Create rectangle and label
  const rect = leaflet.rectangle(bounds, {
    color: fillColor,
    fillColor,
    fillOpacity,
  }).addTo(cellGroup);
  const label = leaflet.marker(bounds.getCenter(), {
    icon: leaflet.divIcon({
      className: "cell-label",
      html: hasToken
        ? `<div style="font-size:12px;font-weight:bold;color:black;">${value}</div>`
        : "",
    }),
    interactive: false,
  }).addTo(cellGroup);

  // Save to flywheel maps
  grid.set(key, {
    i,
    j,
    hasToken,
    tokenValue: hasToken ? value : null,
    rect,
    label,
  });
  cellRects.set(key, rect);
  cellLabelsMap.set(key, label);

  // Bind popup only if cell has a token
  if (hasToken) {
    rect.bindPopup(() => makePopup(i, j, rect, value, label));
  }
}

// Show visible cells
function updateVisibleCells() {
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const { i: iMin, j: jMin } = conversion(sw.lat, sw.lng);
  const { i: iMax, j: jMax } = conversion(ne.lat, ne.lng);

  const visibleCells = new Set<string>();

  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const key = `${i},${j}`;
      visibleCells.add(key);
      spawnCache(i, j);
    }
  }

  // Remove cells that are no longer visible
  for (const key of grid.keys()) {
    if (!visibleCells.has(key)) {
      const cell = grid.get(key)!;
      modifiedCells.save(key, cell);
      map.removeLayer(cell.rect);
      map.removeLayer(cell.label);
      cellRects.delete(key);
      cellLabelsMap.delete(key);
      grid.delete(key);
    }
  }
}
