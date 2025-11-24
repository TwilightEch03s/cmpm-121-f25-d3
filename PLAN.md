# D3: {game title goes here}

## Game Design Vision

{a few-sentence description of the game mechanics}

## Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

## Assignments

## D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Can you assemble a map-based user interface using the Leaflet mapping framework?

Key gameplay challenge: Can players collect and craft tokens from nearby locations to finally make one of sufficiently high value?

### Steps

- [x] copy main.ts to reference.ts for future reference
- [x] delete everything in main.ts
- [x] put a basic leaflet map on the screen
- [x] draw the player's location on the map
- [x] draw a rectangle representing one cell on the map
- [x] use loops to draw a whole grid of cells on the map
- [x] give cells cache using luck() and when clicked anywhere on the map, it displays it
- [x] collect: player can collect tokens from nearby cells, removing them from the cell’s cache
- [x] double: let the player craft two identical tokens to create one token of double the value
- [x] add in labels to track what cell is what value
- [x] refactor code so no repeated functions are used
- [x] set anchor point for the map at (0,0)
- [x] make player move using a top-down movement system
- [x] implement spawn and despawn cells so the player can infinitly encounter the the entire grid
- [x] add a score threshold that the player must reach, once reach tell the player they won!
- [x] add player movement UI
- [x] clean up and refactor before finishing d3.b
- [x] apply flyweight pattern to save memory of the cells
- [x] apply memento pattern to perserve the state of the cells
- [x] clean and refactor
- [x] integrate browser geolocation API for location based movement
- [x] implement player movement using the Facade pattern
- [x] add browser localStorage API for game state to save
- [x] add buton to start new game
- [x] add buton that switches between buttons and geolocation
- [x] make it work on mobile
- [ ] clean and refactor
