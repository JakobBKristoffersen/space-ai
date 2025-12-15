import { RocketAPI } from "../scripting/RocketAPI";

declare global {
    interface Window {
        loadPyodide: (config: { indexURL: string }) => Promise<any>;
    }
}

/**
 * Singleton service to manage the Pyodide Python environment.
 */
export class PyodideService {
    private static instance: PyodideService;
    private pyodide: any = null;
    private loadPromise: Promise<void> | null = null;

    private constructor() { }

    static getInstance(): PyodideService {
        if (!PyodideService.instance) {
            PyodideService.instance = new PyodideService();
        }
        return PyodideService.instance;
    }

    /**
     * Initializes Pyodide. Idempotent.
     */
    async init(): Promise<void> {
        if (this.pyodide) return;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            // Load the script tag if not present
            if (!window.loadPyodide) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement("script");
                    script.src = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js";
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error("Failed to load Pyodide script"));
                    document.body.appendChild(script);
                });
            }

            this.pyodide = await window.loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
            });

            // Synthesize rocket_api module
            await this.pyodide.runPythonAsync(`
import sys
from types import ModuleType

# Create virtual module
m = ModuleType("rocket_api")
sys.modules["rocket_api"] = m

# Define RocketAPI class stub
class RocketAPI:
    pass

m.RocketAPI = RocketAPI
      `);

            console.log("Pyodide loaded");
        })();

        return this.loadPromise;
    }

    /**
     * runs a python script that defines `def update(api): ...`.
     * Returns a JS function that calls the Python update function.
     */
    async prepareScript(code: string): Promise<(api: RocketAPI) => void> {
        await this.init();

        // Reset globals or use a separate scope? 
        // Pyodide globals are persistent. We can use a dictionary as globals for isolation.
        // However, `api` needs to be passed in.

        // We wrap the user code.
        // We expect the user code to define `update(api)`.

        // Create a fresh dictionary for the script execution to avoid pollution
        const globals = this.pyodide.toPy({});

        try {
            // Execute the user code in the fresh bucket
            await this.pyodide.runPythonAsync(code, { globals });

            const updateFn = globals.get("update");
            if (!updateFn || !this.pyodide.isPyProxy(updateFn)) {
                throw new Error("Python script must define a function 'update(api)'");
            }

            return (api: RocketAPI) => {
                // We pass the API. Pyodide automatically proxies JS objects.
                // RocketAPI methods should work directly.
                // However, we might need to be careful about `this` context if methods are unbound.
                // RocketAPI methods seem to be bound or use arrow functions? 
                // Checking RocketAPI.ts... methods like `log` are methods on the class.
                // When passed to Python, `api.log("foo")` works.
                updateFn(api);
            };
        } catch (e: any) {
            // Clean up if possible
            globals.destroy();
            throw e;
        }
    }
}
