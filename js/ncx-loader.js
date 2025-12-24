/**
 * ULTRON - NCX File Loader
 * 
 * Handles loading and parsing .ncx.json experiment files.
 */

const NCXLoader = {
    currentExperiment: null,
    currentTimestep: 0,
    isPlaying: false,
    playbackInterval: null,

    /**
     * Load NCX file from File object
     */
    async loadFromFile(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            return this.processNCXData(data);
        } catch (error) {
            console.error('Failed to load NCX file:', error);
            throw new Error('Invalid NCX file format');
        }
    },

    /**
     * Load NCX from URL
     */
    async loadFromURL(url) {
        try {
            const response = await fetch(url);
            const data = await response.json();
            return this.processNCXData(data);
        } catch (error) {
            console.error('Failed to load NCX from URL:', error);
            throw new Error('Failed to fetch NCX file');
        }
    },

    /**
     * Process and validate NCX data
     */
    processNCXData(data) {
        // Validate required fields
        if (!data.cocoons || !data.connections) {
            throw new Error('NCX file missing required fields (cocoons, connections)');
        }

        // Parse connections - handle multiple formats
        let connections = data.connections;
        if (typeof connections === 'string') {
            // Compact string format: "from:to:weight;..."
            connections = this.parseCompactConnections(connections);
        } else if (Array.isArray(connections) && connections.length > 0) {
            // Check if it's array of arrays [from, to, weight] or array of objects {from, to, weight}
            if (Array.isArray(connections[0])) {
                // Array format: [[from, to, weight], ...]
                connections = connections.map(arr => ({
                    from: arr[0],
                    to: arr[1],
                    weight: arr[2] !== undefined ? arr[2] : 1.0
                }));
            }
            // else it's already object format, keep as-is
        }

        // Build network format compatible with renderer
        const network = {
            positions: [],
            connections: [],
            types: [],
            ncxData: data // Store original for inspection
        };

        // Map cocoon IDs to indices
        const idToIndex = new Map();
        data.cocoons.forEach((cocoon, idx) => {
            idToIndex.set(cocoon.id, idx);

            network.positions.push({
                x: cocoon.position[0],
                y: cocoon.position[1],
                z: cocoon.position[2]
            });

            // Get type name from seed
            const seed = data.seeds?.find(s => s.id === cocoon.seedId);
            network.types.push(seed?.name || this.getSeedTypeName(cocoon.seedId));
        });

        // Process connections
        connections.forEach(conn => {
            const fromIdx = idToIndex.get(conn.from);
            const toIdx = idToIndex.get(conn.to);
            if (fromIdx !== undefined && toIdx !== undefined) {
                network.connections.push({
                    from: fromIdx,
                    to: toIdx,
                    weight: conn.weight || 1.0
                });
            }
        });

        this.currentExperiment = {
            network,
            metadata: data.metadata || {},
            topology: data.topology || {},
            history: data.history || [],
            seeds: data.seeds || [],
            cocoons: data.cocoons,
            connections: connections
        };

        this.currentTimestep = 0;
        if (this.currentExperiment.history.length > 0) {
            this.currentTimestep = this.currentExperiment.history[0].timestep;
        }

        return this.currentExperiment;
    },

    /**
     * Parse compact connection format "from:to:weight;..."
     */
    parseCompactConnections(str) {
        return str.split(';').filter(s => s.trim()).map(conn => {
            const parts = conn.split(':');
            return {
                from: parseInt(parts[0]),
                to: parseInt(parts[1]),
                weight: parts[2] ? parseFloat(parts[2]) : 1.0
            };
        });
    },

    /**
     * Get default seed type name
     */
    getSeedTypeName(seedId) {
        const types = ['sensor', 'processor', 'memory', 'modulator'];
        return types[seedId] || 'processor';
    },

    /**
     * Get cocoon data by ID
     */
    getCocoonById(id) {
        if (!this.currentExperiment) return null;
        return this.currentExperiment.cocoons.find(c => c.id === id);
    },

    /**
     * Get seed data by ID
     */
    getSeedById(id) {
        if (!this.currentExperiment) return null;
        return this.currentExperiment.seeds.find(s => s.id === id);
    },

    /**
     * Get connections for a cocoon
     */
    getConnectionsForCocoon(id) {
        if (!this.currentExperiment) return { incoming: 0, outgoing: 0 };
        const connections = this.currentExperiment.connections;
        return {
            incoming: connections.filter(c => c.to === id).length,
            outgoing: connections.filter(c => c.from === id).length
        };
    },

    /**
     * Get activation for a cocoon at current timestep
     */
    getActivation(cocoonId) {
        if (!this.currentExperiment || !this.currentExperiment.history.length) return null;

        const step = this.currentExperiment.history.find(h => h.timestep === this.currentTimestep);
        if (!step || !step.activations) return null;

        return step.activations[String(cocoonId)] || null;
    },

    /**
     * Step forward in history
     */
    stepForward() {
        if (!this.currentExperiment || !this.currentExperiment.history.length) return false;

        const history = this.currentExperiment.history;
        const currentIdx = history.findIndex(h => h.timestep === this.currentTimestep);
        if (currentIdx < history.length - 1) {
            this.currentTimestep = history[currentIdx + 1].timestep;
            return true;
        }
        return false;
    },

    /**
     * Step backward in history
     */
    stepBackward() {
        if (!this.currentExperiment || !this.currentExperiment.history.length) return false;

        const history = this.currentExperiment.history;
        const currentIdx = history.findIndex(h => h.timestep === this.currentTimestep);
        if (currentIdx > 0) {
            this.currentTimestep = history[currentIdx - 1].timestep;
            return true;
        }
        return false;
    },

    /**
     * Seek to specific timestep
     */
    seekTo(timestep) {
        if (!this.currentExperiment) return;
        this.currentTimestep = parseInt(timestep);
    },

    /**
     * Toggle playback
     */
    togglePlayback(onUpdate) {
        this.isPlaying = !this.isPlaying;

        if (this.isPlaying) {
            this.playbackInterval = setInterval(() => {
                if (!this.stepForward()) {
                    this.isPlaying = false;
                    clearInterval(this.playbackInterval);
                    if (onUpdate) onUpdate(false);
                } else {
                    if (onUpdate) onUpdate(true);
                }
            }, 200); // 5 steps per second
        } else {
            clearInterval(this.playbackInterval);
        }

        return this.isPlaying;
    },

    /**
     * Stop playback
     */
    stopPlayback() {
        this.isPlaying = false;
        clearInterval(this.playbackInterval);
    },

    /**
     * Get total history steps
     */
    getHistoryLength() {
        return this.currentExperiment?.history?.length || 0;
    },

    /**
     * Get min/max timesteps
     */
    getTimestepRange() {
        if (!this.currentExperiment?.history?.length) {
            return { min: 0, max: 0 };
        }
        const timesteps = this.currentExperiment.history.map(h => h.timestep);
        return {
            min: Math.min(...timesteps),
            max: Math.max(...timesteps)
        };
    }
};

window.NCXLoader = NCXLoader;
