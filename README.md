# Car-FS

**Car-FS** is a browser-based flight simulator inspired by **Geo-FS**, with keyboard flight controls, a 3D globe, terrain, and cockpit and external camera views. The project does not display advertisements.

---

## Software Engineering

**Car-FS** has a simple structure. The main directory—named **geofs-edu**, reflecting its educational inspiration—is subdivided into three subdirectories: **assets**, **css**, and **js**. Additionally, there is an **index.html** file, which serves as the entry point for the web application.

- The **assets** folder contains the aircraft models used in the game. Attribution and the Apache-2.0 license for the Cesium Air and Cesium Drone sample models are in `geofs-edu/assets/ATTRIBUTION.md` and `geofs-edu/assets/CESIUM-LICENSE.md`.
- The **css** folder contains the **style.css** file, which handles the styling—such as the vibrant colors used for collision alerts and the display of essential flight information.
- Finally, the **js** folder houses the core logic, including calculations, camera viewpoints, atmospheric physics, cockpit visuals, and the integration of the 3D globe.

The map uses OpenStreetMap tiles and the globe's attribution remains visible. Cesium World Terrain requires a valid Cesium ion access token; without one, the simulator still opens with the map but uses a flat globe.

## Technologies

- HTML5
- CSS3
- JavaScript
- Vercel
- CesiumJS
