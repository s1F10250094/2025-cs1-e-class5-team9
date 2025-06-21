import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Configuration
const CONFIG = {
    images: {
        earth: 'images/textures/earth.png',
        cloud: 'images/textures/cloud.png',
        moon: 'images/textures/moon.png'
    },
    moon: {
        radius: 64,
        size: 12,
        orbitTiltDegrees: -10
    },
    earth: {
        size: 16,
        tiltDegrees: 21.4
    },
    cloud: {
        size: 16.5,
        opacity: 0.9
    },
    animation: {
        earthRotationSpeed: 0.01,
        moonRotationSpeed: 0.012,
        orbitSpeed: 0.008
    },
    click: {
        zoomFactor: 2.5, // How many times the object's size to zoom in
        animationSpeed: 0.08 // 0 to 1, higher is faster
    }
};

// Global variables
let scene, camera, renderer, controls;
let earth, cloudMesh, moonMesh, pivot, orbitLine;
let centerPoint = new THREE.Vector3(0, 25, 0);
let animationDirection = 1;

let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let interactiveObjects = [];

// New globals for click/animation handling
let mouseDownTime = 0;
const LONG_PRESS_DURATION = 500; // ms
let isAnimating = false;
let animationTargetInfo = {
    object: null,
    cameraEndPos: new THREE.Vector3(),
    controlsEndPos: new THREE.Vector3()
};


// Initialize the 3D scene
function init() {
    setupRenderer();
    setupScene();
    setupCamera();
    setupControls();
    setupLighting();
    createEarth();
    createMoon();
    createOrbitLine();

    // listen for hover
    // Listen for mouse events
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('mousedown', onMouseDown, false);
    window.addEventListener('mouseup', onMouseUp, false);

    onResize();
    window.addEventListener('resize', onResize);
}

function setupRenderer() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector('#renderCanvas')
    });
    renderer.setSize(width, height);
}

function setupScene() {
    scene = new THREE.Scene();

    // Add grid helper for reference
    const gridHelper = new THREE.GridHelper(100, 100);
    scene.add(gridHelper);
}

function setupCamera() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
}

function setupControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.minDistance = 50;
    controls.maxDistance = 250;
    controls.target.copy(centerPoint);
}

function setupLighting() {
    const directionalLight = new THREE.DirectionalLight(0xFFFFFF);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
}

function createEarth() {
    const loader = new THREE.TextureLoader();

    // Earth geometry and material
    const earthGeometry = new THREE.BoxGeometry(CONFIG.earth.size, CONFIG.earth.size, CONFIG.earth.size);
    const earthTexture = loader.load(CONFIG.images.earth);
    configureTexture(earthTexture);

    const earthMaterial = new THREE.MeshBasicMaterial({
        map: earthTexture
    });

    earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.position.copy(centerPoint);
    earth.name = "earth";
    earth.rotation.set(
        CONFIG.earth.tiltDegrees * Math.PI / 180,
        CONFIG.earth.tiltDegrees * Math.PI / 180,
        0
    );

    // Add axis helper for debugging
    earth.add(new THREE.AxesHelper(10));

    // Create clouds
    createClouds(loader);

    interactiveObjects.push(earth);
    scene.add(earth);
}

function createClouds(loader) {
    const cloudTexture = loader.load(CONFIG.images.cloud);
    configureTexture(cloudTexture);

    const cloudGeometry = new THREE.BoxGeometry(CONFIG.cloud.size, CONFIG.cloud.size, CONFIG.cloud.size);
    const cloudMaterial = new THREE.MeshBasicMaterial({
        map: cloudTexture,
        color: 0xffffff,
        transparent: true,
        opacity: CONFIG.cloud.opacity
    });

    cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloudMesh.name = "clouds";

    earth.add(cloudMesh);
}

function createMoon() {
    const loader = new THREE.TextureLoader();

    // Create pivot for moon orbit
    const tiltAngleRadians = THREE.MathUtils.degToRad(CONFIG.moon.orbitTiltDegrees);
    pivot = new THREE.Group();
    pivot.position.copy(centerPoint);
    pivot.rotation.x = tiltAngleRadians;
    scene.add(pivot);

    // Moon geometry and material
    const moonGeometry = new THREE.BoxGeometry(CONFIG.moon.size, CONFIG.moon.size, CONFIG.moon.size);
    const moonTexture = loader.load(CONFIG.images.moon);
    configureTexture(moonTexture);

    const moonMaterial = new THREE.MeshBasicMaterial({
        color: 0x888888,
        map: moonTexture
    });

    moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    moonMesh.position.z = CONFIG.moon.radius;
    moonMesh.name = "moon";

    interactiveObjects.push(moonMesh);
    pivot.add(moonMesh);
}

function createOrbitLine() {
    const orbitGeometry = new THREE.RingGeometry(
        CONFIG.moon.radius - 0.2,
        CONFIG.moon.radius + 0.2,
        64, 1, 0, Math.PI * 2
    );

    const orbitMaterial = new THREE.MeshBasicMaterial({
        color: 0xe6e6fa,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
    });

    orbitLine = new THREE.Mesh(orbitGeometry, orbitMaterial);
    orbitLine.rotation.x = Math.PI / 2;

    pivot.add(orbitLine);
}

function configureTexture(texture) {
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
}

function onMouseDown(event) {
    // Record the time when the mouse is pressed down
    mouseDownTime = Date.now();
}

function onMouseUp(event) {
    const pressDuration = Date.now() - mouseDownTime;

    // Ignore if it's a long press (drag) or if an animation is already running
    if (pressDuration > LONG_PRESS_DURATION || isAnimating) {
        return;
    }

    // It's a click, so proceed with raycasting
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(interactiveObjects, false);

    if (hits.length > 0) {
        const targetObject = hits[0].object;

        // Start the zoom animation
        isAnimating = true;
        controls.enabled = false; // Disable user controls during animation
        animationTargetInfo.object = targetObject;

        // Calculate where the controls should look at (the object's world center)
        targetObject.getWorldPosition(animationTargetInfo.controlsEndPos);

        // Calculate where the camera should end up
        const objectSize = targetObject.name === 'earth' ? CONFIG.earth.size : CONFIG.moon.size;
        const distance = objectSize * CONFIG.click.zoomFactor;

        const direction = new THREE.Vector3()
            .subVectors(camera.position, animationTargetInfo.controlsEndPos)
            .normalize();

        animationTargetInfo.cameraEndPos
            .copy(animationTargetInfo.controlsEndPos)
            .add(direction.multiplyScalar(distance));
    }
}

function onMouseMove(event) {

    if (isAnimating) return;

    // normalize mouse coords to -1…+1
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(interactiveObjects, false);

    // scale hovered / reset others
    interactiveObjects.forEach(obj => {
        obj.scale.setScalar(
            hits.length && hits[0].object === obj ? 1.2 : 1.0
        );
    });
}

// Animation loop
let lastTime = performance.now();

function tick() {
    if (isAnimating) {
        // Animate camera and controls target towards their end positions
        const speed = CONFIG.click.animationSpeed;
        camera.position.lerp(animationTargetInfo.cameraEndPos, speed);
        controls.target.lerp(animationTargetInfo.controlsEndPos, speed);

        // Check if the animation is close to complete
        if (camera.position.distanceTo(animationTargetInfo.cameraEndPos) < 0.1) {
            isAnimating = false; // Stop the animation loop

            // Perform the page transition
            const pageName = animationTargetInfo.object.name;
            window.location.href = `${pageName}.html`; // e.g., "earth.html"
            return; // Exit tick to prevent further rendering this frame
        }
    } else {
        // Normal animation when not zooming
        const nowTime = performance.now();
        const deltaTime = nowTime - lastTime;
        lastTime = nowTime;

        // Animate rotations
        const timeScale = deltaTime / 100;
        earth.rotation.y += CONFIG.animation.earthRotationSpeed * timeScale * animationDirection;
        moonMesh.rotation.y += CONFIG.animation.moonRotationSpeed * timeScale * animationDirection;
        pivot.rotation.y += CONFIG.animation.orbitSpeed * timeScale * animationDirection * -1;
    }

    // Update controls and render
    controls.update();
    renderer.render(scene, camera);

    requestAnimationFrame(tick);
}

function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

// Initialize and start
init();
tick();