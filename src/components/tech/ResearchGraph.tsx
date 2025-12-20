import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    Position,
    ConnectionLineType,
    NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { GameProgression } from '../../game/GameProgression';
import TechNode, { TechNodeData } from './TechNode';

// --- Layout Helper ---
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 320;
const nodeHeight = 250; // Increased to fit full item lists

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    dagreGraph.setGraph({ rankdir: 'LR' }); // Left to Right layout

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);

        // Dagre returns center point, reactflow needs top left
        // However, we can just use the dagre coordinates directly if we handle the offset or if dagre is configured for center.
        // Actually reactflow default anchor is top-left.
        // Let's adjust.
        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };

        return node;
    });

    return { nodes, edges };
};

// --- Component ---

const nodeTypes: NodeTypes = {
    techNode: TechNode,
};

export function ResearchGraph({ unlockedTechs, researchPoints, onUnlock }: { unlockedTechs: string[], researchPoints: number, onUnlock: (id: string, cost: number) => void }) {

    // 1. Convert GameProgression to Nodes/Edges
    const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
        const nodes: Node<TechNodeData>[] = [];
        const edges: Edge[] = [];

        GameProgression.forEach(def => {
            const isUnlocked = unlockedTechs.includes(def.id);
            const parentIds = def.parentIds || [];
            // Node is unlockable if it's not unlocked AND all parents are unlocked
            // If it has no parents (root), it is unlockable if not unlocked (usually root starts unlocked)
            const isUnlockable = !isUnlocked && (parentIds.length === 0 || parentIds.every(pid => unlockedTechs.includes(pid)));
            const canAfford = researchPoints >= def.costRP;

            nodes.push({
                id: def.id,
                type: 'techNode',
                position: { x: 0, y: 0 }, // Will be set by layout
                data: {
                    node: def,
                    isUnlocked,
                    isUnlockable,
                    canAfford,
                    onUnlock
                },
            });

            parentIds.forEach(pid => {
                edges.push({
                    id: `${pid}-${def.id}`,
                    source: pid,
                    target: def.id,
                    type: 'smoothstep', // nice ortholine
                    animated: unlockedTechs.includes(pid) && !isUnlocked, // Animate connection if parent is unlocked but child isn't
                    style: { stroke: unlockedTechs.includes(pid) ? '#4FD1C5' : '#4A5568', strokeWidth: 2 }
                });
            });
        });

        return getLayoutedElements(nodes, edges);
    }, [unlockedTechs, researchPoints]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Update nodes when props change (specifically unlock status/points)
    // We need to 'merge' the new data into the existing nodes to preserve positions if we dragged them (optional)
    // But since we use auto-layout every time for now, we can just replace.
    // Ideally we only update 'data'.

    // For simplicity, we effect update the nodes data
    React.useEffect(() => {
        setNodes((nds) =>
            nds.map((node) => {
                const def = GameProgression.find(n => n.id === node.id);
                if (!def) return node;

                const isUnlocked = unlockedTechs.includes(def.id);
                const parentIds = def.parentIds || [];
                const isUnlockable = !isUnlocked && (parentIds.length === 0 || parentIds.every(pid => unlockedTechs.includes(pid)));
                const canAfford = researchPoints >= def.costRP;

                return {
                    ...node,
                    data: {
                        ...node.data,
                        isUnlocked,
                        isUnlockable,
                        canAfford,
                        onUnlock
                    }
                };
            })
        );
        // Edges might change style
        setEdges((eds) =>
            eds.map(edge => {
                const isSourceUnlocked = unlockedTechs.includes(edge.source);
                const isTargetUnlocked = unlockedTechs.includes(edge.target);
                return {
                    ...edge,
                    animated: isSourceUnlocked && !isTargetUnlocked,
                    style: { ...edge.style, stroke: isSourceUnlocked ? '#4FD1C5' : '#4A5568' }
                }
            })
        )

    }, [unlockedTechs, researchPoints, onUnlock, setNodes, setEdges]);


    return (
        <div style={{ width: '100%', height: '100%', background: '#0a0a0a' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.2}
            >
                <Background color="#222" gap={20} size={1} />
                <Controls />
            </ReactFlow>
        </div>
    );
}

export default ResearchGraph;
