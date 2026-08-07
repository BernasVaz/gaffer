import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

/*
 * Testing Library unmounts between tests only when it can see a global
 * `afterEach`, and vitest does not expose globals unless asked. Without this the
 * DOM accumulates across a file and every count assertion quietly becomes a
 * multiple of the truth.
 */
afterEach(cleanup);
