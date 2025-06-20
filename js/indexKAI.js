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
    window.addEventListener('mousemove', onMouseMove, false);

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

function onMouseMove(event) {
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
    const nowTime = performance.now();
    const deltaTime = nowTime - lastTime;
    lastTime = nowTime;
    
    // Animate rotations
    const timeScale = deltaTime / 100;
    earth.rotation.y += CONFIG.animation.earthRotationSpeed * timeScale * animationDirection;
    moonMesh.rotation.y += CONFIG.animation.moonRotationSpeed * timeScale * animationDirection;
    pivot.rotation.y += CONFIG.animation.orbitSpeed * timeScale * animationDirection * -1;
    
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