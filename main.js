window.addEventListener("DOMContentLoaded", init);

import * as THREE from 'three';
import { VRButton } from "three/addons/webxr/VRButton.js";
import WebXRPolyfill from "webxr-polyfill";
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.150.1/examples/jsm/webxr/XRControllerModelFactory.js';

//ファイル名宣言
const fileName = "bio-CE-CX300.csv";

//データの座標範囲の上限と下限の設定
let max = 1;
let min = -max;

//削除回数
let deleteTimes = 10;

// ノード座標を保持する配列
let nodePositions = [];
let networkData;

//半径
let radius = 0.2;

//自動設定
//範囲
const autoRangeSetting = true; //true:データの数に応じて範囲を設定　false:グローバル変数を参照
//削除回数
const autodeleteSetting = true; //true:データの数に応じて削除回数を設定　false:グローバル変数を参照
//削除回数
const autoRadius = true; //true:データの数に応じてnodeの半径を設定　false:グローバル変数を参照



function init() {
  /* ----基本的な設定----- */
  // WebXRのポリフィルを有効にする
  const polyfill = new WebXRPolyfill();

  // サイズを指定
  const width = window.innerWidth;
  const height = window.innerHeight;

  // シーンの作成
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // レンダラーの作成
  const renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.xr.enabled = true; // レンダラーのXRを有効化
  document.body.appendChild(renderer.domElement);
  // WebVRの開始ボタンをDOMに追加
  document.body.appendChild(VRButton.createButton(renderer));

  // カメラを作成
  const camera = new THREE.PerspectiveCamera(90, width / height);
  // カメラの初期位置を設定
  camera.position.z = 10;

  // カメラ用コンテナを作成(3Dのカメラ？)
  const cameraContainer = new THREE.Object3D();
  cameraContainer.add(camera);
  scene.add(cameraContainer);
  cameraContainer.position.x = 0;
  

  // 光源を作成
  createLights(scene);

  // グループの準備
  const group = new THREE.Group();
  scene.add(group);

  /* ----コントローラー設定----- */
  // コントローラーイベントの設定    squeeze button
  function onSelectStartL() {
    this.userData.isSelecting = true;
    updateRandomNode();
  }

  function onSelectStartR() {
    this.userData.isSelecting = true;
    updateAllNode();
  }

  function onSelectEnd() {
    this.userData.isSelecting = false;
  }

  // コントローラファクトリーの準備
  const controllerModelFactory = new XRControllerModelFactory();

  // コントローラの光線の準備
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]);
  const material= new THREE.LineBasicMaterial({color: 0xff0000});
  const line = new THREE.Line(geometry , material);
  line.name = "line";
  line.scale.z = 5;

  // コントローラの追加
  function addController(index) {
    // コントローラの追加
    const controller = renderer.xr.getController(index);
    scene.add(controller);

    // コントローラモデルの追加
    const controllerGrip = renderer.xr.getControllerGrip(index);
    controllerGrip.add(
      controllerModelFactory.createControllerModel(controllerGrip)
    );
    scene.add(controllerGrip);

    // コントローラの光線の追加
    controller.add(line.clone());
    return controller;
  }

  // コントローラの準備
  const controller0 = addController(0);
  const controller1 = addController(1);

  // コントローラのイベントリスナーの追加
  controller0.addEventListener('selectstart', onSelectStartL);
  controller0.addEventListener('selectend', onSelectEnd);
  controller1.addEventListener('selectstart', onSelectStartR);
  controller1.addEventListener('selectend', onSelectEnd);

  
  /*   ファイル読み込み   */
  loadCSVAndInit(fileName);
  
  // CSVファイルの読み込みとシーンの初期化
  function loadCSVAndInit(name) {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", name, true);
    xhr.onreadystatechange = function () {
      // XMLHttpRequestの状態が変わるたびに呼ばれるコールバック
      if (xhr.readyState == 4) {
        // リクエストが成功した場合
        if (xhr.status == 200) {
          // CSVデータを解析してエッジ情報を取得
          networkData = parseCSV(xhr.responseText);
          autoSetting(networkData);
          generateRandomNodePositions(networkData);
          if (networkData) {
            // ネットワークのノードとエッジを描画
            renderNetwork(networkData, scene, camera, renderer, nodePositions);
          } else {
            console.error('Invalid CSV file format');
          }
          console.log(networkData);
        } else {
          console.error('Error loading the CSV file');
        }
      }
    };
    xhr.send();
  }

  /*  CSVデータの解析  */
  function parseCSV(content) {
  const lines = content.split('\n');
  const edges = [];

  // 各行のデータを解析してエッジ情報を構築
  for (const line of lines) {
    const [source, target, weight] = line.trim().split(',');

    if (source && target && weight) {
      edges.push({
        source: parseInt(source),
        target: parseInt(target),
        weight: parseFloat(weight)
      });
    }
  }
  // エッジ情報が存在する場合、その情報を返す
  return edges.length > 0 ?  edges  : null;
  }


  // ネットワークのエッジを描画する関数
  function createEdge(sourcePosition, targetPosition, weight) {
  // ここにエッジの描画処理を追加
  const geometry = new THREE.BufferGeometry().setFromPoints([sourcePosition, targetPosition]);
  const material = new THREE.LineBasicMaterial({ color: 0xffffff });
  const edge = new THREE.Line(geometry, material);
  scene.add(edge);
  }

  //座標生成
  function createPositions() {
  // ランダムな座標を生成
  const position = {
    x: Math.random() * (max + 1 - min)  + min,
    y: Math.random() * (max + 1 - min)  + min,
    z: Math.random() * (max + 1 - min)  + min
  };

  // 生成したノードの座標を配列に追加
  nodePositions.push(position);

  // 生成したノードの座標を返す
  return position;
  }

  // ランダムな座標を生成して nodePositions 配列に追加する関数
  function generateRandomNodePositions(edgesData) {
  const uniqueNodes = new Set();
  const nodePositions = new Map();

  // グラフのノードとエッジを作成
  edgesData.forEach(edge => {
    uniqueNodes.add(edge.source);
    uniqueNodes.add(edge.target);
  });

  // 各ノードの座標を保存
  uniqueNodes.forEach(node => {
    const position = createPositions();
    nodePositions.set(node, position);
  });
  }

  function renderEdges(edgesData, scene, nodePositions) {
  edgesData.forEach(edge => {
    const sourcePosition = nodePositions[edge.source];
    const targetPosition = nodePositions[edge.target];

    if (sourcePosition && targetPosition) {
      createEdge(sourcePosition, targetPosition, edge.weight);
    }
  });
  }

  /*   ネットワーク構造図の生成   */
  function renderNetwork(edgesData, scene, camera, renderer, nodePositions) {
  // ノードを作成
  Object.values(nodePositions).forEach(position => {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0x7fbfff });
    const node = new THREE.Mesh(geometry, material);
    node.position.set(position.x, position.y, position.z);
    scene.add(node);
  });

  // エッジを作成
  renderEdges(edgesData, scene, nodePositions);

  // レンダリングループ
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
  }

  // 光源を作成する関数
  function createLights(scene) {
  const spotLight = new THREE.SpotLight(
    0xffffff,
    4,
    2000,
    Math.PI / 5,
    0.2,
    1.5
  );
  spotLight.position.set(300, 300, 300);
  scene.add(spotLight);

  const ambientLight = new THREE.AmbientLight(0x333333);
  scene.add(ambientLight);

  //光源を作成
  const light = new THREE.DirectionalLight(0xffffff, 0.5);
  light.position.set(0, 4, 0);
  scene.add(light);
  }

  // コントローラーイベントの処理
  function handleController(controller) {
  const userData = controller.userData;
  if (userData.isSelecting === true) {
    // コントローラーボタンが押された際の処理
    const cube = createCube();
    cube.position.set(
      Math.random() * -1000 - 300,  // x座標を-5から5の範囲でランダムに設定
      0,  // y座標
      Math.random() * -1000 - 300   // z座標を-5から5の範囲でランダムに設定
    );
    scene.add(cube);
  }
  }

  // リサイズ処理
  function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // すべてのノードの位置を更新する関数
  function updateAllNode() {
  nodePositions.forEach((position, index) => {
    const newPosition = {
      x: Math.random() * (max + 1 - min) + min,
      y: Math.random() * (max + 1 - min) + min,
      z: Math.random() * (max + 1 - min) + min
    };

    const node = scene.children.find((child) => child instanceof THREE.Mesh && child.position.equals(position));
    if (node) {
      node.position.set(newPosition.x, newPosition.y, newPosition.z);
    }

    nodePositions[index] = newPosition;
    //console.log(index);
  });
  //ノードとエッジを消す
  clearScene();
  //変更されたノードの位置を再描画
  renderNetwork(networkData, scene, camera, renderer, nodePositions);

  // レンダリング
  renderer.render(scene, camera);
  }

  // ランダムなノードの位置を更新して描画する関数
  function updateRandomNode() {
  // nodePositions 配列が空でないことを確認
  if (nodePositions.length > 0) {
    // ランダムなインデックスを選択
    const randomIndex = Math.floor(Math.random() * nodePositions.length);

    // 選択されたノードの位置を更新
    const newPosition = {
      x: Math.random() * (max + 1 - min) + min,
      y: Math.random() * (max + 1 - min) + min,
      z: Math.random() * (max + 1 - min) + min
    };

    // 選択されたノードを取得し、位置を更新
    const selectedNode = scene.children.find((child) => child instanceof THREE.Mesh &&
      child.position.equals(nodePositions[randomIndex]));

    if (selectedNode) {
      selectedNode.position.set(newPosition.x, newPosition.y, newPosition.z);
    }

    // nodePositions 配列の選択されたノードの位置も更新
    //console.log(nodePositions[randomIndex]);
    nodePositions[randomIndex] = newPosition;

    //ノードとエッジを消す
    clearScene();
    //変更されたノードの位置を再描画
    renderNetwork(networkData, scene, camera, renderer, nodePositions);
    
    // レンダリング
    renderer.render(scene, camera);
  }
  }

  // シーンをクリアする関数
  function clearScene() {
  // シーン内のすべての子要素（オブジェクト）を削除
  //1回で全削除されないため(deleteTimes)回繰り返し
  for (let i = 0; i < deleteTimes; i++) {
    scene.children.forEach((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      scene.remove(child);
    }
  });
  }
  // 再描画
  renderer.render(scene, camera);
  }

  //自動設定
  function autoSetting(edgesData){
  //範囲
  if(autoRangeSetting){
    max = edgesData.length/4;
    min = -max
  }

  //削除回数
  if(autodeleteSetting){
    deleteTimes = edgesData.length/2;
  }

  if(autoRadius){
    if(edgesData.length <= 10){
      radius = 0.2;
    }else if(edgesData.length <= 100){
      radius = 0.4;
    }else{
      radius = 0.4 * edgesData.length/100;
    }
  }

  console.log('Max:',max,' , Min:', min,' , DeleteTimes:', deleteTimes,' , DeleteTimes:', radius);
  }

  // 'u' キーが押されたときにランダムなノードの位置を更新して描画する
  document.addEventListener('keydown', (event) => {
  if (event.key === 'r') {
    // ランダムなノードの位置を更新して描画する関数
    updateRandomNode();
  }else if(event.key === 'a'){
    // すべてのノードの位置を更新する関数
    updateAllNode();
  }else if(event.key === 'p'){
    //consoleにノードの座標を表示する
    console.log(nodePositions);
  }else if(event.key === 'c'){
    // シーンをクリアする関数
    clearScene();
  }else if(event.key === 'n'){
    //現在のノードの位置に描画する(消した後に戻す用)
    renderNetwork(networkData, scene, camera, renderer, nodePositions);
  }

  });

  // 毎フレーム時に実行されるループイベント
  function tick() {
    // レンダリング
    handleController(controller1);
    handleController(controller0);
    renderer.render(scene, camera);
    }

  // イベントリスナーの追加
  window.addEventListener("resize", onResize);

  // レンダラーにループ関数を登録
  renderer.setAnimationLoop(tick);

  // リサイズ処理
  window.addEventListener("resize", onResize);
}
