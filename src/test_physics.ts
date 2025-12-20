
// Mock classes to replicate logic
class StandardAtmosphere {
    readonly P0 = 101325;
    readonly T0 = 288.15;
    readonly R = 287.05;
    readonly k: number | undefined;

    constructor(public useHybrid: boolean) {
        if (useHybrid) {
            // cutoff 2000 default?
            const cutoff = 2000;
            this.k = 14 / cutoff;
            // this.L = ... irrelevant for P in hybrid? 
            // Hybrid uses exp for P.
            // Wait, verify Environment.ts logic for Hybrid P.
        }
    }

    getProperties(alt: number) {
        // Hybrid logic copy-paste
        let pressure = 0;
        let T = this.T0; // simplify
        if (this.k) {
            pressure = this.P0 * Math.exp(-this.k * alt);
        } else {
            // Standard
            pressure = 100000; // placeholder
        }
        const density = pressure / (this.R * T);
        return { density, pressure };
    }
}

const atm = new StandardAtmosphere(true);
const p = atm.getProperties(0);
console.log("Alt 0 Density:", p.density);

const rho0 = 1.225;
const rho = p.density;
const rel = Math.max(0, Math.min(1, rho / rho0));
const bonus = 0.25;
const scale = 1 + bonus * (1 - rel);
console.log("Scale:", scale);

const maxThrust = 2000;
const thrust = maxThrust * scale;
console.log("Thrust:", thrust);

const flow = 2.5;
const isp = thrust / (flow * 9.81);
console.log("ISP:", isp);
