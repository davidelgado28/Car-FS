# Car-FS

**Car-FS** is an online flight simulator that runs directly in your web browser. Inspired by **Geo-FS**, it is built with a fully open-source approach. It features straightforward mechanics: it imports a JavaScript package containing a 3D model of the entire Earth, rendering the environment while maintaining a consistent **60 FPS**. It is hosted on Vercel and is compatible with any web browser.

---

## Software Engineering

**Car-FS** has a simple structure. The main directory—named **geofs-edu**, reflecting its educational inspiration—is subdivided into three subdirectories: **assets**, **css**, and **js**. Additionally, there is an **index.html** file, which serves as the entry point for the web application.

- The **assets** folder contains the aircraft models used in the game. Note: These models were sourced from other open-source projects on GitHub, as well as from various free, open-source resources available online.
- The **css** folder contains the **style.css** file, which handles the styling—such as the vibrant colors used for collision alerts and the display of essential flight information.
- Finally, the **js** folder houses the core logic, including calculations, camera viewpoints, atmospheric physics (such as how an aircraft descends and gains speed when its nose is pointed downward), and the integration of the 3D globe.

## Technologies

- HTML5
- CSS3
- JavaScript
- Vercel
