# Car-FS

**Car-FS** is an online flight simulator that runs directly in your web browser, with no downloads or installations required. Inspired by the popular **Geo-FS**, it was built with a fully open-source spirit at its core.

The concept is simple and straightforward: the project imports a JavaScript package featuring a 3D model of the entire Earth and renders the environment smoothly at a consistent **60 FPS**. Hosted on Vercel, it lets you take off right away from any modern web browser without any hassle.

## How the Project is Organized

The architecture of **Car-FS** was designed to be clean and easy to navigate. The root directory is named **geofs-edu**, a nod to its educational purpose, and starts with **index.html**, which serves as the entry point for the application. From there, everything is organized into three main folders:

* **assets:** This is where the 3D aircraft models live. To bring the simulator to life, these models were gathered from other open-source GitHub repositories and free community resources online.
* **css:** Holds the **style.css** file, which handles the visual side of the interface. It takes care of everything from displaying essential flight data clearly to lighting up the screen with vibrant colors during collision alerts.
* **js:** The true brain behind the simulator. This folder houses all the math calculations, camera viewpoints, 3D globe integration, and atmospheric physics, such as how an aircraft naturally gains speed when pitching its nose downward.

## Technologies Used
* HTML5
* CSS3
* JavaScript
* Vercel
