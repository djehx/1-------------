import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinnedModel } from "three/addons/utils/SkeletonUtils.js";

const $ = (selector) => document.querySelector(selector);
const canvas = $("#defense-canvas");
const statusMessage = $("#status-message");
const assetStatus = $("#asset-status");
const waveButton = $("#wave-button");
const pauseButton = $("#pause-button");
const endOverlay = $("#end-overlay");
const towerButtons = [...document.querySelectorAll("[data-build]")];
const towerOptions = {
  bolt: { name: "태양 석궁", cost: 55, damage: 22, cooldown: 0.72, range: 14, color: 0xffc859, speed: 25 },
  frost: { name: "빙결 수정", cost: 80, damage: 13, cooldown: 1.65, range: 11, color: 0x78dff0, speed: 19, splash: 4.4, slow: 2.3 },
  storm: { name: "폭풍 토템", cost: 110, damage: 38, cooldown: 2.25, range: 9.5, color: 0xd49bff, speed: 16, splash: 5.2 },
};

const routePoints = [
  new THREE.Vector3(-31, 0.3, 18),
  new THREE.Vector3(-17, 0.3, 18),
  new THREE.Vector3(-17, 0.3, 7),
  new THREE.Vector3(2, 0.3, 7),
  new THREE.Vector3(2, 0.3, -8),
  new THREE.Vector3(19, 0.3, -8),
  new THREE.Vector3(19, 0.3, -18),
  new THREE.Vector3(31, 0.3, -18),
];
const routeCurve = new THREE.CatmullRomCurve3(routePoints, false, "catmullrom", 0.08);
const routeLength = routeCurve.getLength();
const spawnEntryProgresses = [0, 0.18, 0.36, 0.54, 0.72];
const yAxis = new THREE.Vector3(0, 1, 0);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (error) {
  console.error("타워 디펜스 WebGL 렌더러를 초기화하지 못했습니다.", error);
  statusMessage.textContent = "3D 화면을 시작할 수 없습니다. WebGL 지원을 확인하고 새로고침해 주세요.";
  waveButton.disabled = true;
  towerButtons.forEach((button) => { button.disabled = true; });
  throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1420);
scene.fog = new THREE.Fog(0x0c1420, 62, 120);
const camera = new THREE.OrthographicCamera(-36, 36, 36, -36, 0.1, 180);
camera.position.set(0, 54, 46);
camera.lookAt(0, 0, 0);
let zoom = 1;

scene.add(new THREE.HemisphereLight(0xc3e6dc, 0x30271c, 2.05));
const sun = new THREE.DirectionalLight(0xffddb0, 2.3);
sun.position.set(-25, 55, 24);
sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
sun.shadow.camera.left = -48;
sun.shadow.camera.right = 48;
sun.shadow.camera.top = 48;
sun.shadow.camera.bottom = -48;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(76, 62),
  new THREE.MeshStandardMaterial({ color: 0x202d3b, roughness: 0.94 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.userData.isGround = true;
scene.add(ground);

const groundGrid = new THREE.GridHelper(70, 35, 0x4d8192, 0x344c61);
groundGrid.position.y = 0.035;
groundGrid.material.transparent = true;
groundGrid.material.opacity = 0.17;
scene.add(groundGrid);

const outerRoad = new THREE.Mesh(
  new THREE.TubeGeometry(routeCurve, 220, 2.35, 12, false),
  new THREE.MeshStandardMaterial({ color: 0x253743, roughness: 0.92 }),
);
outerRoad.scale.y = 0.1;
outerRoad.receiveShadow = true;
scene.add(outerRoad);

const innerRoad = new THREE.Mesh(
  new THREE.TubeGeometry(routeCurve, 220, 1.78, 12, false),
  new THREE.MeshStandardMaterial({ color: 0x536874, roughness: 0.86 }),
);
innerRoad.scale.y = 0.07;
innerRoad.receiveShadow = true;
scene.add(innerRoad);

const routeLine = new THREE.Mesh(
  new THREE.TubeGeometry(routeCurve, 220, 0.045, 6, false),
  new THREE.MeshBasicMaterial({ color: 0x77d8d2, transparent: true, opacity: 0.55 }),
);
routeLine.position.y = 0.15;
scene.add(routeLine);

const entryPortals = spawnEntryProgresses.map((progress) => {
  const group = new THREE.Group();
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x66e4d6,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: 0x62d9df,
    emissive: 0x21a9c5,
    emissiveIntensity: 0.2,
    metalness: 0.25,
    roughness: 0.24,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.12, 10, 40), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 1), coreMaterial);
  core.position.y = 0.65;
  group.add(ring, core);
  const position = routeCurve.getPointAt(progress);
  group.position.set(position.x, 0, position.z);
  scene.add(group);
  return { group, ringMaterial, coreMaterial, progress };
});

const riftCore = new THREE.Group();
riftCore.position.set(31, 0, -18);
const coreBase = new THREE.Mesh(
  new THREE.CylinderGeometry(2.2, 2.8, 0.85, 8),
  new THREE.MeshStandardMaterial({ color: 0x243b4a, metalness: 0.65, roughness: 0.32 }),
);
coreBase.position.y = 0.43;
const coreCrystal = new THREE.Mesh(
  new THREE.OctahedronGeometry(1.45, 1),
  new THREE.MeshStandardMaterial({
    color: 0x76f2e7,
    emissive: 0x17bfd0,
    emissiveIntensity: 1.8,
    metalness: 0.25,
    roughness: 0.18,
  }),
);
coreCrystal.position.y = 2.35;
coreCrystal.castShadow = true;
const coreRing = new THREE.Mesh(
  new THREE.TorusGeometry(2.3, 0.12, 10, 48),
  new THREE.MeshBasicMaterial({ color: 0x74e7f2, transparent: true, opacity: 0.82 }),
);
coreRing.rotation.x = Math.PI / 2;
coreRing.position.y = 0.2;
riftCore.add(coreBase, coreCrystal, coreRing);
scene.add(riftCore);

for (const [index, [x, z]] of [[-33, 25], [-34, -22], [28, 27], [28, -27], [0, -29]].entries()) {
  const shard = new THREE.Mesh(
    new THREE.OctahedronGeometry(index % 2 === 0 ? 1.9 : 1.45, 1),
    new THREE.MeshStandardMaterial({
      color: index % 2 === 0 ? 0x52667c : 0x514b78,
      emissive: index % 2 === 0 ? 0x1e6b88 : 0x38246d,
      emissiveIntensity: 0.7,
      metalness: 0.28,
      roughness: 0.32,
    }),
  );
  shard.position.set(x, 1.5 + (index % 2) * 0.8, z);
  shard.rotation.set(0.25 * index, 0.55 * index, -0.2 * index);
  shard.castShadow = true;
  scene.add(shard);
}

function updateEntryPortals(activeCount) {
  entryPortals.forEach((portal, index) => {
    const active = index < activeCount;
    portal.ringMaterial.opacity = active ? 0.88 : 0.14;
    portal.coreMaterial.emissiveIntensity = active ? 2.4 : 0.2;
    portal.group.scale.setScalar(active ? 1 : 0.78);
  });
}

updateEntryPortals(1);

const loader = new GLTFLoader();
let nosiTemplate = null;
let dragonTemplate = null;
let energyOrbTemplate = null;
let explosionTemplate = null;
const loadedAssetNames = new Set();
const failedAssetNames = new Set();
let pendingAssetCount = 4;

function updateAssetStatus() {
  const loaded = [...loadedAssetNames].join(" · ");
  const missing = [...failedAssetNames];
  if (pendingAssetCount > 0) {
    assetStatus.textContent = `${loaded ? `적용 중: ${loaded} · ` : ""}균열 전투 에셋을 불러오는 중…`;
  } else if (missing.length === 0) {
    assetStatus.textContent = loaded ? `모델 적용: ${loaded}` : "프로시저럴 맵이 준비되었습니다.";
  } else {
    assetStatus.textContent = `${loaded ? `적용: ${loaded} · ` : ""}일부 모델을 불러오지 못해 기본 모델을 사용합니다.`;
  }
}

function loadAsset(path, label, onLoad) {
  loader.load(path, (gltf) => {
    onLoad(gltf);
    loadedAssetNames.add(label);
    pendingAssetCount -= 1;
    updateAssetStatus();
  }, undefined, (error) => {
    console.error(`${label} 에셋을 불러오지 못했습니다: ${path}`, error);
    failedAssetNames.add(label);
    pendingAssetCount -= 1;
    updateAssetStatus();
  });
}

function centeredModel(template, targetHeight) {
  const model = cloneSkinnedModel(template.scene ?? template);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, 0.001);
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  model.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;
    }
  });
  return model;
}

loadAsset("assets/models/nosi/scene.gltf", "노시", (gltf) => {
  nosiTemplate = { scene: gltf.scene, animations: gltf.animations };
});

loadAsset("assets/models/dragon_oga.gltf", "드래곤 보스", (gltf) => {
  dragonTemplate = { scene: gltf.scene, animations: gltf.animations };
});

loadAsset("assets/textures/energy_orb.glb", "에너지 탄환", (gltf) => {
  energyOrbTemplate = gltf.scene;
});

loadAsset("assets/textures/폭발.glb", "폭발 이펙트", (gltf) => {
  explosionTemplate = { scene: gltf.scene, animations: gltf.animations };
});

const towerMeshes = [];
const towers = [];
const enemies = [];
const projectiles = [];
const impactEffects = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundHit = new THREE.Vector3();
const mouseNdc = new THREE.Vector2();
let selectedBuild = null;
let selectedTower = null;
let gameState = "ready";
let wave = 1;
let gold = 240;
let gateHealth = 20;
let enemiesToSpawn = 0;
let spawnTimer = 0;
let waveSpawnIndex = 0;
let activeSpawnCount = 1;
let totalKills = 0;
let lastFrame = 0;
let soundEnabled = true;
let audioContext = null;
let audioResumePending = false;

const placementPreview = new THREE.Mesh(
  new THREE.RingGeometry(1.5, 1.8, 36),
  new THREE.MeshBasicMaterial({ color: 0x66e4d6, transparent: true, opacity: 0.82, side: THREE.DoubleSide }),
);
placementPreview.rotation.x = -Math.PI / 2;
placementPreview.position.y = 0.13;
placementPreview.visible = false;
scene.add(placementPreview);

function setStatus(message) {
  statusMessage.textContent = message;
}

function updateHud() {
  $("#wave-value").textContent = `${wave} / 5`;
  $("#gold-value").textContent = String(gold);
  $("#gate-value").textContent = String(gateHealth);
  $("#enemy-value").textContent = String(enemies.length + enemiesToSpawn);
  waveButton.disabled = gameState === "playing" || gameState === "paused" || gameState === "won" || gameState === "lost";
  waveButton.textContent = gameState === "between" ? `스테이지 ${wave + 1} 시작` : "스테이지 시작";
  pauseButton.disabled = gameState !== "playing" && gameState !== "paused";
  pauseButton.textContent = gameState === "paused" ? "전투 재개" : "일시 정지";
  towerButtons.forEach((button) => {
    const type = towerOptions[button.dataset.build];
    button.disabled = gameState === "won" || gameState === "lost" || !type || gold < type.cost;
    button.setAttribute("aria-pressed", String(button.dataset.build === selectedBuild));
  });
  const selectedIsPlaced = Boolean(selectedTower);
  $("#upgrade-button").disabled = !selectedIsPlaced || selectedTower.level >= 3 || gold < (selectedTower ? selectedTower.upgradeCost : Infinity);
  $("#sell-button").disabled = !selectedIsPlaced;
  if (!selectedTower) {
    $("#selected-tower-name").textContent = selectedBuild ? towerOptions[selectedBuild].name : "없음";
    $("#selected-tower-info").textContent = selectedBuild
      ? "맵에서 길과 떨어진 빈 땅을 눌러 건설하세요."
      : "건설할 타워를 고르거나 이미 지은 타워를 클릭하세요.";
  } else {
    $("#selected-tower-name").textContent = `${selectedTower.name} · Lv.${selectedTower.level}`;
    $("#selected-tower-info").textContent = `공격력 ${Math.round(selectedTower.damage)} · 사거리 ${selectedTower.range.toFixed(1)} · 다음 강화 ${selectedTower.level < 3 ? `${selectedTower.upgradeCost} G` : "최대 강화"}`;
  }
}

function getAudioContext() {
  if (!soundEnabled) return null;
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    $("#sound-toggle").disabled = true;
    $("#sound-toggle").textContent = "사운드 미지원";
    return null;
  }
  if (!audioContext) audioContext = new AudioContextConstructor();
  if (audioContext.state === "suspended" && !audioResumePending) {
    audioResumePending = true;
    audioContext.resume().then(() => {
      audioResumePending = false;
    }).catch((error) => {
      audioResumePending = false;
      console.warn("타워 디펜스 오디오를 시작하지 못했습니다.", error);
    });
  }
  return audioContext;
}

function playTone(startFrequency, endFrequency, duration, waveform, volume) {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(envelope);
  envelope.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playSound(kind) {
  if (kind === "shot") playTone(680, 260, 0.09, "triangle", 0.035);
  if (kind === "frost") playTone(820, 380, 0.2, "sine", 0.055);
  if (kind === "storm") playTone(180, 52, 0.38, "sawtooth", 0.075);
  if (kind === "impact") playTone(145, 58, 0.13, "triangle", 0.05);
  if (kind === "wave") playTone(260, 610, 0.38, "sine", 0.07);
  if (kind === "gate") playTone(125, 45, 0.3, "square", 0.07);
}

function distanceToSegmentXZ(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const projection = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  return Math.hypot(point.x - (start.x + projection * dx), point.z - (start.z + projection * dz));
}

function distanceToRoad(point) {
  let closest = Infinity;
  for (let index = 1; index < routePoints.length; index += 1) {
    closest = Math.min(closest, distanceToSegmentXZ(point, routePoints[index - 1], routePoints[index]));
  }
  return closest;
}

function makeRangeRing(range, color) {
  const ring = new THREE.Mesh(
    new THREE.CircleGeometry(range, 56),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  ring.visible = false;
  return ring;
}

function buildTower(typeName, x, z) {
  const type = towerOptions[typeName];
  const group = new THREE.Group();
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: typeName === "frost" ? 0x526d7c : typeName === "storm" ? 0x3e465f : 0x665a40,
    metalness: 0.52,
    roughness: 0.38,
  });
  const baseGeometry = typeName === "frost"
    ? new THREE.CylinderGeometry(1.55, 1.9, 0.65, 6)
    : typeName === "storm"
      ? new THREE.DodecahedronGeometry(1.45, 0)
      : new THREE.CylinderGeometry(1.05, 1.55, 0.75, 8);
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = 0.35;
  base.castShadow = true;
  group.add(base);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: type.color,
    emissive: type.color,
    emissiveIntensity: 0.34,
    metalness: 0.48,
    roughness: 0.32,
  });
  if (typeName === "bolt") {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.68, 2.6, 8), bodyMaterial);
    body.position.y = 1.85;
    body.castShadow = true;
    const limbs = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.26, 0.34), bodyMaterial);
    limbs.position.y = 2.7;
    limbs.castShadow = true;
    group.add(body, limbs);
  } else if (typeName === "frost") {
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.6, 6), bodyMaterial);
    body.position.y = 1.9;
    body.castShadow = true;
    for (let index = 0; index < 3; index += 1) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), bodyMaterial);
      const angle = (index / 3) * Math.PI * 2;
      shard.position.set(Math.cos(angle) * 0.85, 1.8, Math.sin(angle) * 0.85);
      shard.rotation.z = Math.PI / 5;
      shard.castShadow = true;
      group.add(shard);
    }
    group.add(body);
  } else {
    for (let index = 0; index < 3; index += 1) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 2.5, 6), bodyMaterial);
      const angle = (index / 3) * Math.PI * 2;
      rod.position.set(Math.cos(angle) * 0.84, 1.75, Math.sin(angle) * 0.84);
      rod.rotation.z = Math.cos(angle) * 0.28;
      rod.rotation.x = Math.sin(angle) * 0.28;
      rod.castShadow = true;
      group.add(rod);
    }
  }

  const coreMaterial = new THREE.MeshStandardMaterial({
    color: type.color,
    emissive: type.color,
    emissiveIntensity: 1.6,
    metalness: 0.24,
    roughness: 0.2,
  });
  const coreGeometry = typeName === "bolt"
    ? new THREE.BoxGeometry(0.72, 1.05, 0.72)
    : typeName === "frost"
      ? new THREE.OctahedronGeometry(0.76, 0)
      : new THREE.DodecahedronGeometry(0.76, 1);
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.position.y = typeName === "bolt" ? 3.45 : typeName === "frost" ? 3.35 : 3.5;
  if (typeName === "frost") core.scale.y = 1.65;
  core.castShadow = true;
  group.add(core);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(typeName === "frost" ? 1.4 : 1.05, 0.055, 8, 28),
    new THREE.MeshBasicMaterial({ color: type.color, transparent: true, opacity: 0.7 }),
  );
  halo.position.y = core.position.y;
  halo.rotation.x = Math.PI / 2;
  if (typeName === "storm") halo.rotation.y = Math.PI / 3;
  group.add(halo);
  const rangeRing = makeRangeRing(type.range, type.color);
  rangeRing.visible = true;
  group.add(rangeRing);
  group.position.set(x, 0, z);
  const tower = {
    type: typeName,
    name: type.name,
    group,
    core,
    coreScale: core.scale.clone(),
    halo,
    rangeRing,
    level: 1,
    damage: type.damage,
    range: type.range,
    cooldown: type.cooldown,
    splash: type.splash ?? 0,
    slow: type.slow ?? 0,
    speed: type.speed,
    cooldownLeft: 0.15,
    spent: type.cost,
    upgradeCost: 75,
  };
  group.userData.tower = tower;
  group.traverse((object) => {
    if (object.isMesh && object !== rangeRing) towerMeshes.push(object);
  });
  towers.push(tower);
  scene.add(group);
  selectedTower = tower;
  selectedBuild = null;
  setStatus(`${tower.name} 건설 완료. 타워를 선택해 강화하거나 추가 건설을 준비하세요.`);
  updateHud();
}

function selectPlacedTower(tower) {
  if (!tower) return;
  if (selectedTower) selectedTower.rangeRing.visible = false;
  selectedTower = tower;
  selectedBuild = null;
  tower.rangeRing.visible = true;
  setStatus(`${tower.name}을(를) 선택했습니다. 사거리와 강화 정보를 확인하세요.`);
  updateHud();
}

function upgradeSelectedTower() {
  if (!selectedTower || selectedTower.level >= 3 || gold < selectedTower.upgradeCost) return;
  const tower = selectedTower;
  gold -= tower.upgradeCost;
  tower.spent += tower.upgradeCost;
  tower.level += 1;
  tower.damage *= 1.42;
  tower.range += 0.85;
  tower.cooldown *= 0.91;
  tower.splash *= 1.12;
  tower.upgradeCost = Math.round(tower.upgradeCost * 1.5);
  tower.core.scale.copy(tower.coreScale).multiplyScalar(1 + tower.level * 0.11);
  tower.core.material.emissiveIntensity += 0.65;
  tower.rangeRing.geometry.dispose();
  tower.rangeRing.geometry = new THREE.CircleGeometry(tower.range, 56);
  setStatus(`${tower.name} 강화 완료! 공격력이 상승했습니다.`);
  playSound("wave");
  updateHud();
}

function sellSelectedTower() {
  if (!selectedTower) return;
  const tower = selectedTower;
  gold += Math.floor(tower.spent * 0.65);
  const removedMeshes = new Set();
  tower.group.traverse((object) => { if (object.isMesh) removedMeshes.add(object); });
  scene.remove(tower.group);
  tower.rangeRing.geometry.dispose();
  for (let index = towerMeshes.length - 1; index >= 0; index -= 1) {
    if (removedMeshes.has(towerMeshes[index])) towerMeshes.splice(index, 1);
  }
  const index = towers.indexOf(tower);
  if (index >= 0) towers.splice(index, 1);
  selectedTower = null;
  setStatus(`${tower.name} 철거. 투자 비용 일부를 회수했습니다.`);
  updateHud();
}

function createEnemy(isBoss = false, spawnEntryIndex = 0) {
  const group = new THREE.Group();
  const template = isBoss ? dragonTemplate : nosiTemplate;
  const facingOffset = isBoss ? 0 : -Math.PI / 2;
  const model = template
    ? centeredModel(template, isBoss ? 4.6 : 2.6)
    : new THREE.Mesh(
      new THREE.CapsuleGeometry(isBoss ? 1.25 : 0.7, isBoss ? 2.2 : 1.2, 5, 8),
      new THREE.MeshStandardMaterial({
        color: isBoss ? 0x9b624c : 0x879a73,
        emissive: isBoss ? 0x4a1f12 : 0x203016,
        emissiveIntensity: 0.55,
      }),
    );
  model.rotation.y = facingOffset;
  group.add(model);
  let mixer = null;
  if (template?.animations.length) {
    mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(template.animations[0]);
    action.play();
  }

  const hpBack = new THREE.Mesh(
    new THREE.PlaneGeometry(isBoss ? 2.3 : 1.55, 0.16),
    new THREE.MeshBasicMaterial({ color: 0x291e1a, side: THREE.DoubleSide }),
  );
  const hpFill = new THREE.Mesh(
    new THREE.PlaneGeometry(isBoss ? 2.15 : 1.4, 0.09),
    new THREE.MeshBasicMaterial({ color: isBoss ? 0xff9b58 : 0xb9e480, side: THREE.DoubleSide }),
  );
  hpBack.position.y = isBoss ? 5.1 : 3.1;
  hpFill.position.set(0, isBoss ? 5.1 : 3.1, 0.015);
  group.add(hpBack, hpFill);
  group.userData.hpFill = hpFill;

  const maxHealth = isBoss ? 320 + wave * 80 : 34 + wave * 14;
  const enemy = {
    group,
    mixer,
    hpFill,
    facingOffset,
    health: maxHealth,
    maxHealth,
    progress: entryPortals[spawnEntryIndex].progress,
    speed: (isBoss ? 1.75 : 2.7) + wave * 0.11,
    slowLeft: 0,
    isBoss,
    dead: false,
    reward: isBoss ? 65 : 16 + wave * 2,
  };
  const start = routeCurve.getPointAt(enemy.progress);
  const tangent = routeCurve.getTangentAt(enemy.progress);
  group.position.copy(start);
  group.rotation.y = Math.atan2(tangent.x, tangent.z);
  scene.add(group);
  enemies.push(enemy);
  return enemy;
}

function createImpact(position, color, size = 1, type = "bolt") {
  if (type === "death" && explosionTemplate) {
    const group = centeredModel(explosionTemplate, size * 2.2);
    group.position.copy(position);
    group.position.y = 0.45;
    scene.add(group);
    const mixer = explosionTemplate.animations.length
      ? new THREE.AnimationMixer(group)
      : null;
    if (mixer) explosionTemplate.animations.forEach((clip) => mixer.clipAction(clip).play());
    impactEffects.push({ group, mixer, age: 0, life: 0.72, model: true });
    return;
  }

  const group = new THREE.Group();
  const meshes = [];
  const materials = [];
  const addMesh = (geometry, material, position, rotation) => {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.copy(position);
    if (rotation) mesh.rotation.copy(rotation);
    group.add(mesh);
    meshes.push(mesh);
    materials.push(material);
    return mesh;
  };
  const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
  const ring = addMesh(new THREE.TorusGeometry(size * (type === "frost" ? 0.82 : 0.48), 0.075, 8, 28), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  if (type === "frost") {
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      const shard = addMesh(
        new THREE.OctahedronGeometry(size * 0.26, 0),
        new THREE.MeshBasicMaterial({ color: 0xaaf7ff, transparent: true, opacity: 0.95 }),
        new THREE.Vector3(Math.cos(angle) * size * 0.55, 0.35, Math.sin(angle) * size * 0.55),
      );
      shard.rotation.z = Math.PI / 4;
    }
  } else if (type === "storm") {
    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * Math.PI * 2;
      const points = [];
      for (let step = 0; step < 6; step += 1) {
        const radius = size * (0.18 + step * 0.13);
        const jitter = step % 2 === 0 ? 0.16 : -0.16;
        points.push(new THREE.Vector3(
          Math.cos(angle + jitter) * radius,
          0.3 + (step % 2) * 0.22,
          Math.sin(angle + jitter) * radius,
        ));
      }
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0xe7d8ff, transparent: true, opacity: 1 });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial);
      group.add(line);
      meshes.push(line);
      materials.push(lineMaterial);
    }
  } else {
    const flash = addMesh(
      new THREE.SphereGeometry(size * 0.28, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff1b3, transparent: true, opacity: 0.95 }),
      new THREE.Vector3(0, 0.55, 0),
    );
    flash.scale.set(1, 1.4, 1);
    for (let index = 0; index < 4; index += 1) {
      const angle = (index / 4) * Math.PI * 2;
      const shard = addMesh(
        new THREE.TetrahedronGeometry(size * 0.24, 0),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
        new THREE.Vector3(Math.cos(angle) * size * 0.5, 0.35, Math.sin(angle) * size * 0.5),
      );
      shard.rotation.y = angle;
    }
  }
  group.position.copy(position);
  group.position.y = 0.16;
  scene.add(group);
  impactEffects.push({ group, age: 0, life: type === "storm" ? 0.48 : 0.38, meshes, materials, model: false });
}

function fireTower(tower, target) {
  tower.cooldownLeft = tower.cooldown;
  tower.halo.rotation.z += 0.7;
  const mesh = new THREE.Group();
  const color = towerOptions[tower.type].color;
  if (tower.type === "bolt" && energyOrbTemplate) {
    const orb = cloneSkinnedModel(energyOrbTemplate);
    orb.scale.setScalar(0.42);
    orb.traverse((object) => { if (object.isMesh) object.frustumCulled = false; });
    mesh.add(orb);
  } else if (tower.type === "frost") {
    const crystal = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.38, 0),
      new THREE.MeshStandardMaterial({ color: 0x9ef5ff, emissive: color, emissiveIntensity: 2.4, roughness: 0.18 }),
    );
    crystal.rotation.set(Math.PI / 5, 0, Math.PI / 4);
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.035, 6, 20),
      new THREE.MeshBasicMaterial({ color: 0xd7fbff }),
    );
    orbit.rotation.x = Math.PI / 2;
    mesh.add(crystal, orbit);
  } else if (tower.type === "storm") {
    const core = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.34, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.6 }),
    );
    mesh.add(core);
    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * Math.PI * 2;
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.035, 6, 18, Math.PI * 1.25),
        new THREE.MeshBasicMaterial({ color: 0xe7d8ff }),
      );
      arc.rotation.set(Math.PI / 2, angle, angle);
      mesh.add(arc);
    }
  } else {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      new THREE.MeshStandardMaterial({ color: tower.core.material.color, emissive: tower.core.material.color, emissiveIntensity: 2.3 }),
    );
    mesh.add(orb);
  }
  mesh.position.copy(tower.group.position).add(new THREE.Vector3(0, tower.core.position.y, 0));
  scene.add(mesh);
  projectiles.push({ mesh, target, type: tower.type, speed: tower.speed, damage: tower.damage, splash: tower.splash, slow: tower.slow, age: 0 });
  playSound(tower.type === "frost" ? "frost" : tower.type === "storm" ? "storm" : "shot");
}

function damageEnemy(enemy, damage) {
  if (enemy.dead) return;
  enemy.health = Math.max(0, enemy.health - damage);
  enemy.hpFill.scale.x = Math.max(0.001, enemy.health / enemy.maxHealth);
  enemy.hpFill.position.x = -(enemy.isBoss ? 2.15 : 1.4) * (1 - enemy.health / enemy.maxHealth) / 2;
  if (enemy.health <= 0) {
    enemy.dead = true;
    gold += enemy.reward;
    totalKills += 1;
    createImpact(enemy.group.position, enemy.isBoss ? 0xffa45f : 0xb9e480, enemy.isBoss ? 2 : 1, "death");
    scene.remove(enemy.group);
    const index = enemies.indexOf(enemy);
    if (index >= 0) enemies.splice(index, 1);
    updateHud();
  }
}

function resolveProjectile(projectile) {
  const target = projectile.target;
  if (!enemies.includes(target) || target.dead) return;
  const position = target.group.position.clone();
  if (projectile.splash > 0) {
    enemies.slice().forEach((enemy) => {
      if (enemy.group.position.distanceTo(position) > projectile.splash) return;
      enemy.slowLeft = Math.max(enemy.slowLeft, projectile.slow);
      damageEnemy(enemy, projectile.damage);
    });
  } else {
    damageEnemy(target, projectile.damage);
  }
  createImpact(position, towerOptions[projectile.type].color, projectile.type === "storm" ? 1.65 : 0.8, projectile.type);
  playSound("impact");
}

function updateCombat(delta) {
  for (const tower of towers) {
    tower.cooldownLeft -= delta;
    if (tower.cooldownLeft > 0) continue;
    const target = enemies
      .filter((enemy) => !enemy.dead && Math.hypot(
        enemy.group.position.x - tower.group.position.x,
        enemy.group.position.z - tower.group.position.z,
      ) <= tower.range)
      .sort((first, second) => second.progress - first.progress)[0];
    if (target) fireTower(tower, target);
  }

  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    projectile.age += delta;
    if (!enemies.includes(projectile.target) || projectile.target.dead) {
      scene.remove(projectile.mesh);
      projectiles.splice(index, 1);
      continue;
    }
    const targetPosition = projectile.target.group.position.clone().add(new THREE.Vector3(0, 1.15, 0));
    const direction = targetPosition.sub(projectile.mesh.position);
    const distance = direction.length();
    const step = projectile.speed * delta;
    if (distance <= step + 0.48 || projectile.age > 4) {
      resolveProjectile(projectile);
      scene.remove(projectile.mesh);
      projectiles.splice(index, 1);
    } else {
      projectile.mesh.position.addScaledVector(direction.normalize(), step);
      projectile.mesh.rotation.y += delta * 5;
    }
  }

  for (let index = impactEffects.length - 1; index >= 0; index -= 1) {
    const effect = impactEffects[index];
    effect.age += delta;
    effect.mixer?.update(delta);
    if (!effect.model) {
      const progress = effect.age / effect.life;
      effect.group.scale.setScalar(0.65 + progress * (effect.meshes.length > 4 ? 1.1 : 1.6));
      effect.group.rotation.y += delta * (effect.meshes.length > 4 ? 1.8 : -0.8);
      effect.materials.forEach((material) => { material.opacity = Math.max(0, 1 - progress); });
      effect.meshes.forEach((mesh, meshIndex) => {
        mesh.rotation.x += delta * (meshIndex % 2 === 0 ? 2 : -1.5);
        mesh.rotation.z += delta * (meshIndex % 2 === 0 ? -1.2 : 1.7);
      });
    }
    if (effect.age < effect.life) continue;
    scene.remove(effect.group);
    effect.mixer?.stopAllAction();
    if (!effect.model) {
      effect.group.traverse((object) => {
        if (object.isMesh || object.isLine) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });
    }
    impactEffects.splice(index, 1);
  }
}

function updateEnemies(delta) {
  for (const enemy of [...enemies]) {
    enemy.mixer?.update(delta);
    enemy.slowLeft = Math.max(0, enemy.slowLeft - delta);
    const speedScale = enemy.slowLeft > 0 ? 0.48 : 1;
    enemy.progress += (enemy.speed * speedScale * delta) / routeLength;
    if (enemy.progress >= 1) {
      enemy.dead = true;
      scene.remove(enemy.group);
      enemies.splice(enemies.indexOf(enemy), 1);
      gateHealth = Math.max(0, gateHealth - (enemy.isBoss ? 4 : 1));
      setStatus(enemy.isBoss ? "보스가 균열핵을 강타했습니다!" : "적이 균열핵에 도달했습니다.");
      playSound("gate");
      if (gateHealth <= 0) finishGame(false);
      updateHud();
      continue;
    }
    const position = routeCurve.getPointAt(enemy.progress);
    const tangent = routeCurve.getTangentAt(enemy.progress);
    enemy.group.position.copy(position);
    enemy.group.rotation.y = Math.atan2(tangent.x, tangent.z);
    enemy.hpFill.quaternion.copy(camera.quaternion);
    enemy.hpFill.material.color.setHex(enemy.slowLeft > 0 ? 0x80e7fa : enemy.isBoss ? 0xff9b58 : 0xb9e480);
  }
}

function startWave() {
  if (gameState !== "ready" && gameState !== "between") return;
  if (gameState === "between") wave += 1;
  gameState = "playing";
  enemiesToSpawn = 5 + wave * 2;
  activeSpawnCount = Math.min(wave, entryPortals.length);
  waveSpawnIndex = 0;
  updateEntryPortals(activeSpawnCount);
  spawnTimer = 0;
  setStatus(`스테이지 ${wave}: ${activeSpawnCount}곳의 균열 출현 지점에서 적 ${enemiesToSpawn}마리가 접근합니다.`);
  playSound("wave");
  updateHud();
}

function finishWaveIfClear() {
  if (gameState !== "playing" || enemiesToSpawn > 0 || enemies.length > 0) return;
  if (wave >= 5) {
    finishGame(true);
    return;
  }
  gameState = "between";
  gold += 45 + wave * 15;
  setStatus(`스테이지 ${wave} 방어 성공! 보상 골드를 얻었습니다. 다음 단계의 균열에 대비하세요.`);
  updateHud();
}

function finishGame(won) {
  if (gameState === "won" || gameState === "lost") return;
  gameState = won ? "won" : "lost";
  $("#end-title").textContent = won ? "균열핵을 지켜냈습니다" : "균열핵이 무너졌습니다";
  $("#end-copy").textContent = `${wave}스테이지 · 적 ${totalKills}마리 처치 · 균열핵 내구도 ${gateHealth}`;
  endOverlay.hidden = false;
  setStatus(won ? "균열 봉쇄 성공!" : "방어에 실패했습니다. 타워를 재배치해 다시 도전하세요.");
  updateHud();
}

function resetGame() {
  enemies.forEach((enemy) => scene.remove(enemy.group));
  projectiles.forEach((projectile) => scene.remove(projectile.mesh));
  impactEffects.forEach((effect) => scene.remove(effect.group));
  enemies.length = 0;
  projectiles.length = 0;
  impactEffects.length = 0;
  towers.forEach((tower) => {
    scene.remove(tower.group);
    tower.rangeRing.geometry.dispose();
  });
  towers.length = 0;
  towerMeshes.length = 0;
  selectedTower = null;
  selectedBuild = null;
  gameState = "ready";
  wave = 1;
  gold = 240;
  gateHealth = 20;
  enemiesToSpawn = 0;
  spawnTimer = 0;
  waveSpawnIndex = 0;
  activeSpawnCount = 1;
  updateEntryPortals(activeSpawnCount);
  totalKills = 0;
  endOverlay.hidden = true;
  setStatus("적이 오기 전에 골드를 사용해 방어선을 준비하세요.");
  updateHud();
}

function updatePointer(event) {
  const bounds = canvas.getBoundingClientRect();
  mouseNdc.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(mouseNdc, camera);
}

function getGroundPoint() {
  const hit = raycaster.intersectObject(ground, false)[0];
  if (!hit) return null;
  groundHit.copy(hit.point);
  groundHit.x = THREE.MathUtils.clamp(Math.round(groundHit.x / 2) * 2, -33, 33);
  groundHit.z = THREE.MathUtils.clamp(Math.round(groundHit.z / 2) * 2, -26, 26);
  groundHit.y = 0;
  return groundHit;
}

function canBuildAt(point) {
  if (Math.abs(point.x) > 31 || Math.abs(point.z) > 25) return false;
  if (distanceToRoad(point) < 4.1) return false;
  return towers.every((tower) => Math.hypot(tower.group.position.x - point.x, tower.group.position.z - point.z) >= 3.2);
}

function getTowerFromHit(object) {
  let current = object;
  while (current && !current.userData.tower) current = current.parent;
  return current?.userData.tower ?? null;
}

function handleMapClick(event) {
  updatePointer(event);
  const towerHit = raycaster.intersectObjects(towerMeshes, false)[0];
  if (towerHit) {
    selectPlacedTower(getTowerFromHit(towerHit.object));
    return;
  }
  const point = getGroundPoint();
  if (!point) {
    if (selectedBuild) setStatus("게임 맵의 빈 땅을 눌러 타워를 설치하세요.");
    return;
  }
  if (!selectedBuild) {
    if (selectedTower) selectedTower.rangeRing.visible = false;
    selectedTower = null;
    updateHud();
    return;
  }
  if (!canBuildAt(point)) {
    setStatus("길과 기존 타워에서 떨어진 빈 땅을 선택하세요.");
    return;
  }
  const type = towerOptions[selectedBuild];
  if (gold < type.cost) {
    setStatus(`${type.name} 건설에는 ${type.cost} G가 필요합니다.`);
    return;
  }
  gold -= type.cost;
  buildTower(selectedBuild, point.x, point.z);
}

function updatePlacementPreview(event) {
  updatePointer(event);
  const point = getGroundPoint();
  if (!point || !selectedBuild) {
    placementPreview.visible = false;
    return;
  }
  placementPreview.position.set(point.x, 0.14, point.z);
  placementPreview.material.color.setHex(canBuildAt(point) && gold >= towerOptions[selectedBuild].cost ? 0x66e4d6 : 0xf06e55);
  placementPreview.visible = true;
}

function resize() {
  const aspect = window.innerWidth / window.innerHeight;
  const viewHeight = (window.innerWidth < 760 ? 76 : 68) / zoom;
  camera.left = -viewHeight * aspect / 2;
  camera.right = viewHeight * aspect / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

function frame(timestamp) {
  requestAnimationFrame(frame);
  const delta = lastFrame === 0 ? 0 : Math.min((timestamp - lastFrame) / 1000, 0.05);
  lastFrame = timestamp;

  if (gameState === "playing") {
    spawnTimer -= delta;
    if (enemiesToSpawn > 0 && spawnTimer <= 0) {
      const isBoss = wave === 5 && enemiesToSpawn === 1;
      createEnemy(isBoss, waveSpawnIndex % activeSpawnCount);
      waveSpawnIndex += 1;
      enemiesToSpawn -= 1;
      spawnTimer = Math.max(0.42, 0.92 - wave * 0.04);
    }
    updateEnemies(delta);
    if (gameState === "playing") updateCombat(delta);
    updateHud();
    finishWaveIfClear();
  }

  for (const tower of towers) {
    tower.core.rotation.y += delta * 0.8;
    tower.halo.rotation.z -= delta * 0.55;
  }
  coreCrystal.rotation.y += delta * 0.42;
  coreRing.rotation.z += delta * 0.26;
  renderer.render(scene, camera);
}

towerButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const typeName = button.dataset.build;
    if (gold < towerOptions[typeName].cost) {
      setStatus(`${towerOptions[typeName].name} 건설에 필요한 골드가 부족합니다.`);
      return;
    }
    if (selectedTower) selectedTower.rangeRing.visible = false;
    selectedTower = null;
    selectedBuild = selectedBuild === typeName ? null : typeName;
    setStatus(selectedBuild ? `${towerOptions[typeName].name} 선택. 길 밖의 빈 땅을 눌러 건설하세요.` : "타워 건설을 취소했습니다.");
    updateHud();
  });
});

$("#upgrade-button").addEventListener("click", upgradeSelectedTower);
$("#sell-button").addEventListener("click", sellSelectedTower);
waveButton.addEventListener("click", startWave);
pauseButton.addEventListener("click", () => {
  if (gameState === "playing") {
    gameState = "paused";
    setStatus("전투를 일시 정지했습니다.");
  } else if (gameState === "paused") {
    gameState = "playing";
    setStatus("전투를 재개합니다.");
  }
  updateHud();
});
$("#restart-button").addEventListener("click", resetGame);
$("#sound-toggle").addEventListener("click", (event) => {
  soundEnabled = !soundEnabled;
  event.currentTarget.textContent = soundEnabled ? "사운드 켜짐" : "사운드 꺼짐";
  event.currentTarget.setAttribute("aria-pressed", String(soundEnabled));
  if (soundEnabled) playSound("wave");
});

canvas.addEventListener("pointermove", updatePlacementPreview);
canvas.addEventListener("pointerleave", () => { placementPreview.visible = false; });
canvas.addEventListener("click", handleMapClick);
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoom = THREE.MathUtils.clamp(zoom * Math.exp(-event.deltaY * 0.001), 0.72, 2.1);
  resize();
}, { passive: false });
window.addEventListener("resize", resize);

resize();
updateHud();
updateAssetStatus();
requestAnimationFrame(frame);
