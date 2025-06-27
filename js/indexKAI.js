import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// URLパラメータを解析してCONFIGを更新する関数
function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const configKeys = ['debugScreen', 'splashScreen', 'startScreen', 'gridHelper', 'axesHelper', 'orbitControls'];
    
    configKeys.forEach(key => {
        const value = urlParams.get(key);
        if (value !== null) {
            if (value === '1') {
                CONFIG.debug[key] = true;
            } else if (value === '0') {
                CONFIG.debug[key] = false;
            }
            // その他の値は無視
        }
    });
}

// Configuration
const CONFIG = {
    images: {
        earth: 'images/textures/earth.png',
        cloud: 'images/textures/cloud.png',
        moon: 'images/textures/moon.png',
        select: 'images/textures/select.png'
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
    cameraPosition: {
        first: new THREE.Vector3(0, 25, 0),
        second: new THREE.Vector3(0, 25, 0)
    },
    click: {
        zoomFactor: 2.5, // How many times the object's size to zoom in
        animationSpeed: 0.04 // 0 to 1, higher is faster
    },
    debug: {
        gridHelper: true,
        axesHelper: true,
        orbitControls: true,
        splashScreen: true,
        startScreen: true,
        debugScreen: false
    }
};

// Global variables
let scene, camera, renderer, controls;
let earth, cloudMesh, moonMesh, pivot, orbitLine, selectMarker;
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
let previousDistance = 0; // 前回の距離を記録する変数を追加

// Add hover state tracking
let currentHoveredObject = null;
let lastHoverCheckTime = 0;
const HOVER_CHECK_INTERVAL = 50; // Check hover state every 50ms

// --- Loading Screen Fade Utility ---
function showLoadingScreen() {
    const loading = document.getElementById('loading-screen');
    if (!loading) return;
    loading.style.display = 'flex'; // まず表示状態にする
    loading.classList.remove('fade-out');
    // 次のフレームでfade-in開始（CSS transitionが効くように）
    requestAnimationFrame(() => {
        loading.classList.add('visible');
    });
}
function hideLoadingScreen() {
    const loading = document.getElementById('loading-screen');
    if (!loading) return;
    loading.classList.add('fade-out');
    loading.classList.remove('visible');
    setTimeout(() => {
        loading.classList.remove('fade-out');
        loading.style.display = 'none'; // 完全に非表示にする
    }, 500); // CSSのtransitionと合わせる
}

// --- Map/Canvas Switch Logic ---
function showMapScreen(map) {

    // アニメーション中の操作を防ぐオーバーレイを非表示
    const animationOverlay = document.getElementById('animation-overlay');
    if (animationOverlay) {
        animationOverlay.style.display = 'none';
    }
    
    // map: 'earth' or 'moon'
    showLoadingScreen();
    setTimeout(() => {
        document.getElementById('renderCanvas').style.display = 'none';
        // インラインスタイルを直接設定（CSSクラスより優先度が高い）
        document.getElementById('earth-map').style.display = 'none';
        document.getElementById('moon-map').style.display = 'none';
        if (map === 'earth') {
            document.getElementById('earth-map').style.display = 'flex';
        } else {
            document.getElementById('moon-map').style.display = 'flex';
        }
        hideLoadingScreen();
    }, 500);
}
function showCanvasScreen() {
    showLoadingScreen();
    setTimeout(() => {
        // インラインスタイルを直接設定
        document.getElementById('earth-map').style.display = 'none';
        document.getElementById('moon-map').style.display = 'none';
        document.getElementById('renderCanvas').style.display = 'block';
        
        // キャンバスに戻った時にレンダリングを再開
        restartRendering();
        
        hideLoadingScreen();
    }, 500);
}

// レンダリングを再開する関数
function restartRendering() {
    // カメラのアスペクト比を再計算
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    // レンダラーのサイズを更新
    renderer.setSize(width, height);
    
    // コントロールを有効化（もし無効になっていた場合）
    if (controls) {
        controls.enabled = true;
    }
    controls.target.copy(centerPoint);
    
    // アニメーション状態をリセット
    isAnimating = false;
    previousDistance = 0;
    
    // レンダリングループを再開
    requestAnimationFrame(tick);
}

document.addEventListener('DOMContentLoaded', () => {
    // 戻るボタン
    document.getElementById('back-to-canvas-earth').onclick = showCanvasScreen;
    document.getElementById('back-to-canvas-moon').onclick = showCanvasScreen;
});

// Initialize the 3D scene
function init() {
    // URLパラメータを解析してCONFIGを更新
    parseUrlParams();
    
    setupRenderer();
    setupScene();
    setupCamera();
    setupControls();
    setupLighting();
    createEarth();
    createMoon();
    createOrbitLine();
    createSelectMarker();

    // listen for hover
    // Listen for mouse events
    /*window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('mousedown', onMouseDown, false);
    window.addEventListener('mouseup', onMouseUp, false);*/
    renderer.domElement.addEventListener('mousemove', onMouseMove, false);
    renderer.domElement.addEventListener('mousedown', onMouseDown, false);
    renderer.domElement.addEventListener('mouseup', onMouseUp, false);

    onResize();
    window.addEventListener('resize', onResize);

    if (CONFIG.debug.splashScreen) {
        hideSplashScreen(1900,800);
    }else{
        hideSplashScreen(0,0);
    }

    if (!CONFIG.debug.startScreen) {
        hideStartScreen(0,0);
    }

    if (CONFIG.debug.debugScreen) {
        document.getElementById('debug-screen').style.display = 'block';
    }
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

    scene.background = new THREE.Color(0x190018); // Set background color
    scene.fog = new THREE.FogExp2(0xFFFFFF, 0.002); // Add fog for depth

    // Add grid helper for reference
    if (CONFIG.debug.gridHelper) {
        const gridHelper = new THREE.GridHelper(100, 100);
        scene.add(gridHelper);
    }
}

function setupCamera() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
    camera.position.copy(CONFIG.cameraPosition.first);
}

function setupControls() {
    if (CONFIG.debug.orbitControls) {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enableZoom = true;
        controls.minDistance = 50;
        controls.maxDistance = 250;
        controls.target.copy(centerPoint);
    }
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
    if (CONFIG.debug.axesHelper) {
        earth.add(new THREE.AxesHelper(10));
    }

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

function createSelectMarker() {
    const loader = new THREE.TextureLoader();
    const selectTexture = loader.load(CONFIG.images.select);
    configureTexture(selectTexture);

    // マーカーのジオメトリをBoxGeometryに変更し、テクスチャを適用します
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
        map: selectTexture,
        transparent: true, // テクスチャの透明部分を透過させます
        side: THREE.DoubleSide
    });
    selectMarker = new THREE.Mesh(geometry, material);
    selectMarker.name = "select_marker";
    selectMarker.visible = false; // 最初は非表示にします
    scene.add(selectMarker);
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
        selectMarker.visible = false; // Hide the marker during animation
        animationTargetInfo.object = targetObject;

        // アニメーション中の操作を防ぐオーバーレイを表示
        const animationOverlay = document.getElementById('animation-overlay');
        if (animationOverlay) {
            animationOverlay.style.display = 'block';
        }

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
            
        // アニメーション開始時の距離を初期化
        previousDistance = camera.position.distanceTo(animationTargetInfo.cameraEndPos);
    }
}

function onMouseMove(event) {
    if (isAnimating) return;

    // マウスカーソルの位置を正規化
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    // Update hover state
    updateHoverState();
}

function updateHoverState() {
    if (isAnimating) return;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(interactiveObjects, false);

    const hoveredObject = hits.length > 0 ? hits[0].object : null;

    // Only update if hover state changed
    if (currentHoveredObject !== hoveredObject) {
        currentHoveredObject = hoveredObject;
        
        // 全てのインタラクティブオブジェクトのスケールを更新
        interactiveObjects.forEach(obj => {
            obj.scale.setScalar(
                hoveredObject === obj ? 1.2 : 1.0
            );
        });

        // 最初にマーカーを現在の親から削除します
        if (selectMarker.parent) {
            selectMarker.parent.remove(selectMarker);
        }
        // デフォルトでシーンに所属させ、非表示にします
        scene.add(selectMarker);
        selectMarker.visible = false;

        // ホバーされているオブジェクトがある場合、マーカーを更新します
        if (hoveredObject) {
            // マーカーをホバーされたオブジェクトの子にします
            hoveredObject.add(selectMarker);
            selectMarker.visible = true;

            // 親オブジェクトのローカル座標の中心に配置します
            selectMarker.position.set(0, 0, 0);

            // オブジェクトのジオメトリサイズの1.1倍にマーカーをスケール
            const objectSize = hoveredObject.name === 'earth' ? CONFIG.earth.size : CONFIG.moon.size;
            const parentScale = hoveredObject.scale.x; // 均等なスケーリングを想定
            const markerScale = (objectSize * 1.4) / parentScale;
            selectMarker.scale.set(markerScale, markerScale, markerScale);
        }
    }
}

// Animation loop
let lastTime = performance.now();

function tick() {
    if (isAnimating) {
        // Animate camera and controls target towards their end positions
        const speed = CONFIG.click.animationSpeed;
        camera.position.lerp(animationTargetInfo.cameraEndPos, speed);
        controls.target.lerp(animationTargetInfo.controlsEndPos, speed);

        // Hide the loading screen
        //const loadingScreen = document.getElementById('loading-screen');
        //loadingScreen.style.display = 'none';

        // 現在の距離を計算
        const currentDistance = camera.position.distanceTo(animationTargetInfo.cameraEndPos);
        
        // 前回の距離との差分を計算
        const distanceDifference = Math.abs(currentDistance - previousDistance);
        
        // 差分が0.1未満になったらアニメーション完了とみなす
        if (distanceDifference < 0.1) {
            isAnimating = false; // Stop the animation loop

            

            // Perform the map screen transition instead of page transition
            const pageName = animationTargetInfo.object.name;
            if (pageName === 'earth') {
                showMapScreen('earth');
            } else if (pageName === 'moon') {
                showMapScreen('moon');
            }

            
            
            return; // Exit tick to prevent further rendering this frame
        }
        
        // 現在の距離を前回の距離として保存
        previousDistance = currentDistance;
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

        // Periodically check hover state to handle moving objects like the moon
        if (nowTime - lastHoverCheckTime > HOVER_CHECK_INTERVAL) {
            lastHoverCheckTime = nowTime;
            updateHoverState();
        }
    }

    if (CONFIG.debug.debugScreen) {
        document.getElementById('camera-position').textContent = camera.position.toArray().toString();
        document.getElementById('controls-target').textContent = controls.target.toArray().toString();
        document.getElementById('camera-distance').textContent = camera.position.distanceTo(animationTargetInfo.cameraEndPos).toString();
        document.getElementById('is-animating').textContent = isAnimating.toString();
        document.getElementById('animation-target-info-camera-end-pos').textContent = animationTargetInfo.cameraEndPos.toArray().toString();
        document.getElementById('animation-target-info-controls-end-pos').textContent = animationTargetInfo.controlsEndPos.toArray().toString();
        document.getElementById('previous-distance').textContent = previousDistance.toString();
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

window.launch = function() {
    //window.location.href = "earth.html";
    hideStartScreen(0,900);
}

// Initialize and start
init();
tick();