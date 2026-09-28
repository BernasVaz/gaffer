import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { watchForConnection } from "./feedback/submit";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("index.html is missing its #root element");

/*
 * Anything that could not be sent goes out as soon as it can be.
 *
 * Feedback is written on a phone, often on a bad connection, and the note
 * somebody types in a tunnel is exactly the note worth having. Started here
 * rather than in a component so it does not depend on which screen is showing:
 * a tester who flags a moment and closes the tab has still sent it, next time
 * they open the game.
 */
watchForConnection();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
