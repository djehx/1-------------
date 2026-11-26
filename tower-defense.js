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
const bossHealthDisplay = $("#boss-health-display");
const bossHealthName = $("#boss-health-name");
const bossHealthValue = $("#boss-health-value");
const bossHealthMeter = $("#boss-health-meter");
const bossHealthFill = $("#boss-health-fill");
const bossWarning = $("#boss-warning");
const towerButtons = [...document.querySelectorAll("[data-build]")];
const towerOptions = {
  bolt: { name: "태양 석궁", cost: 55, damage: 8, cooldown: 0.16, range: 14, color: 0xffc859, speed: 32 },
  frost: { name: "빙결 수정", cost: 80, damage: 13, cooldown: 1.65, range: 11, color: 0x78dff0, splash: 4.4, slow: 2.3 },
  storm: { name: "폭풍 토템", cost: 110, damage: 38, cooldown: 2.25, range: 9.5, color: 0xd49bff, speed: 16, splash: 5.2 },
  cannon: { name: "룬 대포", cost: 145, damage: 62, cooldown: 2.15, range: 13, color: 0xff815c, speed: 18, splash: 3.5 },
};

const routeDefinitions = [
  [[-36, 18], [-18, 18], [-18, 8], [2, 8], [2, -8], [20, -8], [20, -18], [28, -18]],
  [[-36, -22], [-25, -22], [-25, -10], [-12, -10], [-12, -22], [8, -22], [8, -18], [28, -18]],
  [[-4, 30], [-4, 20], [8, 20], [8, 10], [22, 10], [22, -4], [28, -4], [28, -18]],
].map((points) => {
  const routePoints = points.map(([x, z]) => new THREE.Vector3(x, 0.3, z));
  const curve = new THREE.CurvePath();
  routePoints.slice(1).forEach((point, index) => {
    curve.add(new THREE.LineCurve3(routePoints[index], point));
  });
  return { points: routePoints, curve, length: curve.getLength() };
});
const castleSites = [[-32, 30, 1, 0], [20, 30, 1.05, 1], [-28, 0, 0.9, 2], [36, -32, 0.92, 1]];
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
const cameraTarget = new THREE.Vector3(20, 0, 0);
let cameraAzimuth = 0;
let cameraPolar = Math.PI / 4;
let cameraRoll = 0;
let cameraControlEnabled = false;
let cameraDrag = null;
let suppressMapClick = false;
const cameraDistance = 72;
let zoom = 1;

function updateCamera() {
  camera.position.set(
    cameraTarget.x + cameraDistance * Math.sin(cameraPolar) * Math.sin(cameraAzimuth),
    cameraTarget.y + cameraDistance * Math.cos(cameraPolar),
    cameraTarget.z + cameraDistance * Math.sin(cameraPolar) * Math.cos(cameraAzimuth),
  );
  camera.up.set(0, 1, 0);
  camera.lookAt(cameraTarget);
  camera.rotateZ(cameraRoll);
}

function updateCameraMovement(delta) {
  if (!cameraControlEnabled || pressedKeys.size === 0 || delta <= 0) return;
  const forward = Number(pressedKeys.has("w")) - Number(pressedKeys.has("s"));
  const strafe = Number(pressedKeys.has("d")) - Number(pressedKeys.has("a"));
  const length = Math.hypot(forward, strafe);
  if (!length) return;
  const speed = 24 * delta / length;
  const rightX = Math.cos(cameraAzimuth);
  const rightZ = -Math.sin(cameraAzimuth);
  const forwardX = -Math.sin(cameraAzimuth);
  const forwardZ = -Math.cos(cameraAzimuth);
  cameraTarget.x = THREE.MathUtils.clamp(cameraTarget.x + (strafe * rightX + forward * forwardX) * speed, -55, 55);
  cameraTarget.z = THREE.MathUtils.clamp(cameraTarget.z + (strafe * rightZ + forward * forwardZ) * speed, -48, 48);
  updateCamera();
}

updateCamera();

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
  new THREE.PlaneGeometry(88, 76),
  new THREE.MeshStandardMaterial({ color: 0x202d3b, roughness: 0.94 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
ground.userData.isGround = true;
scene.add(ground);

const groundGrid = new THREE.GridHelper(84, 42, 0x4d8192, 0x344c61);
groundGrid.position.y = 0.035;
groundGrid.material.transparent = true;
groundGrid.material.opacity = 0.17;
scene.add(groundGrid);

const roadLayers = routeDefinitions.map(({ points }) => {
  const tiles = new Map();
  const noBuildZone = new THREE.Group();
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const horizontal = start.z === end.z;
    const length = Math.abs(horizontal ? end.x - start.x : end.z - start.z);
    const direction = Math.sign(horizontal ? end.x - start.x : end.z - start.z);
    for (let distance = 0; distance < length; distance += 2) {
      const along = (horizontal ? start.x : start.z) + direction * (distance + 1);
      for (const across of [-1, 1]) {
        const x = horizontal ? along : start.x + across;
        const z = horizontal ? start.z + across : along;
        tiles.set(`${x},${z}`, { x, z });
      }
    }

    const zoneSegment = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? length + 0.08 : 7.8, 0.02, horizontal ? 7.8 : length + 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff4545, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    zoneSegment.position.set((start.x + end.x) / 2, 0.28, (start.z + end.z) / 2);
    noBuildZone.add(zoneSegment);
  }

  const tilePositions = [...tiles.values()];
  const road = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2, 0.16, 2),
    new THREE.MeshStandardMaterial({ color: 0x35434a, roughness: 0.92 }),
    tilePositions.length,
  );
  const pavedLane = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.92, 0.08, 1.92),
    new THREE.MeshStandardMaterial({ color: 0x737b77, roughness: 0.9 }),
    tilePositions.length,
  );
  const tileColors = [0x747c78, 0x68736f, 0x7d8179, 0x6d7774];
  const tile = new THREE.Object3D();
  tilePositions.forEach(({ x, z }, index) => {
    tile.position.set(x, 0.08, z);
    tile.updateMatrix();
    road.setMatrixAt(index, tile.matrix);
    tile.position.y = 0.2;
    tile.updateMatrix();
    pavedLane.setMatrixAt(index, tile.matrix);
    pavedLane.setColorAt(index, new THREE.Color(tileColors[(index * 7 + points.length) % tileColors.length]));
  });
  road.instanceMatrix.needsUpdate = true;
  pavedLane.instanceMatrix.needsUpdate = true;
  road.receiveShadow = true;
  pavedLane.receiveShadow = true;
  noBuildZone.visible = false;
  scene.add(noBuildZone, road, pavedLane);
  return {
    noBuildZone,
    road,
    pavedLane,
  };
});
const placementBounds = [];
for (const x of [-42.5, 42.5]) {
  const band = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 76),
    new THREE.MeshBasicMaterial({ color: 0xff4545, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  band.rotation.x = -Math.PI / 2;
  band.position.set(x, 0.06, 0);
  band.visible = false;
  scene.add(band);
  placementBounds.push(band);
}
for (const z of [-36.5, 36.5]) {
  const band = new THREE.Mesh(
    new THREE.PlaneGeometry(82, 3),
    new THREE.MeshBasicMaterial({ color: 0xff4545, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  band.rotation.x = -Math.PI / 2;
  band.position.set(0, 0.06, z);
  band.visible = false;
  scene.add(band);
  placementBounds.push(band);
}

const riftPalettes = [
  { color: 0x66e4d6, glow: 0x21a9c5, shape: "blackhole" },
  { color: 0xc07bff, glow: 0x742be8, shape: "crystal" },
  { color: 0xff8a58, glow: 0xe44522, shape: "ember" },
];
const entryPortals = routeDefinitions.map(({ curve }, index) => {
  const palette = riftPalettes[index];
  const group = new THREE.Group();
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: palette.color,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: palette.color,
    emissive: palette.glow,
    emissiveIntensity: 0.2,
    metalness: 0.25,
    roughness: 0.24,
  });
  const eventHorizon = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 24, 18),
    new THREE.MeshBasicMaterial({ color: 0x080611 }),
  );
  eventHorizon.position.y = 1.55;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.14, 10, 56), ringMaterial);
  ring.position.y = 1.55;
  ring.rotation.y = index * 0.12;
  const swirl = new THREE.Mesh(
    new THREE.TorusGeometry(1.35, 0.11, 8, 48),
    new THREE.MeshBasicMaterial({ color: palette.color, transparent: true, opacity: 0.88 }),
  );
  swirl.position.y = 1.55;
  swirl.rotation.z = 0.4 + index * 0.3;
  const riftArc = new THREE.Mesh(
    new THREE.TorusGeometry(2.45, 0.07, 8, 48, Math.PI * 1.25),
    new THREE.MeshBasicMaterial({ color: palette.glow, transparent: true, opacity: 0.72 }),
  );
  riftArc.position.y = 1.55;
  riftArc.rotation.z = index * 0.7;
  const floorRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.35, 0.09, 8, 56),
    new THREE.MeshBasicMaterial({ color: palette.color, transparent: true, opacity: 0.68 }),
  );
  floorRing.rotation.x = Math.PI / 2;
  floorRing.position.y = 0.12;
  const core = palette.shape === "blackhole"
    ? eventHorizon
    : new THREE.Mesh(
      palette.shape === "crystal" ? new THREE.OctahedronGeometry(0.52, 1)
        : palette.shape === "ember" ? new THREE.IcosahedronGeometry(0.5, 1)
          : new THREE.TorusKnotGeometry(0.38, 0.13, 48, 8),
      coreMaterial,
    );
  core.position.y = 1.55;
  group.add(ring, swirl, riftArc, floorRing, core);
  const position = curve.getPointAt(0);
  group.position.set(position.x, 0, position.z);
  scene.add(group);
  return { group, ringMaterial, coreMaterial, swirl,   floorRing,
  riftArc, core, palette };
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

function createMiniCastle(x, z, scale = 1, style = 0) {
  const castle = new THREE.Group();
  const palettes = [
    { stone: 0x908574, trim: 0x514942, roof: 0x943f37, door: 0x352821 },
    { stone: 0x788991, trim: 0x40525b, roof: 0x3e688c, door: 0x252f35 },
    { stone: 0xa39b7e, trim: 0x645d45, roof: 0x847343, door: 0x3f3323 },
  ];
  const palette = palettes[style % palettes.length];
  const stone = new THREE.MeshStandardMaterial({ color: palette.stone, roughness: 0.9 });
  const darkStone = new THREE.MeshStandardMaterial({ color: palette.trim, roughness: 0.86 });
  const roof = new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.72 });
  const doorMaterial = new THREE.MeshStandardMaterial({ color: palette.door, roughness: 0.78 });
  const platform = new THREE.Mesh(new THREE.BoxGeometry(16, 0.45, 13), darkStone);
  platform.position.y = 0.23;
  platform.receiveShadow = true;
  castle.add(platform);

  const addWall = (width, depth, x, z) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 3.6, depth), stone);
    wall.position.set(x, 2.25, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    castle.add(wall);
  };
  addWall(16, 0.8, 0, -6.1);
  addWall(0.8, 12, -7.6, 0);
  addWall(0.8, 12, 7.6, 0);
  addWall(5.8, 0.8, -5.1, 6.1);
  addWall(5.8, 0.8, 5.1, 6.1);
  const gate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.55, 0.35), doorMaterial);
  gate.position.set(0, 1.5, 6.2);
  castle.add(gate);
  const gateArch = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.24, 8, 12, Math.PI),
    darkStone,
  );
  gateArch.position.set(0, 2.8, 6.32);
  gateArch.rotation.z = Math.PI;
  castle.add(gateArch);

  const cornerTowers = [[-7, -5.5], [7, -5.5], [-7, 5.5], [7, 5.5]];
  cornerTowers.forEach(([towerX, towerZ], index) => {
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.28, 5.1 + (index % 2) * 0.7, 8), stone);
    turret.position.set(towerX, 2.85 + (index % 2) * 0.35, towerZ);
    turret.castShadow = true;
    const roofTop = new THREE.Mesh(
      new THREE.ConeGeometry(style === 1 ? 1.55 : 1.35, style === 1 ? 2.2 : 1.65, style === 2 ? 5 : 8),
      roof,
    );
    roofTop.position.set(towerX, 5.9 + (index % 2) * 0.35, towerZ);
    roofTop.castShadow = true;
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.45, 2.15), darkStone);
    merlon.position.set(towerX, 5.35 + (index % 2) * 0.35, towerZ);
    castle.add(turret, roofTop, merlon);
  });

  const keep = new THREE.Mesh(new THREE.BoxGeometry(6.6, 5.2, 5.8), stone);
  keep.position.set(0, 2.95, -1.5);
  keep.castShadow = true;
  keep.receiveShadow = true;
  const keepRoof = new THREE.Mesh(
    new THREE.ConeGeometry(style === 1 ? 4.7 : 4.2, style === 1 ? 4.8 : 3.6, style === 2 ? 5 : 4),
    roof,
  );
  keepRoof.position.set(0, 7.3, -1.5);
  keepRoof.rotation.y = Math.PI / 4;
  keepRoof.castShadow = true;
  castle.add(keep, keepRoof);

  for (let index = 0; index < 7; index += 1) {
    const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.85), darkStone);
    merlon.position.set(-6.3 + index * 2.1, 4.25, -6.12);
    castle.add(merlon);
  }
  castle.scale.setScalar(scale);
  castle.position.set(x, 0, z);
  scene.add(castle);
}

castleSites.forEach(([x, z, scale, style]) => {
  createMiniCastle(x, z, scale, style);
  const foundation = new THREE.Mesh(
    new THREE.PlaneGeometry(19 * scale, 16 * scale),
    new THREE.MeshBasicMaterial({ color: 0xff4545, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  foundation.rotation.x = -Math.PI / 2;
  foundation.position.set(x, 0.3, z);
  foundation.visible = false;
  scene.add(foundation);
  placementBounds.push(foundation);
});

function updateEntryPortals(activeCount) {
  entryPortals.forEach((portal, index) => {
    const active = index < activeCount;
    portal.ringMaterial.opacity = active ? 0.88 : 0.14;
    if (portal.coreMaterial.emissiveIntensity !== undefined) portal.coreMaterial.emissiveIntensity = active ? 2.4 : 0.2;
    portal.active = active;
    portal.group.scale.setScalar(active ? 1.18 : 0.92);
    const roads = roadLayers[index];
    roads.road.visible = active;
    roads.pavedLane.visible = active;
  });
}

function activeRoutesForWave(stage) {
  if (stage < 3) return 1;
  if (stage < 5) return 2;
  return routeDefinitions.length;
}

updateEntryPortals(activeRoutesForWave(1));

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
const placementBlockRings = [];
const pressedKeys = new Set();
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
let gameSpeed = 1;
let totalKills = 0;
let trackedBoss = null;
let lastFrame = 0;
let bossWarningLeft = 0;
let screenShakeLeft = 0;
let screenShakeStrength = 0;
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

function updateBossHealth(enemy) {
  if (!enemy || (!enemy.isBoss && !enemy.isMidBoss)) return;
  trackedBoss = enemy;
  bossHealthName.textContent = enemy.isBoss ? "최종 보스 · 계층주" : "중간 보스";
  bossHealthValue.textContent = `${Math.ceil(enemy.health).toLocaleString("ko-KR")} / ${enemy.maxHealth.toLocaleString("ko-KR")}`;
  bossHealthFill.style.width = `${Math.max(0, enemy.health / enemy.maxHealth) * 100}%`;
  bossHealthMeter.setAttribute("aria-valuemax", String(enemy.maxHealth));
  bossHealthMeter.setAttribute("aria-valuenow", String(Math.ceil(enemy.health)));
  bossHealthDisplay.classList.toggle("boss-health-display--final", enemy.isBoss);
  bossHealthDisplay.hidden = false;
}

function hideBossHealth(enemy) {
  if (enemy && trackedBoss !== enemy) return;
  trackedBoss = null;
  bossHealthDisplay.hidden = true;
}

function updateHud() {
  $("#wave-value").textContent = `${wave} / 10`;
  $("#gold-value").textContent = String(gold);
  $("#gate-value").textContent = String(gateHealth);
  $("#enemy-value").textContent = String(enemies.length + enemiesToSpawn);
  waveButton.disabled = gameState === "playing" || gameState === "paused" || gameState === "won" || gameState === "lost";
  waveButton.textContent = gameState === "between" ? `스테이지 ${wave + 1} 시작` : "스테이지 시작";
  $("#speed-button").textContent = `배속 ${gameSpeed}x`;
  pauseButton.disabled = gameState !== "playing" && gameState !== "paused";
  pauseButton.textContent = gameState === "paused" ? "전투 재개" : "일시 정지";
  towerButtons.forEach((button) => {
    const type = towerOptions[button.dataset.build];
    button.disabled = gameState === "won" || gameState === "lost" || !type || gold < type.cost;
    button.setAttribute("aria-pressed", String(button.dataset.build === selectedBuild));
  });
  const selectedIsPlaced = Boolean(selectedTower);
  const progressionCost = selectedTower?.level >= 3 ? selectedTower.evolutionCost : selectedTower?.upgradeCost;
  $("#upgrade-button").disabled = !selectedIsPlaced || selectedTower.evolved || gold < (progressionCost ?? Infinity);
  $("#upgrade-button").textContent = !selectedTower || selectedTower.level < 3
    ? "강화"
    : selectedTower.evolved ? "진화 완료" : "진화";
  $("#sell-button").disabled = !selectedIsPlaced;
  if (!selectedTower) {
    $("#selected-tower-name").textContent = selectedBuild ? towerOptions[selectedBuild].name : "없음";
    $("#selected-tower-info").textContent = selectedBuild
      ? "맵에서 길과 떨어진 빈 땅을 눌러 건설하세요."
      : "건설할 타워를 고르거나 이미 지은 타워를 클릭하세요.";
  } else {
    $("#selected-tower-name").textContent = `${selectedTower.name} · Lv.${selectedTower.level}`;
    const nextProgression = selectedTower.evolved
      ? `${selectedTower.evolutionName} · 최종 진화`
      : selectedTower.level < 3
        ? `다음 강화 ${selectedTower.upgradeCost} G`
        : `진화 ${selectedTower.evolutionCost} G`;
    $("#selected-tower-info").textContent = `공격력 ${Math.round(selectedTower.damage)} · 사거리 ${selectedTower.range.toFixed(1)} · ${nextProgression}`;
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

function distanceToRoad(point, routeCount = activeRoutesForWave(wave)) {
  let closest = Infinity;
  for (const route of routeDefinitions.slice(0, routeCount)) {
    for (let index = 1; index < route.points.length; index += 1) {
      closest = Math.min(closest, distanceToSegmentXZ(point, route.points[index - 1], route.points[index]));
    }
  }
  return closest;
}

function createLandscape() {
  let seed = 20261126;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const treeCenters = [];
  const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.38, 3.2, 6);
  const canopyGeometries = [
    new THREE.ConeGeometry(1.25, 2.45, 6),
    new THREE.ConeGeometry(1.55, 2.1, 5),
    new THREE.CylinderGeometry(0.82, 1.4, 1.9, 5),
  ];
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x554435, roughness: 0.96 });
  const canopyMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x355d43, roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ color: 0x4d7045, roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ color: 0x6a8050, roughness: 0.92 }),
  ];

  for (let attempt = 0; attempt < 3600 && treeCenters.length < 48; attempt += 1) {
    const x = -42 + random() * 84;
    const z = -36 + random() * 72;
    const point = new THREE.Vector3(x, 0, z);
    if (distanceToRoad(point, routeDefinitions.length) < 7
      || castleSites.some(([cx, cz, scale]) => Math.hypot(x - cx, z - cz) < 13 * scale)) continue;
    if (Math.hypot(x - 31, z + 18) < 8) continue;
    if (treeCenters.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 4.2)) continue;
    treeCenters.push([x, z]);

    const style = Math.floor(random() * canopyGeometries.length);
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1.6;
    trunk.castShadow = true;
    const lowerCanopy = new THREE.Mesh(canopyGeometries[style], canopyMaterials[style]);
    lowerCanopy.position.y = style === 2 ? 3.35 : 3.65;
    lowerCanopy.castShadow = true;
    tree.add(trunk, lowerCanopy);
    if (style !== 2) {
      const upperCanopy = new THREE.Mesh(canopyGeometries[(style + 1) % 2], canopyMaterials[(style + 1) % 3]);
      upperCanopy.position.y = 4.65;
      upperCanopy.scale.setScalar(style === 0 ? 0.68 : 0.55);
      upperCanopy.castShadow = true;
      tree.add(upperCanopy);
    }
    const scale = 0.78 + random() * 0.65;
    tree.scale.setScalar(scale);
    tree.position.set(x, 0, z);
    tree.rotation.y = random() * Math.PI * 2;
    scene.add(tree);
  }

  const grassColors = [0x476841, 0x66834d, 0x7d8950, 0x526f55];
  const grassGeometry = new THREE.ConeGeometry(0.12, 0.78, 3);
  const grassBlades = grassColors.map(() => []);
  let grassClusters = 0;
  for (let attempt = 0; attempt < 12000 && grassClusters < 700; attempt += 1) {
    const x = -42 + random() * 84;
    const z = -36 + random() * 72;
    if (distanceToRoad(new THREE.Vector3(x, 0, z), routeDefinitions.length) < 5.4) continue;
    if (castleSites.some(([cx, cz, scale]) => Math.hypot(x - cx, z - cz) < 9 * scale)) continue;
    if (Math.hypot(x - 31, z + 18) < 6) continue;
    grassClusters += 1;
    for (let blade = 0; blade < 3; blade += 1) {
      grassBlades[Math.floor(random() * grassBlades.length)].push({
        x: x + (random() - 0.5) * 0.34,
        z: z + (random() - 0.5) * 0.34,
        scale: 0.65 + random() * 0.8,
        angle: random() * Math.PI * 2,
        lean: (random() - 0.5) * 0.45,
      });
    }
  }

  const blade = new THREE.Object3D();
  grassBlades.forEach((blades, colorIndex) => {
    if (!blades.length) return;
    const grass = new THREE.InstancedMesh(
      grassGeometry,
      new THREE.MeshStandardMaterial({ color: grassColors[colorIndex], roughness: 1 }),
      blades.length,
    );
    blades.forEach((item, index) => {
      blade.position.set(item.x, 0.39 * item.scale, item.z);
      blade.rotation.set(item.lean, item.angle, -item.lean * 0.7);
      blade.scale.setScalar(item.scale);
      blade.updateMatrix();
      grass.setMatrixAt(index, blade.matrix);
    });
    grass.instanceMatrix.needsUpdate = true;
    grass.frustumCulled = false;
    grass.receiveShadow = true;
    scene.add(grass);
  });
}

createLandscape();

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
      : new THREE.CylinderGeometry(typeName === "cannon" ? 1.55 : 1.05, typeName === "cannon" ? 1.85 : 1.55, 0.75, 8);
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
  } else if (typeName === "cannon") {
    const towerBody = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.1, 2.15, 8), baseMaterial);
    towerBody.position.y = 1.5;
    towerBody.castShadow = true;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, 1.7, 8), bodyMaterial);
    barrel.position.set(0, 2.9, 0.55);
    barrel.rotation.x = Math.PI / 2.7;
    barrel.castShadow = true;
    group.add(towerBody, barrel);
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
      : typeName === "cannon"
        ? new THREE.CylinderGeometry(0.5, 0.72, 0.65, 8)
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
  const evolutionHalo = new THREE.Mesh(
    new THREE.TorusGeometry(1.65, 0.1, 8, 36),
    new THREE.MeshBasicMaterial({ color: 0xffe87b, transparent: true, opacity: 0.9 }),
  );
  evolutionHalo.position.y = core.position.y + 0.55;
  evolutionHalo.rotation.x = Math.PI / 2;
  evolutionHalo.visible = false;
  group.add(evolutionHalo);
  const unstableAura = new THREE.Group();
  const unstableMaterial = new THREE.MeshBasicMaterial({
    color: 0xc36bff,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const unstableColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.65, 5.2, 12, 1, true), unstableMaterial);
  unstableColumn.position.y = 2.7;
  const unstableRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.85, 0.11, 8, 36),
    new THREE.MeshBasicMaterial({ color: 0xd192ff, transparent: true, opacity: 0.95 }),
  );
  unstableRing.rotation.x = Math.PI / 2;
  unstableRing.position.y = 0.22;
  const unstableCrown = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.065, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xb84dff, transparent: true, opacity: 0.92 }),
  );
  unstableCrown.rotation.x = Math.PI / 2;
  unstableCrown.position.y = 4.25;
  unstableAura.add(unstableColumn, unstableRing, unstableCrown);
  unstableAura.visible = false;
  group.add(unstableAura);
  const placementRing = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 40),
    new THREE.MeshBasicMaterial({ color: 0xff4545, transparent: true, opacity: 0.24, depthWrite: false }),
  );
  placementRing.rotation.x = -Math.PI / 2;
  placementRing.position.y = 0.12;
  placementRing.visible = false;
  group.add(placementRing);
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
    evolutionHalo,
    unstableAura,
    unstableLeft: 0,
    evolved: false,
    evolutionCost: 190,
    evolutionName: "",
    rangeRing,
    placementRing,
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
  const nonInteractiveMeshes = new Set([evolutionHalo, ...unstableAura.children]);
  group.traverse((object) => {
    if (object.isMesh && object !== rangeRing && object !== placementRing && !nonInteractiveMeshes.has(object)) towerMeshes.push(object);
  });
  placementBlockRings.push(placementRing);
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
  if (!selectedTower) return;
  const tower = selectedTower;
  if (tower.level < 3) {
    if (gold < tower.upgradeCost) return;
    gold -= tower.upgradeCost;
    tower.spent += tower.upgradeCost;
    tower.level += 1;
    tower.damage *= 1.42;
    tower.range += 0.85;
    tower.cooldown *= 0.91;
    tower.splash *= 1.12;
    tower.upgradeCost = Math.round(tower.upgradeCost * 1.5);
    tower.core.material.emissiveIntensity += 0.65;
    setStatus(`${tower.name} 강화 완료! 공격력이 상승했습니다.`);
  } else {
    if (tower.evolved || gold < tower.evolutionCost) return;
    const evolutions = {
      bolt: { name: "태양 폭풍", damage: 1.3, cooldown: 0.8, splash: 2.5 },
      frost: { name: "빙하 공명", damage: 1.28, cooldown: 0.82, splash: 2.2, slow: 1.2 },
      storm: { name: "천둥 군주", damage: 1.42, cooldown: 0.84, splash: 2.1 },
      cannon: { name: "차원 포격", damage: 1.38, cooldown: 0.86, splash: 2.8 },
    };
    const evolution = evolutions[tower.type];
    gold -= tower.evolutionCost;
    tower.spent += tower.evolutionCost;
    tower.evolved = true;
    tower.evolutionName = evolution.name;
    tower.level = 4;
    tower.damage *= evolution.damage;
    tower.cooldown *= evolution.cooldown;
    tower.range += 1.2;
    tower.splash += evolution.splash;
    tower.slow += evolution.slow ?? 0;
    tower.core.material.emissiveIntensity += 1.25;
    tower.evolutionHalo.visible = true;
    tower.evolutionHalo.rotation.y = Math.PI / 5;
    setStatus(`${tower.name} 진화! ${evolution.name} 고유 효과가 활성화되었습니다.`);
  }
  tower.core.scale.copy(tower.coreScale).multiplyScalar(1 + (tower.level - 1) * 0.11);
  tower.rangeRing.geometry.dispose();
  tower.rangeRing.geometry = new THREE.CircleGeometry(tower.range, 56);
  playSound(tower.evolved ? "storm" : "wave");
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
  tower.placementRing.geometry.dispose();
  tower.placementRing.material.dispose();
  for (let index = towerMeshes.length - 1; index >= 0; index -= 1) {
    if (removedMeshes.has(towerMeshes[index])) towerMeshes.splice(index, 1);
  }
  const placementRingIndex = placementBlockRings.indexOf(tower.placementRing);
  if (placementRingIndex >= 0) placementBlockRings.splice(placementRingIndex, 1);
  const index = towers.indexOf(tower);
  if (index >= 0) towers.splice(index, 1);
  selectedTower = null;
  setStatus(`${tower.name} 철거. 투자 비용 일부를 회수했습니다.`);
  updateHud();
}

function createEnemy(isBoss = false, spawnEntryIndex = 0, isMidBoss = false) {
  const group = new THREE.Group();
  const template = isBoss ? dragonTemplate : nosiTemplate;
  const isLargeEnemy = isBoss || isMidBoss;
  const facingOffset = isBoss ? 0 : -Math.PI / 2;
  const model = template
    ? centeredModel(template, isBoss ? 4.6 : isMidBoss ? 3.5 : 2.6)
    : new THREE.Mesh(
      new THREE.CapsuleGeometry(isLargeEnemy ? 1.1 : 0.7, isLargeEnemy ? 2 : 1.2, 5, 8),
      new THREE.MeshStandardMaterial({
        color: isLargeEnemy ? 0x9b624c : 0x879a73,
        emissive: isLargeEnemy ? 0x4a1f12 : 0x203016,
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

  let hpFill = null;
  if (isLargeEnemy) {
    const hpBack = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x291e1a, side: THREE.DoubleSide }),
    );
    hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(2.15, 0.09),
      new THREE.MeshBasicMaterial({ color: isBoss ? 0xd780ff : 0xff9b58, side: THREE.DoubleSide }),
    );
    hpBack.position.y = 5.1;
    hpFill.position.set(0, 5.1, 0.015);
    group.add(hpBack, hpFill);
    group.userData.hpFill = hpFill;
  }

  const maxHealth = isBoss ? 5200 + wave * 500 : isMidBoss ? 1400 + wave * 260 : 50 + wave * 23;
  const routeIndex = spawnEntryIndex % activeSpawnCount;
  const enemy = {
    group,
    mixer,
    hpFill,
    facingOffset,
    health: maxHealth,
    maxHealth,
    progress: 0,
    routeIndex,
    speed: (isLargeEnemy ? 1.75 : 2.7) + wave * 0.11,
    slowLeft: 0,
    isBoss,
    isMidBoss,
    skillCooldown: isBoss ? 6.5 : isMidBoss ? 8.5 : Infinity,
    skillCooldownLeft: isBoss ? 6.5 : isMidBoss ? 8.5 : Infinity,
    dead: false,
    reward: isBoss ? 180 : isMidBoss ? 90 : 16 + wave * 2,
  };
  const route = routeDefinitions[routeIndex];
  const start = route.curve.getPointAt(enemy.progress);
  const tangent = route.curve.getTangentAt(enemy.progress);
  group.position.copy(start);
  group.rotation.y = Math.atan2(tangent.x, tangent.z);
  scene.add(group);
  enemies.push(enemy);
  updateBossHealth(enemy);
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

function showBossWarning(isFinalBoss) {
  bossWarning.textContent = isFinalBoss ? "경고 · 최종 보스 계층주 출현!" : "경고 · 중간 보스 출현!";
  bossWarning.hidden = false;
  bossWarningLeft = 1;
}

function applyBossSkill(enemy) {
  const candidates = towers
    .map((tower) => ({
      tower,
      distance: Math.hypot(
        tower.group.position.x - enemy.group.position.x,
        tower.group.position.z - enemy.group.position.z,
      ),
    }))
    .sort((first, second) => first.distance - second.distance);
  const affected = candidates.filter(({ distance }) => distance <= 22).slice(0, enemy.isBoss ? 3 : 2);
  if (!affected.length && candidates.length) affected.push(candidates[0]);
  const duration = enemy.isBoss ? 3.8 : 2.8;
  affected.forEach(({ tower }) => {
    tower.unstableLeft = Math.max(tower.unstableLeft, duration);
    tower.unstableAura.visible = true;
  });
  screenShakeLeft = enemy.isBoss ? 0.85 : 0.62;
  screenShakeStrength = enemy.isBoss ? 1.15 : 0.72;
  createImpact(enemy.group.position, 0xc36bff, enemy.isBoss ? 4.2 : 3, "storm");
  setStatus(affected.length
    ? `${enemy.isBoss ? "계층주" : "중간 보스"}의 균열 파동! ${affected.length}개 타워가 ${duration.toFixed(2)}초간 불안정해 공격을 멈춥니다.`
    : `${enemy.isBoss ? "계층주" : "중간 보스"}가 균열 파동을 일으켰습니다!`);
}

function fireFrostWave(tower, target) {
  tower.cooldownLeft = tower.cooldown;
  tower.halo.rotation.z += 0.7;
  const center = target.group.position.clone();
  enemies.slice().forEach((enemy) => {
    if (Math.hypot(enemy.group.position.x - center.x, enemy.group.position.z - center.z) > tower.splash) return;
    enemy.slowLeft = Math.max(enemy.slowLeft, tower.slow);
    damageEnemy(enemy, tower.damage);
  });

  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0xaaf7ff, transparent: true, opacity: 0.95, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.065, 8, 48), material);
  ring.rotation.x = Math.PI / 2;
  group.position.set(center.x, 0.22, center.z);
  group.add(ring);
  scene.add(group);
  impactEffects.push({
    group,
    age: 0,
    life: 0.48,
    meshes: [ring],
    materials: [material],
    model: false,
    waveRadius: tower.splash,
  });
  playSound("frost");
}

function fireTower(tower, target) {
  if (tower.type === "frost") {
    fireFrostWave(tower, target);
    return;
  }
  tower.cooldownLeft = tower.cooldown;
  tower.halo.rotation.z += 0.7;
  const mesh = new THREE.Group();
  const color = towerOptions[tower.type].color;
  if (tower.type === "bolt" && energyOrbTemplate) {
    const orb = cloneSkinnedModel(energyOrbTemplate);
    orb.scale.setScalar(0.42);
    orb.traverse((object) => { if (object.isMesh) object.frustumCulled = false; });
    mesh.add(orb);
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
  if (enemy.hpFill) {
    enemy.hpFill.scale.x = Math.max(0.001, enemy.health / enemy.maxHealth);
    enemy.hpFill.position.x = -2.15 * (1 - enemy.health / enemy.maxHealth) / 2;
  }
  updateBossHealth(enemy);
  if (enemy.health <= 0) {
    enemy.dead = true;
    hideBossHealth(enemy);
    gold += enemy.reward;
    totalKills += 1;
    createImpact(enemy.group.position, enemy.isBoss || enemy.isMidBoss ? 0xffa45f : 0xb9e480, enemy.isBoss || enemy.isMidBoss ? 2 : 1, "death");
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
    if (tower.unstableLeft > 0) {
      tower.unstableLeft = Math.max(0, tower.unstableLeft - delta);
      tower.unstableAura.visible = tower.unstableLeft > 0;
      tower.unstableAura.rotation.y += delta * 1.8;
      continue;
    }
    tower.unstableAura.visible = false;
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
      if (effect.waveRadius) {
        effect.group.scale.setScalar(Math.max(0.01, progress) * effect.waveRadius);
      } else {
        effect.group.scale.setScalar(0.65 + progress * (effect.meshes.length > 4 ? 1.1 : 1.6));
      }
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
    const route = routeDefinitions[enemy.routeIndex];
    enemy.progress += (enemy.speed * speedScale * delta) / route.length;
    if (enemy.progress >= 1) {
      enemy.dead = true;
      scene.remove(enemy.group);
      enemies.splice(enemies.indexOf(enemy), 1);
      gateHealth = Math.max(0, gateHealth - (enemy.isBoss ? 4 : enemy.isMidBoss ? 2 : 1));
      hideBossHealth(enemy);
      setStatus(enemy.isBoss ? "계층주가 균열핵을 강타했습니다!" : enemy.isMidBoss ? "중간 보스가 균열핵을 강타했습니다!" : "적이 균열핵에 도달했습니다.");
      playSound("gate");
      if (gateHealth <= 0) finishGame(false);
      updateHud();
      continue;
    }
    const position = route.curve.getPointAt(enemy.progress);
    const tangent = route.curve.getTangentAt(enemy.progress);
    enemy.group.position.copy(position);
    enemy.group.rotation.y = Math.atan2(tangent.x, tangent.z);
    if (enemy.hpFill) {
      enemy.hpFill.quaternion.copy(camera.quaternion);
      enemy.hpFill.material.color.setHex(enemy.slowLeft > 0 ? 0x80e7fa : enemy.isBoss ? 0xd780ff : 0xff9b58);
    }
    if (enemy.isBoss || enemy.isMidBoss) {
      enemy.skillCooldownLeft -= delta;
      if (enemy.skillCooldownLeft <= 0) {
        applyBossSkill(enemy);
        enemy.skillCooldownLeft = enemy.skillCooldown;
      }
    }
  }
}

function startWave() {
  if (gameState !== "ready" && gameState !== "between") return;
  if (gameState === "between") wave += 1;
  gameState = "playing";
  enemiesToSpawn = 5 + wave * 2;
  activeSpawnCount = activeRoutesForWave(wave);
  waveSpawnIndex = 0;
  updateEntryPortals(activeSpawnCount);
  spawnTimer = 0;
  bossWarningLeft = 0;
  bossWarning.hidden = true;
  screenShakeLeft = 0;
  screenShakeStrength = 0;
  const bossMessage = wave === 5
    ? " 중간 보스가 마지막에 등장합니다."
    : wave === 10
      ? " 최종 보스 계층주가 마지막에 등장합니다."
      : "";
  setStatus(`스테이지 ${wave}: ${activeSpawnCount}개 도로에서 적 ${enemiesToSpawn}마리가 접근합니다.${bossMessage}`);
  playSound("wave");
  updateHud();
}

function finishWaveIfClear() {
  if (gameState !== "playing" || enemiesToSpawn > 0 || enemies.length > 0) return;
  if (wave >= 10) {
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
    tower.placementRing.geometry.dispose();
    tower.placementRing.material.dispose();
  });
  towers.length = 0;
  towerMeshes.length = 0;
  placementBlockRings.length = 0;
  selectedTower = null;
  selectedBuild = null;
  hideBossHealth();
  gameState = "ready";
  wave = 1;
  gold = 240;
  gateHealth = 20;
  enemiesToSpawn = 0;
  spawnTimer = 0;
  waveSpawnIndex = 0;
  activeSpawnCount = 1;
  gameSpeed = 1;
  bossWarningLeft = 0;
  bossWarning.hidden = true;
  screenShakeLeft = 0;
  screenShakeStrength = 0;
  updateEntryPortals(activeRoutesForWave(1));
  roadLayers.forEach(({ noBuildZone }) => { noBuildZone.visible = false; });
  placementBounds.forEach((band) => { band.visible = false; });
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
  groundHit.x = THREE.MathUtils.clamp(Math.round(groundHit.x / 2) * 2, -40, 40);
  groundHit.z = THREE.MathUtils.clamp(Math.round(groundHit.z / 2) * 2, -34, 34);
  groundHit.y = 0;
  return groundHit;
}

function canBuildAt(point) {
  if (Math.abs(point.x) > 41 || Math.abs(point.z) > 35) return false;
  if (distanceToRoad(point) < 3.9) return false;
  if (castleSites.some(([x, z, scale]) => Math.abs(point.x - x) < 9.5 * scale && Math.abs(point.z - z) < 8 * scale)) return false;
  return towers.every((tower) => Math.hypot(tower.group.position.x - point.x, tower.group.position.z - point.z) >= 3.2);
}

function getTowerFromHit(object) {
  let current = object;
  while (current && !current.userData.tower) current = current.parent;
  return current?.userData.tower ?? null;
}

function handleMapClick(event) {
  if (suppressMapClick) {
    suppressMapClick = false;
    return;
  }
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
  if (cameraDrag) return;
  updatePointer(event);
  const placing = Boolean(selectedBuild);
  roadLayers.forEach(({ noBuildZone }, index) => {
    noBuildZone.visible = placing && index < activeRoutesForWave(wave);
  });
  placementBounds.forEach((band) => { band.visible = placing; });
  placementBlockRings.forEach((ring) => { ring.visible = placing; });
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
  const viewHeight = (window.innerWidth < 760 ? 76 : 80) / zoom;
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
  if (bossWarningLeft > 0) {
    bossWarningLeft = Math.max(0, bossWarningLeft - delta);
    if (bossWarningLeft === 0) bossWarning.hidden = true;
  }
  screenShakeLeft = Math.max(0, screenShakeLeft - delta);

  updateCameraMovement(delta);
  const simulationDelta = delta * gameSpeed;
  if (gameState === "playing") {
    spawnTimer -= simulationDelta;
    if (enemiesToSpawn > 0 && spawnTimer <= 0) {
      const isFinalBoss = wave === 10 && enemiesToSpawn === 1;
      const isMidBoss = wave === 5 && enemiesToSpawn === 1;
      const enemy = createEnemy(isFinalBoss, waveSpawnIndex % activeSpawnCount, isMidBoss);
      if (isFinalBoss || isMidBoss) {
        showBossWarning(isFinalBoss);
        applyBossSkill(enemy);
      }
      waveSpawnIndex += 1;
      enemiesToSpawn -= 1;
      spawnTimer = Math.max(0.42, 0.92 - wave * 0.04);
    }
    updateEnemies(simulationDelta);
    if (gameState === "playing") updateCombat(simulationDelta);
    updateHud();
    finishWaveIfClear();
  }

  for (const tower of towers) {
    tower.core.rotation.y += delta * 0.8;
    tower.halo.rotation.z -= delta * 0.55;
    if (tower.evolved) tower.evolutionHalo.rotation.z += delta * 0.7;
  }
  entryPortals.forEach((portal, index) => {
    portal.swirl.rotation.z += delta * (index % 2 === 0 ? 0.8 : -0.65);
    portal.floorRing.rotation.z += delta * (index % 2 === 0 ? 0.25 : -0.2);
    portal.floorRing.material.opacity = (portal.active ? 0.62 : 0.16) + Math.sin(timestamp * 0.003 + index) * 0.08;
    portal.core.rotation.y += delta * (index % 2 === 0 ? 0.45 : -0.55);
    portal.riftArc.rotation.z += delta * (index % 2 === 0 ? -0.32 : 0.27);
    const scale = portal.active ? 1.18 : 0.92;
    portal.group.scale.setScalar(scale * (1 + Math.sin(timestamp * 0.002 + index) * 0.025));
  });
  coreCrystal.rotation.y += delta * 0.42;
  coreRing.rotation.z += delta * 0.26;
  let shakeX = 0;
  let shakeY = 0;
  let shakeZ = 0;
  if (screenShakeLeft > 0) {
    const intensity = screenShakeStrength * Math.min(1, screenShakeLeft / 0.28);
    shakeX = (Math.random() - 0.5) * intensity;
    shakeY = (Math.random() - 0.5) * intensity * 0.55;
    shakeZ = (Math.random() - 0.5) * intensity;
    camera.position.x += shakeX;
    camera.position.y += shakeY;
    camera.position.z += shakeZ;
  }
  renderer.render(scene, camera);
  if (screenShakeLeft > 0) {
    camera.position.x -= shakeX;
    camera.position.y -= shakeY;
    camera.position.z -= shakeZ;
  }
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
$("#speed-button").addEventListener("click", () => {
  gameSpeed = gameSpeed === 1 ? 2 : gameSpeed === 2 ? 3 : 1;
  updateHud();
});
$("#restart-button").addEventListener("click", resetGame);
$("#camera-toggle").addEventListener("click", () => {
  cameraControlEnabled = !cameraControlEnabled;
  pressedKeys.clear();
  $("#camera-toggle").setAttribute("aria-pressed", String(cameraControlEnabled));
  $("#camera-toggle").textContent = cameraControlEnabled ? "자유 시점 켜짐" : "자유 시점 T";
  canvas.classList.toggle("camera-control", cameraControlEnabled);
  setStatus(cameraControlEnabled
    ? "자유 시점: WASD 또는 좌클릭 드래그로 화면 이동, 우클릭 드래그로 시점 회전, Shift+좌클릭/Q/E로 기울이기, R 기본 시점."
    : "자유 시점을 종료했습니다.");
});
$("#sound-toggle").addEventListener("click", (event) => {
  soundEnabled = !soundEnabled;
  event.currentTarget.textContent = soundEnabled ? "사운드 켜짐" : "사운드 꺼짐";
  event.currentTarget.setAttribute("aria-pressed", String(soundEnabled));
  if (soundEnabled) playSound("wave");
});

canvas.addEventListener("pointerdown", (event) => {
  if (!cameraControlEnabled || (event.button !== 0 && event.button !== 2)) return;
  cameraDrag = { x: event.clientX, y: event.clientY, moved: false, button: event.button };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (cameraDrag) {
    const deltaX = event.clientX - cameraDrag.x;
    const deltaY = event.clientY - cameraDrag.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 2) cameraDrag.moved = true;
    if (cameraDrag.button === 2) {
      cameraAzimuth -= deltaX * 0.008;
      cameraPolar = THREE.MathUtils.clamp(cameraPolar + deltaY * 0.008, 0.08, Math.PI * 0.61);
    } else if (event.shiftKey) {
      cameraRoll = THREE.MathUtils.clamp(cameraRoll + deltaX * 0.008, -Math.PI / 3, Math.PI / 3);
    } else {
      const worldPerPixel = (camera.top - camera.bottom) / canvas.clientHeight;
      const rightX = Math.cos(cameraAzimuth);
      const rightZ = -Math.sin(cameraAzimuth);
      const upX = -Math.cos(cameraPolar) * Math.sin(cameraAzimuth);
      const upZ = -Math.cos(cameraPolar) * Math.cos(cameraAzimuth);
      cameraTarget.x = THREE.MathUtils.clamp(cameraTarget.x - (deltaX * rightX + deltaY * upX) * worldPerPixel, -55, 55);
      cameraTarget.z = THREE.MathUtils.clamp(cameraTarget.z - (deltaX * rightZ + deltaY * upZ) * worldPerPixel, -48, 48);
    }
    cameraDrag.x = event.clientX;
    cameraDrag.y = event.clientY;
    updateCamera();
    return;
  }
  updatePlacementPreview(event);
});
canvas.addEventListener("pointerup", (event) => {
  if (!cameraDrag) return;
  suppressMapClick = cameraDrag.moved;
  cameraDrag = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener("pointercancel", () => { cameraDrag = null; });
canvas.addEventListener("contextmenu", (event) => {
  if (cameraControlEnabled) event.preventDefault();
});
canvas.addEventListener("pointerleave", () => { placementPreview.visible = false; });
canvas.addEventListener("click", handleMapClick);
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoom = THREE.MathUtils.clamp(zoom * Math.exp(-event.deltaY * 0.001), 0.72, 2.1);
  resize();
}, { passive: false });
window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
  if (event.key.toLowerCase() === "t") $("#camera-toggle").click();
  if (!cameraControlEnabled) return;
  const key = event.key.toLowerCase();
  if (["w", "a", "s", "d"].includes(key)) {
    pressedKeys.add(key);
    event.preventDefault();
    return;
  }
  if (key === "q") cameraRoll = THREE.MathUtils.clamp(cameraRoll - 0.08, -Math.PI / 3, Math.PI / 3);
  if (key === "e") cameraRoll = THREE.MathUtils.clamp(cameraRoll + 0.08, -Math.PI / 3, Math.PI / 3);
  if (key === "r") {
    cameraTarget.set(20, 0, 0);
    cameraAzimuth = 0;
    cameraPolar = Math.PI / 4;
    cameraRoll = 0;
    zoom = 1;
    resize();
  }
  updateCamera();
});
window.addEventListener("keyup", (event) => {
  pressedKeys.delete(event.key.toLowerCase());
});
window.addEventListener("blur", () => { pressedKeys.clear(); });

resize();
updateHud();
updateAssetStatus();
requestAnimationFrame(frame);
