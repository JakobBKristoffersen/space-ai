class o{static instance;pyodide=null;loadPromise=null;constructor(){}static getInstance(){return o.instance||(o.instance=new o),o.instance}async init(){if(!this.pyodide)return this.loadPromise?this.loadPromise:(this.loadPromise=(async()=>{window.loadPyodide||await new Promise((i,e)=>{const t=document.createElement("script");t.src="https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js",t.onload=()=>i(),t.onerror=()=>e(new Error("Failed to load Pyodide script")),document.body.appendChild(t)}),this.pyodide=await window.loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"}),await this.pyodide.runPythonAsync(`
import sys
from types import ModuleType

# Create virtual module
m = ModuleType("rocket_api")
sys.modules["rocket_api"] = m

# Define RocketAPI class stub
class RocketAPI:
    pass

m.RocketAPI = RocketAPI
      `),console.log("Pyodide loaded")})(),this.loadPromise)}async prepareScript(i){await this.init();const e=this.pyodide.toPy({});try{await this.pyodide.runPythonAsync(i,{globals:e});const t=e.get("update");if(!t||!this.pyodide.isPyProxy(t))throw new Error("Python script must define a function 'update(api)'");return s=>{t(s)}}catch(t){throw e.destroy(),t}}}export{o as PyodideService};
