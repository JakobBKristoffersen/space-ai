/**
 * Briefings.ts
 * Story text for missions.
 */

export const Briefings: Record<string, string> = {
    // Tier 0
    "bootstrap_hop": "Welcome to the Toy Planet Space Automation Agency! We have a rocket, a field, and a severe lack of safety regulations. Let's see if your code can survive a mild sneeze from gravity. Reach 100m without exploding immediately.",
    "bootstrap_high": "The previous launch was surprisingly non-fatal. Management is impressed. Now, let's try to actually scare the birds. Go higher.",

    // Tier 1
    "atmo_space": "Congratulations! You have found the top of the sky. It is very empty and cold. Science demands we go there. Reach 10km altitude to officially leave the atmosphere.",
    "atmo_data": "The air gets thin up there. We need hard data, not just pilot anecdotes. send us a detailed atmospheric profile packet before you crash.",

    // Tier 2: Orbital
    "orbit_first": "What goes up usually comes down. We would like to stop that. Achieving a stable orbit is the first step towards domination... I mean, exploration. Make sure your accumulated velocity is sideways enough.",
    "orbit_sat": "Empty orbits are boring. We built this expensive CubeSat Deployer and it's gathering dust. Launch it and leave something behind that beeps.",

    // Tier 3: Network
    "relay_basic": "Our pilots are complaining about 'loss of signal' and 'crippling existential dread' when on the dark side of the planet. Establishing a relay network might shut them up.",

    // Tier 4: Lunar
    "luna_flyby": "That big gray rock in the sky is mocking us. It thinks we can't reach it. Prove it wrong. A simple flyby will suffice for now.",
};
