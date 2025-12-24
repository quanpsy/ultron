/**
 * Cocoon Visualizer - Renderer
 * 
 * Three.js rendering engine with organic neural aesthetics.
 * Inspired by Ultron's neural network visualization.
 */

const Renderer = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    raycaster: null,
    mouse: null,

    // Object collections
    cocoonMeshes: [],
    connectionLines: [],
    nodeMeshes: [],
    flowParticles: [],
    glowEffects: [],

    // State
    autoRotate: true,
    rotationSpeed: 0.002,
    showFlow: false,
    flowStep: 0,
    time: 0,

    // Network data
    currentNetwork: null,

    // Current theme
    currentTheme: 'ultron',

    // Theme color configurations
    themes: {
        ultron: {
            background: 0x050510,
            fog: 0x050510,
            primary: 0x00aaff,
            secondary: 0x0066cc,
            glow: 0x44ddff,
            sensor: 0x22ff88,
            processor: 0x4488ff,
            memory: 0xffaa22,
            modulator: 0xff4466,
            connection: 0x2288cc,
            particle: 0x88ffff
        },
        jarvis: {
            background: 0x080502,
            fog: 0x080502,
            primary: 0xff8822,
            secondary: 0xcc6600,
            glow: 0xffcc44,
            sensor: 0x44ff88,
            processor: 0xffaa44,
            memory: 0xff6622,
            modulator: 0xff4466,
            connection: 0xcc6622,
            particle: 0xffcc66
        }
    },

    // Colors - Ultron blue theme (default)
    colors: {
        primary: 0x00aaff,
        secondary: 0x0066cc,
        glow: 0x44ddff,
        sensor: 0x22ff88,
        processor: 0x4488ff,
        memory: 0xffaa22,
        modulator: 0xff4466,
        connection: 0x2288cc,
        particle: 0x88ffff
    },

    /**
     * Initialize renderer
     */
    init(container) {
        // Scene with dark background
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050510);
        this.scene.fog = new THREE.FogExp2(0x050510, 0.02);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            60, window.innerWidth / window.innerHeight, 0.1, 1000
        );
        this.camera.position.set(0, 5, 18);

        // Renderer with better quality
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 50;

        // Lights
        this.addLights();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());

        // Double-click to open internal viewer
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.renderer.domElement.addEventListener('dblclick', (e) => this.onDoubleClick(e));

        // Start animation loop
        this.animate();
    },

    /**
     * Handle double-click to open internal viewer
     */
    onDoubleClick(event) {
        // Calculate mouse position in normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Calculate objects intersecting the picking ray
        const intersects = this.raycaster.intersectObjects(this.cocoonMeshes);

        if (intersects.length > 0) {
            const cocoon = intersects[0].object;
            const cocoonId = cocoon.userData.cocoonId;

            console.log('Double-clicked cocoon:', cocoonId);

            // Open internal viewer if available
            if (typeof InternalViewer !== 'undefined' && InternalViewer.open) {
                InternalViewer.open(cocoonId);
            }
        }
    },

    /**
     * Add ambient and point lights
     */
    addLights() {
        // Soft ambient
        const ambient = new THREE.AmbientLight(0x111122, 0.5);
        this.scene.add(ambient);

        // Main blue point light
        const mainLight = new THREE.PointLight(0x4488ff, 1.5, 40);
        mainLight.position.set(0, 10, 0);
        this.scene.add(mainLight);

        // Secondary cyan light
        const sideLight = new THREE.PointLight(0x00ffff, 0.8, 30);
        sideLight.position.set(10, 0, 10);
        this.scene.add(sideLight);

        // Accent light
        const accentLight = new THREE.PointLight(0x8844ff, 0.5, 30);
        accentLight.position.set(-10, -5, -10);
        this.scene.add(accentLight);
    },

    /**
     * Clear all objects
     */
    clear() {
        [...this.cocoonMeshes, ...this.connectionLines, ...this.nodeMeshes,
        ...this.flowParticles, ...this.glowEffects].forEach(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
            this.scene.remove(obj);
        });

        this.cocoonMeshes = [];
        this.connectionLines = [];
        this.nodeMeshes = [];
        this.flowParticles = [];
        this.glowEffects = [];
        this.currentNetwork = null;
    },

    /**
     * Get color for cocoon type
     */
    getTypeColor(typeName) {
        return this.colors[typeName] || this.colors.processor;
    },

    /**
     * Render topology network with organic style
     */
    renderTopology(network) {
        this.clear();
        this.currentNetwork = network;

        const { positions, connections, types } = network;

        // Create organic cocoon meshes
        positions.forEach((pos, idx) => {
            const color = this.getTypeColor(types[idx]);

            // Main neuron body - slightly irregular
            const size = 0.25 + Math.random() * 0.1;
            const geometry = new THREE.IcosahedronGeometry(size, 2);

            // Organic material with glow
            const material = new THREE.MeshPhongMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.4,
                shininess: 80,
                transparent: true,
                opacity: 0.9
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(pos.x, pos.y, pos.z);
            mesh.userData = { type: types[idx], index: idx, baseColor: color, cocoonId: idx };

            // Add outer glow sphere
            const glowGeo = new THREE.SphereGeometry(size * 1.5, 16, 16);
            const glowMat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.15,
                side: THREE.BackSide
            });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            mesh.add(glow);
            this.glowEffects.push(glow);

            this.scene.add(mesh);
            this.cocoonMeshes.push(mesh);
        });

        // Create organic connection lines
        this.renderOrganicConnections(positions, connections);

        return {
            cocoons: positions.length,
            connections: connections.length
        };
    },

    /**
     * Render connections with organic tapered tubes (hourglass shape - wider at cocoons)
     */
    renderOrganicConnections(positions, connections) {
        connections.forEach((conn) => {
            if (conn.from >= positions.length || conn.to >= positions.length) return;

            const from = positions[conn.from];
            const to = positions[conn.to];

            // Create curved connection using quadratic Bezier
            const curve = new THREE.QuadraticBezierCurve3(
                new THREE.Vector3(from.x, from.y, from.z),
                new THREE.Vector3(
                    (from.x + to.x) / 2 + (Math.random() - 0.5) * 0.5,
                    (from.y + to.y) / 2 + (Math.random() - 0.5) * 0.3,
                    (from.z + to.z) / 2 + (Math.random() - 0.5) * 0.5
                ),
                new THREE.Vector3(to.x, to.y, to.z)
            );

            // Create tapered tube with hourglass shape (wider at ends, narrower in middle)
            const tubularSegments = 24;
            const radialSegments = 6;
            const radiusAtEnd = 0.04;

            // Custom tube geometry with variable radius
            const tubeGeometry = new THREE.TubeGeometry(
                curve,
                tubularSegments,
                radiusAtEnd,
                radialSegments,
                false
            );

            // Modify the tube vertices to create hourglass taper
            const posAttr = tubeGeometry.attributes.position;
            const tubeVertices = posAttr.count;
            const verticesPerRing = radialSegments + 1;

            for (let i = 0; i < tubeVertices; i++) {
                const ringIndex = Math.floor(i / verticesPerRing);
                const t = ringIndex / (tubularSegments);

                // Hourglass curve: wider at ends (0 and 1), narrower in middle (0.5)
                const taper = 1 - Math.sin(t * Math.PI) * 0.6;

                const x = posAttr.getX(i);
                const y = posAttr.getY(i);
                const z = posAttr.getZ(i);

                // Get point on curve for this ring
                const curvePoint = curve.getPoint(t);

                // Calculate offset from curve center and scale it
                const dx = x - curvePoint.x;
                const dy = y - curvePoint.y;
                const dz = z - curvePoint.z;

                posAttr.setXYZ(
                    i,
                    curvePoint.x + dx * taper,
                    curvePoint.y + dy * taper,
                    curvePoint.z + dz * taper
                );
            }

            posAttr.needsUpdate = true;
            tubeGeometry.computeVertexNormals();

            const material = new THREE.MeshPhongMaterial({
                color: this.colors.connection,
                emissive: this.colors.connection,
                emissiveIntensity: 0.2,
                transparent: true,
                opacity: 0.5,
                shininess: 30
            });

            const tube = new THREE.Mesh(tubeGeometry, material);
            tube.userData = { from: conn.from, to: conn.to, weight: conn.weight, curve };

            this.scene.add(tube);
            this.connectionLines.push(tube);
        });
    },

    /**
     * Render internal structure
     */
    renderInternalStructure(structure) {
        this.clear();

        const { positions, connections } = structure;

        const colors = {
            input: 0x22ff88,
            internal: 0x4488ff,
            output: 0xffaa22
        };

        positions.forEach((pos, idx) => {
            const color = colors[pos.type] || colors.internal;
            const size = pos.type === 'internal' ? 0.1 : 0.15;

            const geometry = new THREE.IcosahedronGeometry(size, 1);
            const material = new THREE.MeshPhongMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.9
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(pos.x, pos.y, pos.z);
            mesh.userData = { type: pos.type, index: idx };

            this.scene.add(mesh);
            this.nodeMeshes.push(mesh);
        });

        this.renderOrganicConnections(positions, connections);

        return {
            nodes: positions.length,
            connections: connections.length
        };
    },

    /**
     * Toggle neural flow animation
     */
    toggleFlow(enabled) {
        this.showFlow = enabled;
        if (enabled) {
            this.createNeuralFlowParticles();
        } else {
            this.flowParticles.forEach(p => this.scene.remove(p));
            this.flowParticles = [];
        }
    },

    /**
     * Create organic neural flow particles
     */
    createNeuralFlowParticles() {
        if (!this.currentNetwork) return;

        const { connections, positions } = this.currentNetwork;

        // Create multiple particles per connection for organic flow
        connections.forEach((conn, connIdx) => {
            if (conn.from >= positions.length || conn.to >= positions.length) return;

            // Stagger particle count based on connection weight
            const numParticles = Math.ceil(1 + conn.weight * 2);

            for (let p = 0; p < numParticles; p++) {
                const geometry = new THREE.SphereGeometry(0.06, 8, 8);
                const material = new THREE.MeshBasicMaterial({
                    color: this.colors.particle,
                    transparent: true,
                    opacity: 0
                });

                const particle = new THREE.Mesh(geometry, material);
                const from = positions[conn.from];
                particle.position.set(from.x, from.y, from.z);

                // Store the line's curve for smooth movement
                const line = this.connectionLines[connIdx];

                particle.userData = {
                    from: positions[conn.from],
                    to: positions[conn.to],
                    curve: line ? line.userData.curve : null,
                    progress: -Math.random() * 2,
                    speed: 0.008 + Math.random() * 0.008,
                    pulsePhase: Math.random() * Math.PI * 2,
                    active: false
                };

                this.scene.add(particle);
                this.flowParticles.push(particle);
            }
        });
    },

    /**
     * Update neural flow - organic firing pattern
     */
    updateNeuralFlow() {
        this.flowParticles.forEach(particle => {
            const data = particle.userData;
            data.progress += data.speed;

            // Reset when complete
            if (data.progress > 1.2) {
                data.progress = -Math.random() * 1.5;
                data.active = false;
            }

            // Only show during active phase
            if (data.progress >= 0 && data.progress <= 1) {
                data.active = true;
                const t = data.progress;

                // Use curve if available, otherwise linear
                if (data.curve) {
                    const point = data.curve.getPoint(t);
                    particle.position.copy(point);
                } else {
                    particle.position.x = data.from.x + (data.to.x - data.from.x) * t;
                    particle.position.y = data.from.y + (data.to.y - data.from.y) * t;
                    particle.position.z = data.from.z + (data.to.z - data.from.z) * t;
                }

                // Pulse effect - brighten in middle
                const pulse = Math.sin(t * Math.PI);
                particle.material.opacity = 0.3 + pulse * 0.7;

                // Scale pulse
                const scale = 0.8 + pulse * 0.4;
                particle.scale.setScalar(scale);
            } else {
                particle.material.opacity = 0;
                data.active = false;
            }
        });

        // Make neurons pulse when receiving signals
        if (this.showFlow) {
            this.cocoonMeshes.forEach((mesh, idx) => {
                // Check if any particle is arriving at this neuron
                const receiving = this.flowParticles.some(p => {
                    const data = p.userData;
                    return data.active && data.progress > 0.85 &&
                        this.currentNetwork &&
                        this.currentNetwork.connections.some(c => c.to === idx);
                });

                if (receiving) {
                    mesh.material.emissiveIntensity = 0.8;
                } else {
                    mesh.material.emissiveIntensity = 0.3 + Math.sin(this.time * 2 + idx) * 0.1;
                }
            });
        }
    },

    /**
     * Animation loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        this.time += 0.016;

        if (this.autoRotate) {
            this.scene.rotation.y += this.rotationSpeed;
        }

        // Organic pulsing for all neurons
        this.cocoonMeshes.forEach((mesh, idx) => {
            if (!this.showFlow) {
                const pulse = Math.sin(this.time * 1.5 + idx * 0.3) * 0.5 + 0.5;
                mesh.material.emissiveIntensity = 0.25 + pulse * 0.15;
            }

            // Subtle rotation
            mesh.rotation.x += 0.002;
            mesh.rotation.z += 0.001;
        });

        // Pulse glow effects
        this.glowEffects.forEach((glow, idx) => {
            const pulse = Math.sin(this.time * 2 + idx * 0.5) * 0.5 + 0.5;
            glow.material.opacity = 0.1 + pulse * 0.1;
        });

        // Connection pulse
        this.connectionLines.forEach((tube, idx) => {
            const pulse = Math.sin(this.time * 1.5 + idx * 0.2) * 0.5 + 0.5;
            tube.material.opacity = 0.35 + pulse * 0.25;
            tube.material.emissiveIntensity = 0.15 + pulse * 0.2;
        });

        if (this.showFlow) {
            this.updateNeuralFlow();
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    },

    /**
     * Handle resize
     */
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    /**
     * Reset camera
     */
    resetView() {
        this.camera.position.set(0, 5, 18);
        this.controls.reset();
        this.scene.rotation.y = 0;
    },

    /**
     * Set theme and update colors
     */
    setTheme(themeName) {
        this.currentTheme = themeName;
        const theme = this.themes[themeName] || this.themes.ultron;

        // Update colors object
        this.colors = { ...theme };

        // Update scene background and fog
        if (this.scene) {
            this.scene.background = new THREE.Color(theme.background);
            this.scene.fog = new THREE.FogExp2(theme.fog, 0.02);
        }
    }
};

window.Renderer = Renderer;
