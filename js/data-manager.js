/**
 * Cocoon Visualizer - Data Manager
 * 
 * Loads and manages all data definitions (topologies, structures, types).
 * Adding new features = adding new JSON files, no code changes needed.
 */

const DataManager = {
    types: {},
    topologies: {},
    structures: {},
    loaded: false,

    /**
     * Load all data files
     */
    async loadAll() {
        try {
            // Load cocoon types
            this.types = await this.loadJSON('data/types.json');

            // Load topologies
            this.topologies = {
                funnel: await this.loadJSON('data/topologies/funnel.json'),
                onion: await this.loadJSON('data/topologies/onion.json'),
                smallworld: await this.loadJSON('data/topologies/smallworld.json'),
                hourglass: await this.loadJSON('data/topologies/hourglass.json')
            };

            // Load internal structures
            this.structures = {
                sphere: await this.loadJSON('data/structures/sphere.json'),
                random: await this.loadJSON('data/structures/random.json')
            };

            this.loaded = true;
            console.log('[DataManager] All data loaded successfully');
            return true;
        } catch (error) {
            console.error('[DataManager] Failed to load data:', error);
            return false;
        }
    },

    /**
     * Load a single JSON file
     */
    async loadJSON(path) {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load ${path}: ${response.status}`);
        }
        return response.json();
    },

    /**
     * Get color for cocoon type (as hex number)
     */
    getTypeColor(typeName) {
        const type = this.types[typeName];
        if (type && type.color) {
            return parseInt(type.color.replace('#', '0x'));
        }
        return 0x888888;
    },

    /**
     * Get all topology names
     */
    getTopologyNames() {
        return Object.keys(this.topologies);
    },

    /**
     * Get all structure names
     */
    getStructureNames() {
        return Object.keys(this.structures);
    },

    /**
     * Get topology config
     */
    getTopology(name) {
        return this.topologies[name] || null;
    },

    /**
     * Get structure config
     */
    getStructure(name) {
        return this.structures[name] || null;
    }
};

// Export for use in other modules
window.DataManager = DataManager;
