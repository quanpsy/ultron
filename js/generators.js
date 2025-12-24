/**
 * Cocoon Visualizer - Generators
 * 
 * Generates network positions and connections based on topology/structure data.
 * Each generator reads from JSON configs and produces visualization-ready data.
 */

const Generators = {

    /**
     * Generate topology network
     */
    generateTopology(topologyName, cocoonCount, structure) {
        const topology = DataManager.getTopology(topologyName);
        if (!topology) {
            console.error('Unknown topology:', topologyName);
            return { positions: [], connections: [], types: [] };
        }

        switch (topology.generator.type) {
            case 'funnel':
                return this.generateFunnel(topology, cocoonCount);
            case 'onion':
                return this.generateOnion(topology, cocoonCount);
            case 'smallworld':
                return this.generateSmallWorld(topology, cocoonCount);
            case 'hourglass':
                return this.generateHourglass(topology, cocoonCount);
            default:
                return { positions: [], connections: [], types: [] };
        }
    },

    /**
     * Generate funnel topology
     */
    generateFunnel(config, targetCount) {
        const positions = [];
        const connections = [];
        const types = [];

        const numLayers = config.parameters.numLayers.default;
        const spacing = config.visualization.spacing;
        const typeDistribution = config.visualization.typeDistribution;

        let cocoonId = 0;
        const layerCocoonIds = [];

        for (let layer = 0; layer < numLayers; layer++) {
            const ratio = layer / (numLayers - 1);
            const count = Math.max(1, Math.floor(1 + (targetCount - 1) * (ratio ** 2)));
            const y = (layer - numLayers / 2) * spacing.layerHeight;
            const radius = 0.5 + ratio * spacing.baseRadius;

            layerCocoonIds[layer] = [];

            // Determine type distribution for this layer
            let layerTypes;
            if (layer === 0) layerTypes = typeDistribution.apex;
            else if (layer === numLayers - 1) layerTypes = typeDistribution.base;
            else layerTypes = typeDistribution.middle;

            for (let i = 0; i < count; i++) {
                const spiralOffset = config.parameters.spiralOffset ? config.parameters.spiralOffset.default : 0.3;
                const angle = (i / count) * Math.PI * 2 + layer * spiralOffset;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;

                positions.push({ x, y, z, layer });
                types.push(layerTypes[i % layerTypes.length]);
                layerCocoonIds[layer].push(cocoonId);

                // Connect to previous layer
                if (layer > 0 && layerCocoonIds[layer - 1].length > 0) {
                    const prevLayer = layerCocoonIds[layer - 1];
                    const numConns = Math.min(3, prevLayer.length);

                    for (let c = 0; c < numConns; c++) {
                        const prevIdx = (Math.floor(i * prevLayer.length / count) + c) % prevLayer.length;
                        connections.push({
                            from: prevLayer[prevIdx],
                            to: cocoonId,
                            weight: 1 - c * 0.2
                        });
                    }
                }

                cocoonId++;
            }
        }

        return { positions, connections, types, layers: numLayers };
    },

    /**
     * Generate onion topology
     */
    generateOnion(config, targetCount) {
        const positions = [];
        const connections = [];
        const types = [];

        const numLayers = config.parameters.numLayers.default;
        const spacing = config.visualization.spacing;
        const typeNames = Object.keys(DataManager.types);

        let cocoonId = 0;
        const layerCocoonIds = [];

        for (let layer = 0; layer < numLayers; layer++) {
            const count = Math.max(1, Math.floor(targetCount * (layer + 1) / 10));
            const radius = 1 + layer * spacing.layerRadius;

            layerCocoonIds[layer] = [];

            // Fibonacci sphere distribution
            for (let i = 0; i < count; i++) {
                const phi = Math.acos(-1 + (2 * i) / count);
                const theta = Math.sqrt(count * Math.PI) * phi;

                const x = radius * Math.cos(theta) * Math.sin(phi);
                const y = radius * Math.sin(theta) * Math.sin(phi);
                const z = radius * Math.cos(phi);

                positions.push({ x, y, z, layer });
                types.push(typeNames[Math.floor(Math.random() * 4)]);
                layerCocoonIds[layer].push(cocoonId);

                // Connect to inner layer
                if (layer > 0 && Math.random() < 0.5) {
                    const prevLayer = layerCocoonIds[layer - 1];
                    const prevIdx = Math.floor(Math.random() * prevLayer.length);
                    connections.push({
                        from: prevLayer[prevIdx],
                        to: cocoonId,
                        weight: 0.8
                    });
                }

                cocoonId++;
            }
        }

        return { positions, connections, types, layers: numLayers };
    },

    /**
     * Generate small-world topology
     */
    generateSmallWorld(config, cocoonCount) {
        const positions = [];
        const connections = [];
        const types = [];

        const k = config.parameters.kNeighbors.default;
        const rewireProb = config.parameters.rewireProb.default;
        const viz = config.visualization;
        const typeNames = Object.keys(DataManager.types);

        // Ring layout with noise
        for (let i = 0; i < cocoonCount; i++) {
            const angle = (i / cocoonCount) * Math.PI * 2;
            const x = Math.cos(angle) * viz.radius + (Math.random() - 0.5) * 2;
            const y = (Math.random() - 0.5) * viz.heightVariance;
            const z = Math.sin(angle) * viz.radius + (Math.random() - 0.5) * 2;

            positions.push({ x, y, z, layer: 0 });

            // More sensors at start, more processors at end
            if (i < cocoonCount * 0.1) types.push('sensor');
            else if (i > cocoonCount * 0.9) types.push('processor');
            else types.push(typeNames[Math.floor(Math.random() * 4)]);
        }

        // Ring connections with rewiring
        for (let i = 0; i < cocoonCount; i++) {
            for (let j = 1; j <= k / 2; j++) {
                let target = (i + j) % cocoonCount;

                // Rewire with probability
                if (Math.random() < rewireProb) {
                    target = Math.floor(Math.random() * cocoonCount);
                    while (target === i) {
                        target = Math.floor(Math.random() * cocoonCount);
                    }
                }

                connections.push({
                    from: i,
                    to: target,
                    weight: 0.7
                });
            }
        }

        return { positions, connections, types, layers: 1 };
    },

    /**
     * Generate internal cocoon structure
     */
    generateInternalStructure(structureName, nodeCount = 50) {
        const structure = DataManager.getStructure(structureName);
        if (!structure) {
            console.error('Unknown structure:', structureName);
            return { positions: [], connections: [] };
        }

        if (structure.generator.nodeDistribution === 'fibonacci_sphere') {
            return this.generateSphereSurface(structure, nodeCount);
        } else {
            return this.generateRandomGraph(structure, nodeCount);
        }
    },

    /**
     * Generate sphere surface structure
     */
    generateSphereSurface(config, nodeCount) {
        const positions = [];
        const connections = [];

        const phi = Math.PI * (3.0 - Math.sqrt(5.0)); // Golden angle
        const threshold = config.parameters.distanceThreshold.default;

        // Fibonacci sphere
        for (let i = 0; i < nodeCount; i++) {
            const y = 1 - (i / (nodeCount - 1)) * 2;
            const radius = Math.sqrt(1 - y * y) * 3;
            const theta = phi * i;

            positions.push({
                x: Math.cos(theta) * radius,
                y: y * 3,
                z: Math.sin(theta) * radius,
                type: i < 8 ? 'input' : i >= nodeCount - 8 ? 'output' : 'internal'
            });
        }

        // Distance-based connections
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const dist = Math.sqrt(
                    Math.pow(positions[i].x - positions[j].x, 2) +
                    Math.pow(positions[i].y - positions[j].y, 2) +
                    Math.pow(positions[i].z - positions[j].z, 2)
                );

                if (dist < threshold * 4 && Math.random() < 0.25) {
                    connections.push({
                        from: i,
                        to: j,
                        weight: 1 - dist / (threshold * 4)
                    });
                }
            }
        }

        return { positions, connections };
    },

    /**
     * Generate random graph structure
     */
    generateRandomGraph(config, nodeCount) {
        const positions = [];
        const connections = [];

        const density = config.parameters.connectionDensity.default;

        // Random positions
        for (let i = 0; i < nodeCount; i++) {
            positions.push({
                x: (Math.random() - 0.5) * 6,
                y: (Math.random() - 0.5) * 6,
                z: (Math.random() - 0.5) * 6,
                type: i < 8 ? 'input' : i >= nodeCount - 8 ? 'output' : 'internal'
            });
        }

        // Random connections
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                if (Math.random() < density * 0.15) {
                    connections.push({
                        from: i,
                        to: j,
                        weight: Math.random()
                    });
                }
            }
        }

        return { positions, connections };
    },

    /**
     * Generate hourglass topology (bottleneck in center)
     */
    generateHourglass(config, targetCount) {
        const positions = [];
        const connections = [];
        const types = [];

        const numLayers = config.parameters.numLayers.default;
        const endCocoons = config.parameters.endCocoons.default;
        const centerCocoons = config.parameters.centerCocoons.default;
        const spacing = config.visualization.spacing;
        const typeDistribution = config.visualization.typeDistribution;

        const midLayer = Math.floor(numLayers / 2);
        let cocoonId = 0;
        const layerCocoonIds = [];

        for (let layer = 0; layer < numLayers; layer++) {
            // Calculate layer size: large at ends, small in middle
            const distFromCenter = Math.abs(layer - midLayer);
            const maxDist = midLayer;
            const ratio = distFromCenter / maxDist;

            // Interpolate between center and end sizes
            const count = Math.round(centerCocoons + (endCocoons - centerCocoons) * ratio);

            // Y position (centered)
            const y = (layer - midLayer) * spacing.layerHeight;

            // Radius varies with count for visual shape
            const radius = 0.5 + (count / endCocoons) * 3;

            layerCocoonIds[layer] = [];

            // Determine type distribution
            let layerTypes;
            if (layer === 0) layerTypes = typeDistribution.input;
            else if (layer < midLayer) layerTypes = typeDistribution.compress;
            else if (layer === midLayer) layerTypes = typeDistribution.center;
            else if (layer < numLayers - 1) layerTypes = typeDistribution.expand;
            else layerTypes = typeDistribution.output;

            for (let i = 0; i < count; i++) {
                // Even distribution around circle
                const angle = (i / count) * Math.PI * 2;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;

                positions.push({ x, y, z, layer });
                types.push(layerTypes[i % layerTypes.length]);
                layerCocoonIds[layer].push(cocoonId);

                // Connect to previous layer
                if (layer > 0 && layerCocoonIds[layer - 1].length > 0) {
                    const prevLayer = layerCocoonIds[layer - 1];
                    const numConns = Math.min(3, prevLayer.length);

                    for (let c = 0; c < numConns; c++) {
                        const prevIdx = (Math.floor(i * prevLayer.length / count) + c) % prevLayer.length;
                        connections.push({
                            from: prevLayer[prevIdx],
                            to: cocoonId,
                            weight: 1 - c * 0.15
                        });
                    }
                }

                cocoonId++;
            }
        }

        return { positions, connections, types, layers: numLayers };
    }
};

window.Generators = Generators;
