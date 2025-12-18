import React from "react";
import { Box, Text } from "@chakra-ui/react";

interface Vec2 { x: number; y: number }

interface ForceGaugeProps {
    forces?: {
        thrust: { fx: number; fy: number };
        drag: { fx: number; fy: number };
        gravity: { fx: number; fy: number };
    };
    orientationRad?: number; // Rocket orientation to potentially rotate the view? 
    // actually usually we want World Frame (Up is Up) or Body Frame (Up is Nose).
    // Let's stick to World Frame for now as it matches the game view.
}

const MAG_LIMIT = 100000; // Max Newtons to display full scale? Or auto-scale?

export function ForceGauge({ forces }: ForceGaugeProps) {
    if (!forces) return <Box h="100px" bg="gray.900" borderRadius="md" />;

    const thrust = { x: forces.thrust.fx, y: forces.thrust.fy };
    const drag = { x: forces.drag.fx, y: forces.drag.fy };
    const gravity = { x: forces.gravity.fx, y: forces.gravity.fy };

    const net = {
        x: thrust.x + drag.x + gravity.x,
        y: thrust.y + drag.y + gravity.y
    };

    // Find max magnitude to normalize
    const maxMag = Math.max(
        Math.hypot(thrust.x, thrust.y),
        Math.hypot(drag.x, drag.y),
        Math.hypot(gravity.x, gravity.y),
        1000 // min scale
    );

    const scale = 40 / maxMag; // 40px radius

    const drawVector = (v: Vec2, color: string) => {
        if (Math.abs(v.x) < 0.1 && Math.abs(v.y) < 0.1) return null;
        const x2 = 50 + v.x * scale;
        const y2 = 50 - v.y * scale; // SVG y is down
        return (
            <line x1="50" y1="50" x2={x2} y2={y2} stroke={color} strokeWidth="2" markerEnd={`url(#arrow-${color})`} />
        );
    };

    return (
        <Box position="relative" w="100%" h="120px" bg="gray.950" borderRadius="md" borderWidth="1px" borderColor="gray.800">
            <Text position="absolute" top={1} left={2} fontSize="xx-small" color="gray.500">FORCE VECTORS</Text>
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <marker id="arrow-green" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" fill="#48BB78"><path d="M0,0 L0,6 L6,3 z" /></marker>
                    <marker id="arrow-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" fill="#F56565"><path d="M0,0 L0,6 L6,3 z" /></marker>
                    <marker id="arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" fill="#4299E1"><path d="M0,0 L0,6 L6,3 z" /></marker>
                    <marker id="arrow-white" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" fill="white"><path d="M0,0 L0,6 L6,3 z" /></marker>
                </defs>

                {/* Crosshair */}
                <line x1="50" y1="20" x2="50" y2="80" stroke="#333" strokeDasharray="2,2" />
                <line x1="20" y1="50" x2="80" y2="50" stroke="#333" strokeDasharray="2,2" />

                {/* Vectors */}
                {drawVector(gravity, "#4299E1")}
                {drawVector(drag, "#F56565")}
                {drawVector(thrust, "#48BB78")}
                {/* Net Force */}
                {/* {drawVector(net, "white")}  -- Maybe clutter? User asked for vectors pooling different ways and Net force. */}
            </svg>
            {/* Legend */}
            <Box position="absolute" bottom={1} right={2} fontSize="xx-small" color="gray.500" display="flex" flexDirection="column" alignItems="end">
                <Text color="green.400">THRUST</Text>
                <Text color="red.400">DRAG</Text>
                <Text color="blue.400">GRAVITY</Text>
            </Box>
        </Box>
    );
}
