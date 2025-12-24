/**
 * Internal Structure Viewer
 * 
 * Displays the internal structure of a cocoon in a modal window.
 * Shows input/internal/output nodes arranged in the cocoon's structure.
 */

const InternalViewer = {
    // State
    isOpen: false,
    currentCocoonId: null,

    // Three.js components
    scene: null,
    camera: null,
    renderer: null,
    controls: null,

    // Node meshes
    nodes: [],
    connections: [],

    // Modal dragging
    isDragging: false,
    dragOffset: { x: 0, y: 0 },

    // Animation
    animationId: null,
    time: 0,

    /**
     * Initialize the internal viewer
     */
    init() {
        const modal = document.getElementById('internal-modal');
        const header = document.getElementById('internal-modal-header');

        // Setup dragging
        header.addEventListener('mousedown', (e) => this.startDrag(e));
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.endDrag());

        // Prevent text selection while dragging
        header.addEventListener('selectstart', (e) => e.preventDefault());
    },

    /**
     * Open the internal viewer for a cocoon
     */
    open(cocoonId) {
        const modal = document.getElementById('internal-modal');
        const container = document.getElementById('internal-canvas-container');

        this.currentCocoonId = cocoonId;
        this.isOpen = true;

        // Get cocoon data
        const cocoon = this.getCocoonData(cocoonId);
        if (!cocoon) {
            console.error('Cocoon not found:', cocoonId);
            return;
        }

        // Update info panel
        this.updateInfoPanel(cocoon);

        // Show modal
        modal.style.display = 'flex';

        // Setup Three.js scene if not already done
        if (!this.renderer) {
            this.setupScene(container);
        }

        // Render internal structure
        this.renderInternalStructure(cocoon);

        // Start animation
        this.animate();
    },

    /**
     * Close the internal viewer
     */
    close() {
        const modal = document.getElementById('internal-modal');
        modal.style.display = 'none';
        this.isOpen = false;
        this.currentCocoonId = null;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    },

    /**
     * Get cocoon data from current network
     */
    getCocoonData(cocoonId) {
        // Try NCXLoader first (has full internal data)
        if (NCXLoader.currentExperiment && NCXLoader.currentExperiment.cocoons) {
            return NCXLoader.currentExperiment.cocoons.find(c => c.id === cocoonId);
        }
        // Fallback to Renderer network data
        if (Renderer.currentNetwork && Renderer.currentNetwork.ncxData && Renderer.currentNetwork.ncxData.cocoons) {
            return Renderer.currentNetwork.ncxData.cocoons.find(c => c.id === cocoonId);
        }
        console.warn('[InternalViewer] No cocoon data source found');
        return null;
    },

    /**
     * Update the info panel with cocoon data
     */
    updateInfoPanel(cocoon) {
        const seedNames = ['SENSOR', 'PROCESSOR', 'MEMORY', 'MODULATOR'];
        const seedCodes = ['00', '01', '10', '11'];

        document.getElementById('internal-cocoon-type').textContent = seedNames[cocoon.seedId] || 'UNKNOWN';
        document.getElementById('internal-cocoon-id').textContent = `#${cocoon.id}`;
        document.getElementById('internal-layer').textContent = cocoon.layer !== undefined ? cocoon.layer : '-';
        document.getElementById('internal-seed').textContent = seedCodes[cocoon.seedId] || '--';

        // Node counts - use default values based on type if not available
        const nodeCounts = this.getNodeCounts(cocoon);
        document.getElementById('internal-inputs').textContent = nodeCounts.input;
        document.getElementById('internal-internals').textContent = nodeCounts.internal;
        document.getElementById('internal-outputs').textContent = nodeCounts.output;
        document.getElementById('internal-connections').textContent = cocoon.internal_connections || 'N/A';

        // Update type color
        const typeColors = ['#22ff88', '#4488ff', '#ffaa22', '#ff4466'];
        document.getElementById('internal-cocoon-type').style.color = typeColors[cocoon.seedId] || '#fff';
    },

    /**
     * Get node counts based on cocoon type
     */
    getNodeCounts(cocoon) {
        // Default values based on cocoon type
        const defaults = {
            0: { input: 16, internal: 50, output: 8 },   // Sensor
            1: { input: 8, internal: 50, output: 8 },    // Processor
            2: { input: 4, internal: 50, output: 8 },    // Memory
            3: { input: 4, internal: 50, output: 16 },   // Modulator
        };

        const typeDefaults = defaults[cocoon.seedId] || defaults[1];

        return {
            input: cocoon.input_nodes || typeDefaults.input,
            internal: (cocoon.internal_nodes ? cocoon.internal_nodes - typeDefaults.input - typeDefaults.output : typeDefaults.internal),
            output: cocoon.output_nodes || typeDefaults.output
        };
    },

    /**
     * Setup Three.js scene for internal view
     */
    setupScene(container) {
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050510);

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
        this.camera.position.set(0, 0, 3);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 1;
        this.controls.maxDistance = 10;

        // Lights
        const ambient = new THREE.AmbientLight(0x333344);
        this.scene.add(ambient);

        const directional = new THREE.DirectionalLight(0xffffff, 0.6);
        directional.position.set(5, 5, 5);
        this.scene.add(directional);

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        });
        resizeObserver.observe(container);
    },

    /**
     * Render the internal structure of a cocoon
     */
    renderInternalStructure(cocoon) {
        // Clear existing nodes and connections
        this.nodes.forEach(n => this.scene.remove(n));
        this.connections.forEach(c => this.scene.remove(c));
        this.nodes = [];
        this.connections = [];

        // Colors for node types
        const colors = {
            input: 0x22ff88,
            internal: 0x4488ff,
            output: 0xffaa22
        };

        // Materials
        const materials = {
            input: new THREE.MeshPhongMaterial({ color: colors.input, emissive: colors.input, emissiveIntensity: 0.3 }),
            internal: new THREE.MeshPhongMaterial({ color: colors.internal, emissive: colors.internal, emissiveIntensity: 0.15 }),
            output: new THREE.MeshPhongMaterial({ color: colors.output, emissive: colors.output, emissiveIntensity: 0.3 })
        };

        const nodeGeo = new THREE.SphereGeometry(0.04, 12, 12);
        const nodeById = {};

        // Check if we have REAL node data from NCX
        if (cocoon.nodes && cocoon.nodes.length > 0) {
            // Use REAL positions from NCX file
            console.log(`[InternalViewer] Using REAL data: ${cocoon.nodes.length} nodes`);

            cocoon.nodes.forEach((nodeData) => {
                const nodeType = nodeData.type || 'internal';
                const material = materials[nodeType] || materials.internal;
                const node = new THREE.Mesh(nodeGeo, material.clone());

                // Use real position from NCX
                node.position.set(
                    nodeData.position[0],
                    nodeData.position[1],
                    nodeData.position[2]
                );
                node.userData = { type: nodeType, id: nodeData.id };

                this.scene.add(node);
                this.nodes.push(node);
                nodeById[nodeData.id] = node;
            });

            // Render REAL connections from NCX
            if (cocoon.internalConnections && cocoon.internalConnections.length > 0) {
                console.log(`[InternalViewer] Rendering ${cocoon.internalConnections.length} connections`);

                const connectionMat = new THREE.LineBasicMaterial({
                    color: 0x4488ff,
                    transparent: true,
                    opacity: 0.12
                });

                cocoon.internalConnections.forEach(conn => {
                    const srcNode = nodeById[conn[0]];
                    const tgtNode = nodeById[conn[1]];

                    if (srcNode && tgtNode) {
                        const geometry = new THREE.BufferGeometry().setFromPoints([
                            srcNode.position.clone(),
                            tgtNode.position.clone()
                        ]);
                        const line = new THREE.Line(geometry, connectionMat);
                        this.scene.add(line);
                        this.connections.push(line);
                    }
                });
            }
        } else {
            // Fallback: Generate placeholder positions (old behavior)
            console.log('[InternalViewer] No real data, using generated positions');
            const nodeCounts = this.getNodeCounts(cocoon);
            const positions = this.generateSpherePositions(nodeCounts);

            // Create input nodes (top ring)
            for (let i = 0; i < nodeCounts.input; i++) {
                const node = new THREE.Mesh(nodeGeo, materials.input);
                node.position.set(positions.input[i].x, positions.input[i].y, positions.input[i].z);
                node.userData = { type: 'input', index: i };
                this.scene.add(node);
                this.nodes.push(node);
            }

            // Create internal nodes (middle volume)
            for (let i = 0; i < nodeCounts.internal; i++) {
                const node = new THREE.Mesh(nodeGeo, materials.internal);
                node.position.set(positions.internal[i].x, positions.internal[i].y, positions.internal[i].z);
                node.userData = { type: 'internal', index: i };
                this.scene.add(node);
                this.nodes.push(node);
            }

            // Create output nodes (bottom ring)
            for (let i = 0; i < nodeCounts.output; i++) {
                const node = new THREE.Mesh(nodeGeo, materials.output);
                node.position.set(positions.output[i].x, positions.output[i].y, positions.output[i].z);
                node.userData = { type: 'output', index: i };
                this.scene.add(node);
                this.nodes.push(node);
            }

            // Generate placeholder connections
            this.generateConnections(positions, nodeCounts);
        }
    },

    /**
     * Generate sphere-based positions for nodes
     */
    generateSpherePositions(nodeCounts) {
        const positions = { input: [], internal: [], output: [] };
        const radius = 0.8;

        // Input nodes - ring at top (y = 0.5)
        for (let i = 0; i < nodeCounts.input; i++) {
            const angle = (i / nodeCounts.input) * Math.PI * 2;
            positions.input.push({
                x: Math.cos(angle) * radius * 0.5,
                y: 0.5,
                z: Math.sin(angle) * radius * 0.5
            });
        }

        // Internal nodes - fibonacci sphere in middle
        const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
        for (let i = 0; i < nodeCounts.internal; i++) {
            const y = 1 - (i / (nodeCounts.internal - 1)) * 2; // y from 1 to -1
            const radiusAtY = Math.sqrt(1 - y * y) * radius * 0.7;
            const theta = phi * i;

            positions.internal.push({
                x: Math.cos(theta) * radiusAtY,
                y: y * 0.4, // Compress to middle
                z: Math.sin(theta) * radiusAtY
            });
        }

        // Output nodes - ring at bottom (y = -0.5)
        for (let i = 0; i < nodeCounts.output; i++) {
            const angle = (i / nodeCounts.output) * Math.PI * 2;
            positions.output.push({
                x: Math.cos(angle) * radius * 0.6,
                y: -0.5,
                z: Math.sin(angle) * radius * 0.6
            });
        }

        return positions;
    },

    /**
     * Generate connection lines
     */
    generateConnections(positions, nodeCounts) {
        const connectionMat = new THREE.LineBasicMaterial({
            color: 0x4488ff,
            transparent: true,
            opacity: 0.15
        });

        // Sample connections: input -> internal (nearby)
        positions.input.forEach((inputPos, i) => {
            // Connect to a few nearby internal nodes
            for (let j = 0; j < 3; j++) {
                const targetIdx = Math.floor(Math.random() * nodeCounts.internal);
                const targetPos = positions.internal[targetIdx];

                const geometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(inputPos.x, inputPos.y, inputPos.z),
                    new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z)
                ]);
                const line = new THREE.Line(geometry, connectionMat);
                this.scene.add(line);
                this.connections.push(line);
            }
        });

        // Sample connections: internal -> output (nearby)
        positions.output.forEach((outputPos, i) => {
            for (let j = 0; j < 4; j++) {
                const sourceIdx = Math.floor(Math.random() * nodeCounts.internal);
                const sourcePos = positions.internal[sourceIdx];

                const geometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(sourcePos.x, sourcePos.y, sourcePos.z),
                    new THREE.Vector3(outputPos.x, outputPos.y, outputPos.z)
                ]);
                const line = new THREE.Line(geometry, connectionMat);
                this.scene.add(line);
                this.connections.push(line);
            }
        });
    },

    /**
     * Animation loop
     */
    animate() {
        if (!this.isOpen) return;

        this.animationId = requestAnimationFrame(() => this.animate());
        this.time += 0.016;

        // Update controls
        if (this.controls) {
            this.controls.update();
        }

        // Gentle node pulse
        this.nodes.forEach((node, idx) => {
            const pulse = Math.sin(this.time * 2 + idx * 0.1) * 0.1 + 1;
            node.scale.setScalar(pulse);
        });

        // Render
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    },

    /**
     * Start dragging the modal
     */
    startDrag(e) {
        const modal = document.getElementById('internal-modal');
        this.isDragging = true;

        const rect = modal.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;

        // Remove centering transform
        modal.style.transform = 'none';
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
    },

    /**
     * Drag the modal
     */
    drag(e) {
        if (!this.isDragging) return;

        const modal = document.getElementById('internal-modal');
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;

        // Clamp to viewport
        const maxX = window.innerWidth - modal.offsetWidth;
        const maxY = window.innerHeight - modal.offsetHeight;

        modal.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
        modal.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
    },

    /**
     * End dragging
     */
    endDrag() {
        this.isDragging = false;
    }
};

// Global function to close viewer
function closeInternalViewer() {
    InternalViewer.close();
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    InternalViewer.init();
});
