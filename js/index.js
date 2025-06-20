import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let images = {
    earth:'images/textures/earth.png',
    cloud:'images/textures/cloud.png',
    moon:'images/textures/moon.png'
};
let scene, camera, renderer, earth, cloudMesh;
let gridHelper
let raycaster, mouse, controls;
let centerPoint, radius, tiltAngleDegrees, tiltAngleRadians, pivot;
let moonMesh, moonGeometry, moonMaterial;
let meshList = [];

// 3D空間を作成するための初期化関数
function init() {
    meshList = []; // メッシュのリストを初期化
    // サイズを取得
    const width = window.innerWidth;
    const height = window.innerHeight;

    //Set Center Point
    centerPoint = new THREE.Vector3(0, 25, 0);

    // レンダラーを作成
    renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector('#renderCanvas')
    });
    renderer.setSize(width, height);

    // シーンを作成
    scene = new THREE.Scene();

    // カメラを作成
    camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
    //camera.position.copy(centerPoint + (60 , 0,0)); // カメラを中心点に配置

    //raycasterの初期化
    mouse = new THREE.Vector2();
    document.addEventListener('click', onMouseEvent, false);
    //document.addEventListener('mousemove', handleMouseMove);

    // ▼▼▼ OrbitControlsの初期化 ▼▼▼
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // 滑らかな動き（慣性）を有効にする
    controls.dampingFactor = 0.05;
    controls.enableZoom = true; // ズームを有効にする
    controls.minDistance = 50; // ズームの最小距離
    controls.maxDistance = 250; // ズームの最大距離
    controls.target.copy(centerPoint);

    // 地面としてグリッドヘルパーを設置
    gridHelper = new THREE.GridHelper(100, 100);
    scene.add(gridHelper);

    raycaster = new THREE.Raycaster();

    // 球体を作成
    const geometry = new THREE.BoxGeometry(16, 16, 16);
    // 画像を読み込む
    const loader = new THREE.TextureLoader();
    const earthTexture = loader.load(images.earth);
    earthTexture.minFilter = THREE.NearestFilter;
    earthTexture.magFilter = THREE.NearestFilter;
    earthTexture.colorSpace = THREE.SRGBColorSpace;
    // マテリアルにテクスチャーを設定
    const material = new THREE.MeshBasicMaterial({
        map: earthTexture
    });
    // メッシュを作成
    earth = new THREE.Mesh(geometry, material);
    earth.position.copy(centerPoint); // 中心点に配置
    earth.name = "earth";

    earth.add(new THREE.AxesHelper(10)); // 軸ヘルパーを追加

    let cloudTexture = loader.load(images.cloud);
    cloudTexture.colorSpace = THREE.SRGBColorSpace; // 色空間を設定
    cloudTexture.minFilter = THREE.NearestFilter;
    cloudTexture.magFilter = THREE.NearestFilter; // フィルタリングを設定

    cloudMesh = new THREE.Mesh(
        new THREE.BoxGeometry(16.5, 16.5, 16.5),
        new THREE.MeshBasicMaterial({
            map: cloudTexture,
            color: 0xffffff,
            transparent: true,
            opacity: 0.9
        })
    );
    cloudMesh.name = "clouds"; // 雲の名前を設定

    
    earth.add(cloudMesh); // 雲のメッシュを地球のメッシュに追加

    earth.rotation.set(21.4 * Math.PI / 180, 21.4 * Math.PI / 180, 0); // 地球の傾きを設定

    
    // 3D空間にメッシュを追加
    scene.add(earth);


    radius = 64;
    tiltAngleDegrees = -10;
    tiltAngleRadians = THREE.MathUtils.degToRad(tiltAngleDegrees);

    pivot = new THREE.Group();
    pivot.position.copy(centerPoint);
    pivot.rotation.x = tiltAngleRadians;
    scene.add(pivot);


    //月の作成

    let moonTexture = loader.load(images.moon);
    moonTexture.colorSpace = THREE.SRGBColorSpace; // 色空間を設定
    moonTexture.minFilter = THREE.NearestFilter
    moonTexture.magFilter = THREE.NearestFilter; // フィルタリングを設定

    moonGeometry = new THREE.BoxGeometry(12,12,12);

    moonMaterial = new THREE.MeshBasicMaterial({
        color: 0x888888,
        map: moonTexture
    });
    moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    moonMesh.position.z = radius; // 月の位置を設定
    moonMesh.name = "moon"; // 月の名前を設定
    pivot.add(moonMesh); // 月をピボットに追加
    
    meshList.push(earth); // メッシュをリストに追加
    meshList.push(cloudMesh); // 雲のメッシュもリストに追加
    meshList.push(moonMesh);

    // 平行光源
    const directionalLight = new THREE.DirectionalLight(0xFFFFFF);
    directionalLight.position.set(1, 1, 1);
    // シーンに追加
    scene.add(directionalLight);
    onResize();
    
}



let a = 1

function handleMouseMove(event) {
        const element = event.currentTarget;
        // canvas要素上のXY座標
        const x = event.clientX - element.offsetLeft;
        const y = event.clientY - element.offsetTop;
        // canvas要素の幅・高さ
        const w = element.offsetWidth;
        const h = element.offsetHeight;

        // -1〜+1の範囲で現在のマウス座標を登録する
        mouse.x = (x / w) * 2 - 1;
        mouse.y = -(y / h) * 2 + 1;
}

function onMouseEvent(event) {
    event.preventDefault();

    // 座標を正規化する呪文
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // レイキャスティングでマウスと重なるオブジェクトを取得
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);

    

    // 取得したオブジェクトの色を青色に変える
    /*
    for (let i = 0; i < intersects.length; i++) {
        //intersects[i].object.material.color.set(0x0000ff);
        if (intersects[i].object.name === "earth") {
            // クリックしたオブジェクトの名前をコンソールに表示
            console.log("Clicked on: " + intersects[i].object.name);
            // クリックしたオブジェクトの色を赤色に変える
            a = a * -1;
            console.log("Value of \"a\": " + a);
        }
    }
    */
}


init();


window.addEventListener('resize', onResize);

var lastTime = performance.now(),
    lastFrame = 0;
tick();

// 毎フレーム時に実行されるループイベントです
function tick() {


    /*meshList.map((mesh) => {
          // 交差しているオブジェクトが1つ以上存在し、
          // 交差しているオブジェクトの1番目(最前面)のものだったら
        if (intersects.length > 0 && mesh === intersects[0].object) {
            // 色を赤くする
            //mesh.material.color.setHex(0xff0000);
            console.log("Clicked on: " + mesh.name);
            mesh.scale.set(1.2, 1.2, 1.2); // クリックしたオブジェクトを拡大
        } else {
            // それ以外は元の色にする
            //mesh.material.color.setHex(0xffffff);
            mesh.scale.set(1, 1, 1); // クリックしたオブジェクトを拡大
        }
    });*/


    var nowTime = performance.now(),
        time = nowTime - lastTime;
    lastTime = nowTime;
    // メッシュを回転させる
    earth.rotation.y += (0.01 * time / 100) * a;
    moonMesh.rotation.y += (0.012 * time / 100) * a;

    pivot.rotation.y += (0.008 * time / 100) * a * -1;

    // ▼▼▼ OrbitControlsを更新 ▼▼▼
    // enableDamping=trueの場合、毎フレーム呼び出す必要がある
    controls.update();
    // レンダリング
    renderer.render(scene, camera);

    requestAnimationFrame(tick);
}



function onResize() {
    // サイズを取得
    const width = window.innerWidth;
    const height = window.innerHeight;

    // レンダラーのサイズを調整する
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);

    // カメラのアスペクト比を正す
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}