/**
 * ULTRON - Neural Experiment Viewer
 * 
 * Main application with NCX loading, experiment visualization,
 * inspector panel, and playback controls.
 */

// Application state
const App = {
    viewMode: 'experiment',  // 'experiment' or 'topology' (live demo)
    currentTopology: 'funnel',
    currentStructure: 'sphere',
    cocoonCount: 50,
    selectedCocoon: null,
    experimentLoaded: false
};

/**
 * Initialize application
 */
async function init() {
    // Initialize renderer
    const container = document.getElementById('canvas-container');
    Renderer.init(container);

    // Load data definitions for live demo mode
    await DataManager.loadAll();

    // Populate dropdowns for live demo
    populateDropdowns();

    // Build legend
    buildLegend();

    // Setup drag & drop
    setupDragAndDrop();

    // Setup click handler for inspector
    setupClickHandler();

    // Hide loading
    hideLoading();

    // Check for sample file
    console.log('ULTRON initialized. Load an experiment or switch to Live Demo mode.');
}

/**
 * Populate topology and structure dropdowns
 */
function populateDropdowns() {
    const topologySelect = document.getElementById('topology-select');
    const structureSelect = document.getElementById('structure-select');

    // Clear and populate topology dropdown
    topologySelect.innerHTML = '';
    for (const [id, topology] of Object.entries(DataManager.topologies)) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = topology.name;
        if (id === App.currentTopology) option.selected = true;
        topologySelect.appendChild(option);
    }

    // Clear and populate structure dropdown
    structureSelect.innerHTML = '';
    for (const [id, structure] of Object.entries(DataManager.structures)) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = structure.name;
        if (id === App.currentStructure) option.selected = true;
        structureSelect.appendChild(option);
    }
}

/**
 * Build type legend
 */
function buildLegend() {
    const legend = document.getElementById('type-legend');
    legend.innerHTML = '';

    const types = DataManager.types;
    for (const [id, type] of Object.entries(types)) {
        const item = document.createElement('div');
        item.className = 'legend-item';

        const dot = document.createElement('div');
        dot.className = 'legend-dot';
        dot.style.backgroundColor = type.color;
        dot.style.boxShadow = `0 0 8px ${type.color}`;

        const label = document.createElement('span');
        label.textContent = `${type.name} (${type.code}) - ${type.description.substring(0, 20)}...`;

        item.appendChild(dot);
        item.appendChild(label);
        legend.appendChild(item);
    }
}

/**
 * Setup drag & drop for NCX files
 */
function setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    const body = document.body;

    body.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('active');
    });

    body.addEventListener('dragleave', (e) => {
        if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
            dropZone.classList.remove('active');
        }
    });

    body.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');

        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.ncx.json') || file.name.endsWith('.json'))) {
            await loadNCXFileFromObject(file);
        }
    });

    dropZone.addEventListener('click', () => {
        dropZone.classList.remove('active');
    });
}

/**
 * Setup click handler for cocoon selection
 */
function setupClickHandler() {
    const canvas = document.getElementById('canvas-container');
    canvas.addEventListener('click', (e) => {
        // Raycast to find clicked cocoon
        const rect = canvas.getBoundingClientRect();
        const mouse = {
            x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
            y: -((e.clientY - rect.top) / rect.height) * 2 + 1
        };

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, Renderer.camera);
        const intersects = raycaster.intersectObjects(Renderer.cocoonMeshes);

        if (intersects.length > 0) {
            const mesh = intersects[0].object;
            selectCocoon(mesh.userData.index);
            Renderer.autoRotate = false;
            updateAutoRotateButton();
        } else {
            selectCocoon(null);
        }
    });
}

/**
 * Select and inspect a cocoon
 */
function selectCocoon(index) {
    App.selectedCocoon = index;

    const hint = document.querySelector('.inspector-hint');
    const details = document.getElementById('inspector-details');

    if (index === null) {
        hint.style.display = 'block';
        details.style.display = 'none';

        // Reset highlights
        Renderer.cocoonMeshes.forEach(mesh => {
            mesh.scale.setScalar(1);
        });
        return;
    }

    hint.style.display = 'none';
    details.style.display = 'block';

    // Highlight selected
    Renderer.cocoonMeshes.forEach((mesh, idx) => {
        mesh.scale.setScalar(idx === index ? 1.3 : 1);
    });

    // Update inspector values
    if (App.experimentLoaded && NCXLoader.currentExperiment) {
        const cocoon = NCXLoader.currentExperiment.cocoons[index];
        if (cocoon) {
            document.getElementById('inspector-id').textContent = cocoon.id;

            const seed = NCXLoader.getSeedById(cocoon.seedId);
            document.getElementById('inspector-type').textContent = seed?.name || `Seed ${cocoon.seedId}`;

            const pos = cocoon.position;
            document.getElementById('inspector-position').textContent =
                `(${pos[0].toFixed(1)}, ${pos[1].toFixed(1)}, ${pos[2].toFixed(1)})`;

            const conns = NCXLoader.getConnectionsForCocoon(cocoon.id);
            document.getElementById('inspector-connections').textContent =
                `In: ${conns.incoming}, Out: ${conns.outgoing}`;

            const activation = NCXLoader.getActivation(cocoon.id);
            document.getElementById('inspector-activation').textContent =
                activation ? activation[0].toFixed(4) : '-';
        }
    } else {
        // Live demo mode
        const mesh = Renderer.cocoonMeshes[index];
        document.getElementById('inspector-id').textContent = index;
        document.getElementById('inspector-type').textContent = mesh?.userData.type || '-';
        document.getElementById('inspector-position').textContent =
            mesh ? `(${mesh.position.x.toFixed(1)}, ${mesh.position.y.toFixed(1)}, ${mesh.position.z.toFixed(1)})` : '-';
        document.getElementById('inspector-connections').textContent = '-';
        document.getElementById('inspector-activation').textContent = '-';
    }
}

/**
 * Load NCX file from input
 */
async function loadNCXFile(input) {
    const file = input.files[0];
    if (file) {
        await loadNCXFileFromObject(file);
    }
    input.value = '';
}

/**
 * Load NCX from File object
 */
async function loadNCXFileFromObject(file) {
    showLoading();
    try {
        const experiment = await NCXLoader.loadFromFile(file);
        renderExperiment(experiment);
        App.experimentLoaded = true;
        setViewMode('experiment');
        console.log('Loaded experiment:', experiment.metadata?.name || 'Unknown');
    } catch (error) {
        console.error('Failed to load experiment:', error);
        alert('Failed to load NCX file: ' + error.message);
    }
    hideLoading();
}

/**
 * Load sample experiment
 */
async function loadSampleExperiment() {
    showLoading();
    try {
        // Try loading from samples folder
        const experiment = await NCXLoader.loadFromURL('samples/demo_hourglass.ncx.json');
        renderExperiment(experiment);
        App.experimentLoaded = true;
        setViewMode('experiment');
        console.log('Loaded sample experiment');
    } catch (error) {
        console.error('Failed to load sample:', error);
        alert('Sample experiment not found. Please place demo_hourglass.ncx.json in the samples folder.');
    }
    hideLoading();
}

/**
 * Render experiment from NCX data
 */
function renderExperiment(experiment) {
    const stats = Renderer.renderTopology(experiment.network);

    // Update stats
    updateStats(stats.cocoons, stats.connections);

    // Update experiment info
    document.getElementById('info-name').textContent =
        experiment.metadata?.name || 'Unnamed';
    document.getElementById('info-topology').textContent =
        experiment.topology?.type || '-';
    document.getElementById('info-cocoons').textContent =
        experiment.cocoons?.length || 0;
    document.getElementById('info-connections').textContent =
        experiment.connections?.length || 0;
    document.getElementById('info-history').textContent =
        experiment.history?.length || 0;

    // Setup timeline
    const range = NCXLoader.getTimestepRange();
    const slider = document.getElementById('timeline-slider');
    slider.min = range.min;
    slider.max = range.max;
    slider.value = NCXLoader.currentTimestep;
    updateTimelineDisplay();

    // Build legend from seeds
    buildSeedLegend(experiment.seeds);

    selectCocoon(null);
}

/**
 * Build legend from experiment seeds
 */
function buildSeedLegend(seeds) {
    const legend = document.getElementById('type-legend');
    legend.innerHTML = '';

    if (!seeds || seeds.length === 0) {
        // Use default types
        buildLegend();
        return;
    }

    seeds.forEach(seed => {
        const item = document.createElement('div');
        item.className = 'legend-item';

        const dot = document.createElement('div');
        dot.className = 'legend-dot';
        dot.style.backgroundColor = seed.color;
        dot.style.boxShadow = `0 0 8px ${seed.color}`;

        const label = document.createElement('span');
        label.textContent = `${seed.name} (${seed.code || seed.id})`;

        item.appendChild(dot);
        item.appendChild(label);
        legend.appendChild(item);
    });
}

/**
 * Set view mode (experiment or live demo)
 */
function setViewMode(mode) {
    App.viewMode = mode;

    document.getElementById('btn-experiment').classList.toggle('active', mode === 'experiment');
    document.getElementById('btn-topology').classList.toggle('active', mode === 'topology');

    const liveControls = document.getElementById('live-controls');
    liveControls.style.display = mode === 'topology' ? 'block' : 'none';

    if (mode === 'topology' && !App.experimentLoaded) {
        // Switch to live demo - generate topology
        regenerate();
    }
}

/**
 * Change topology (live demo mode)
 */
function changeTopology(value) {
    App.currentTopology = value;
    if (App.viewMode === 'topology') {
        regenerate();
    }
}

/**
 * Change structure (live demo mode)
 */
function changeStructure(value) {
    App.currentStructure = value;
}

/**
 * Update cocoon count
 */
function updateCocoonCount(value) {
    App.cocoonCount = parseInt(value);
    document.getElementById('cocoon-count').textContent = value;
    if (App.viewMode === 'topology') {
        regenerate();
    }
}

/**
 * Update rotation speed
 */
function updateSpeed(value) {
    Renderer.rotationSpeed = (value / 100) * 0.01;
    document.getElementById('speed-value').textContent = value + '%';
}

/**
 * Update stats display
 */
function updateStats(cocoons, connections) {
    document.getElementById('stat-cocoons').textContent = cocoons;
    document.getElementById('stat-connections').textContent = connections;
}

/**
 * Regenerate network (live demo mode)
 */
function regenerate() {
    const topology = DataManager.topologies[App.currentTopology];
    if (!topology) return;

    showLoading();

    // Save current states before regenerating
    const wasFlowEnabled = Renderer.showFlow;
    const wasAutoRotate = Renderer.autoRotate;

    const types = DataManager.types;
    const typeList = Object.keys(types);

    const network = Generators.generateTopology(
        App.currentTopology,
        App.cocoonCount,
        topology.parameters || {},
        typeList
    );

    const stats = Renderer.renderTopology(network);
    updateStats(stats.cocoons, stats.connections);

    // Restore flow state if it was enabled
    if (wasFlowEnabled) {
        Renderer.toggleFlow(true);
    }

    // Restore auto-rotate state
    Renderer.autoRotate = wasAutoRotate;

    // Update info panel
    document.getElementById('info-name').textContent = 'Live Demo';
    document.getElementById('info-topology').textContent = topology.name;
    document.getElementById('info-cocoons').textContent = App.cocoonCount;
    document.getElementById('info-connections').textContent = stats.connections;
    document.getElementById('info-history').textContent = '-';

    buildLegend();
    selectCocoon(null);
    hideLoading();
}

/**
 * Reset camera view
 */
function resetView() {
    Renderer.resetView();
}

/**
 * Toggle auto rotation
 */
function toggleAutoRotate() {
    Renderer.autoRotate = !Renderer.autoRotate;
    updateAutoRotateButton();
}

function updateAutoRotateButton() {
    document.getElementById('btn-auto-rotate').classList.toggle('active', Renderer.autoRotate);
}

/**
 * Toggle neural flow
 */
function toggleFlow() {
    Renderer.toggleFlow(!Renderer.showFlow);
    document.getElementById('btn-flow').classList.toggle('active', Renderer.showFlow);
}

/**
 * Playback controls
 */
function stepForward() {
    if (NCXLoader.stepForward()) {
        updateTimelineDisplay();
        applyActivations();
    }
}

function stepBackward() {
    if (NCXLoader.stepBackward()) {
        updateTimelineDisplay();
        applyActivations();
    }
}

function seekTimeline(value) {
    NCXLoader.seekTo(parseInt(value));
    updateTimelineDisplay();
    applyActivations();
}

function togglePlayback() {
    const playing = NCXLoader.togglePlayback((isPlaying) => {
        updateTimelineDisplay();
        applyActivations();
        document.getElementById('btn-play').textContent = isPlaying ? '⏸' : '▶';
    });
    document.getElementById('btn-play').textContent = playing ? '⏸' : '▶';
}

function updateTimelineDisplay() {
    const slider = document.getElementById('timeline-slider');
    slider.value = NCXLoader.currentTimestep;

    const range = NCXLoader.getTimestepRange();
    document.getElementById('timeline-value').textContent =
        `${NCXLoader.currentTimestep} / ${range.max}`;
    document.getElementById('stat-timestep').textContent = NCXLoader.currentTimestep;
}

function applyActivations() {
    if (!NCXLoader.currentExperiment) return;

    const history = NCXLoader.currentExperiment.history;
    const step = history.find(h => h.timestep === NCXLoader.currentTimestep);
    if (!step || !step.activations) return;

    Renderer.cocoonMeshes.forEach((mesh, idx) => {
        const cocoon = NCXLoader.currentExperiment.cocoons[idx];
        if (!cocoon) return;

        const activation = step.activations[String(cocoon.id)];
        if (activation && activation.length > 0) {
            const intensity = Math.abs(activation[0]);
            mesh.material.emissiveIntensity = 0.3 + intensity * 0.7;
        } else {
            mesh.material.emissiveIntensity = 0.2;
        }
    });

    // Update inspector if cocoon selected
    if (App.selectedCocoon !== null) {
        selectCocoon(App.selectedCocoon);
    }
}

/**
 * Show/hide loading
 */
function showLoading() {
    document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);

// Make functions globally available
window.setViewMode = setViewMode;
window.changeTopology = changeTopology;
window.changeStructure = changeStructure;
window.updateCocoonCount = updateCocoonCount;
window.updateSpeed = updateSpeed;
window.resetView = resetView;
window.toggleAutoRotate = toggleAutoRotate;
window.toggleFlow = toggleFlow;
window.regenerate = regenerate;
window.loadNCXFile = loadNCXFile;
window.loadSampleExperiment = loadSampleExperiment;
window.stepForward = stepForward;
window.stepBackward = stepBackward;
window.seekTimeline = seekTimeline;
window.togglePlayback = togglePlayback;

// Theme state
let currentTheme = 'ultron';

/**
 * Toggle between Ultron and Jarvis themes
 */
function toggleTheme() {
    currentTheme = currentTheme === 'ultron' ? 'jarvis' : 'ultron';
    
    // Update CSS theme
    document.body.setAttribute('data-theme', currentTheme === 'jarvis' ? 'jarvis' : '');
    
    // Update button text
    document.getElementById('btn-theme').textContent = currentTheme === 'ultron' ? 'JARVIS' : 'ULTRON';
    
    // Update logo text
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.innerHTML = currentTheme === 'jarvis' 
            ? 'JARVIS<span class=\"logo-subtitle\">Neural Experiment Viewer</span>'
            : 'ULTRON<span class=\"logo-subtitle\">Neural Experiment Viewer</span>';
    }
    
    // Update renderer colors
    Renderer.setTheme(currentTheme);
    
    // Re-render if there's data
    if (Renderer.currentNetwork) {
        const wasFlowEnabled = Renderer.showFlow;
        Renderer.renderTopology(Renderer.currentNetwork);
        if (wasFlowEnabled) {
            Renderer.toggleFlow(true);
        }
    }
}

window.toggleTheme = toggleTheme;
