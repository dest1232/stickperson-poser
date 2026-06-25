import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const MODEL_URL = new URL('stickman_parts.glb', document.baseURI).href;
const BASEPLATE_URL = new URL('default_baseplate.glb', document.baseURI).href;
const STORAGE_KEY = 'stickperson-poser.savedPose.v1';
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const CONTROL_RING_DIAMETER = 0.036;
const CONTROL_RING_STROKE = 0.006;
const CONTROL_RING_COLOR = 0xd4741f;
const CONTROL_RING_FILL_COLOR = 0xf4d1ad;
const CONTROL_RING_SELECTED_COLOR = 0xffc857;
const CONTROL_RING_SELECTED_FILL_COLOR = 0xffeebc;
const CONTROL_RING_DISABLED_COLOR = 0x7c746a;
const CONTROL_RING_DISABLED_FILL_COLOR = 0xd8d0c6;
const DEFAULT_PART_COLORS = {
  Parts_001: 0xe63946,
  Parts_002: 0xf0f3f8,
  Parts_003: 0x111111,
  Parts_004: 0x111111,
  Parts_005: 0xe63946,
  Parts_006: 0xe63946,
  Parts_007: 0x808080,
  Parts_008: 0xe63946,
  Parts_009: 0xe63946,
  Parts_010: 0x808080,
  Parts_011: 0x808080,
  Parts_012: 0xd4741f,
};
const DEFAULT_BASEPLATE_COLOR = 0x2f9e62;
const DEFAULT_POSE = {
  mixamorigHips: {
    rotation: [-1.5707962925663537, 0, 0],
    position: [-0.012818546290506813, -0.0009410733582664726, -0.9194638665465535],
  },
  mixamorigLeftShoulder: {
    rotation: [1.5652117443769993, -0.4441839015145959, -1.5840255307105413],
  },
  mixamorigLeftArm: {
    rotation: [0.8276702849326172, 0.13252735802316135, -0.22958575381574203],
  },
  mixamorigLeftForeArm: {
    rotation: [-0.07679694761126665, -0.0034058786303356376, 0.5005735622667496],
  },
  mixamorigLeftHand: {
    rotation: [-0.046373609490984034, 0.0026929077082030544, -0.05796850554252944],
  },
  mixamorigLeftHandIndex1: {
    rotation: [0.024811901692421687, -0.0035974945049966015, -0.14396006878591644],
  },
  mixamorigRightShoulder: {
    rotation: [1.563263836298792, 0.44403422211981336, 1.5886049703421425],
  },
  mixamorigRightArm: {
    rotation: [0.8238887747598844, -0.11198524550109362, 0.2720072748250259],
  },
  mixamorigRightForeArm: {
    rotation: [-0.0767015563661833, 0.0033822698336967443, -0.49913126473271463],
  },
  mixamorigRightHand: {
    rotation: [0.002675849516278053, -0.00003907629539673592, -0.01463639221551877],
  },
  mixamorigRightHandIndex1: {
    rotation: [2.1893415818305155, -1.0117803182932998, 2.2691672338832407],
  },
  mixamorigLeftUpLeg: {
    rotation: [-0.1298663524020236, -0.0030417550993555075, -3.0381528037643233],
  },
  mixamorigLeftLeg: {
    rotation: [-0.3803443933248065, 0.011566502147186573, 0.0036502377830995936],
  },
  mixamorigLeftFoot: {
    rotation: [1.183221882748981, -0.08587731378154509, -0.0394078704664922],
  },
  mixamorigLeftToeBase: {
    rotation: [0.5973427717087232, 0.031095009954501, -0.02114559986063893],
  },
  mixamorigRightUpLeg: {
    rotation: [-0.24387694373828286, 0.01576889727260951, 3.047091601001579],
  },
  mixamorigRightLeg: {
    rotation: [-0.5787121523497185, -0.010018041272186048, -0.0025504115023009155],
  },
  mixamorigRightFoot: {
    rotation: [1.2709664931161702, 0.07921485125804159, 0.033030014531785674],
  },
  mixamorigRightToeBase: {
    rotation: [0.5934957153865638, -0.03111626654346832, 0.020985539062822526],
  },
};
const IK_DEFAULT_OPTIONS = {
  iterations: 10,
  damping: 0.55,
  maxAngle: 0.22,
  poleStrength: 0.7,
  lockEndRotation: false,
};
const stickmanMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xf0f3f8,
  roughness: 0.62,
  metalness: 0,
  specularIntensity: 0.3,
  specularColor: 0xfff4e6,
});

const viewer = document.querySelector('#viewer');
const stageWrap = document.querySelector('#stageWrap');
const loading = document.querySelector('#loading');
const status = document.querySelector('#status');
const jointSelect = document.querySelector('#jointSelect');
const baseplateToggle = document.querySelector('#baseplateToggle');
const paintToggle = document.querySelector('#paintToggle');
const colorPalette = document.querySelector('#colorPalette');
const moveToolButton = document.querySelector('#moveTool');
const rotateToolButton = document.querySelector('#rotateTool');
const positionModeButton = document.querySelector('#positionMode');
const rotationModeButton = document.querySelector('#rotationMode');
const colorSwatches = [...document.querySelectorAll('[data-paint-color]')];
const undoPoseButton = document.querySelector('#undoPose');
const loadPoseButton = document.querySelector('#loadPose');
const rotationInputs = {
  x: document.querySelector('#rotX'),
  y: document.querySelector('#rotY'),
  z: document.querySelector('#rotZ'),
};
const rotationOutputs = {
  x: document.querySelector('#rotXOut'),
  y: document.querySelector('#rotYOut'),
  z: document.querySelector('#rotZOut'),
};

const viewportClasses = {
  fill: 'viewportFill',
  phonePortrait: 'viewportPhonePortrait',
  phoneLandscape: 'viewportPhoneLandscape',
  tabletPortrait: 'viewportTabletPortrait',
  tabletLandscape: 'viewportTabletLandscape',
};

const state = {
  bones: [],
  basePose: new Map(),
  selectedBone: null,
  model: null,
  baseplate: null,
  skeletonHelper: null,
  grid: null,
  jointHighlight: null,
  pelvisBone: null,
  pelvisController: null,
  pelvisControlPivot: null,
  controlHandles: [],
  controlHandleByRole: new Map(),
  positionIkTargets: new Map(),
  selectedController: null,
  controllerPoseBeforeDrag: null,
  controllerPivotBeforeDrag: null,
  controllerBoneBeforeDrag: null,
  controllerBonePositionBeforeDrag: null,
  selectedBoneLinks: null,
  transformPointerActive: false,
  transformPoseBeforeDrag: null,
  transformChanged: false,
  sliderPoseBeforeChange: null,
  sliderChanging: false,
  screenDrag: null,
  undoStack: [],
  requestedTransformMode: 'rotation',
  currentTransformMode: 'rotation',
  selectedPaintColor: '#f0f3f8',
  selectedPaintLabel: 'White',
  showColorPalette: false,
  showMesh: true,
  showSkeleton: false,
  showGrid: true,
  showBaseplate: true,
};

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
camera.position.set(1.5, 1.2, 2.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
viewer.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xe5f4ff, 0x7188aa, 1.6));

const keyLight = new THREE.DirectionalLight(0xfffbf2, 1.8);
keyLight.position.set(-3, 5, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 12;
keyLight.shadow.camera.left = -4;
keyLight.shadow.camera.right = 4;
keyLight.shadow.camera.top = 4;
keyLight.shadow.camera.bottom = -4;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xc7ddf7, 0.48);
fillLight.position.set(3, 3, 4);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0x9fc8f5, 0.7);
rimLight.position.set(3, 2.5, -3);
scene.add(rimLight);

const groundPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(12, 12),
  new THREE.ShadowMaterial({ color: 0x1f4e9a, opacity: 0.24 }),
);
groundPlane.rotation.x = -Math.PI / 2;
groundPlane.position.y = -0.002;
groundPlane.receiveShadow = true;
scene.add(groundPlane);

state.grid = new THREE.GridHelper(6, 24, 0x9bb4d9, 0xc9d8ef);
scene.add(state.grid);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0, 0.8, 0);

const transform = new TransformControls(camera, renderer.domElement);
transform.setMode('rotate');
transform.setSpace('local');
transform.setSize(0.58);
transform.enabled = false;
transform.visible = false;
const transformHelper = transform.getHelper();
transformHelper.visible = false;
transform.addEventListener('mouseDown', () => {
  state.transformPointerActive = true;
});
transform.addEventListener('mouseUp', () => {
  window.setTimeout(() => {
    state.transformPointerActive = false;
  }, 0);
});
transform.addEventListener('dragging-changed', (event) => {
  orbit.enabled = !event.value;
  if (event.value) {
    state.transformPoseBeforeDrag = clonePose();
    state.controllerPoseBeforeDrag = state.selectedController ? clonePose() : null;
    state.controllerPivotBeforeDrag = state.selectedController?.quaternion.clone() || null;
    state.controllerBoneBeforeDrag = state.selectedBone?.quaternion.clone() || null;
    state.controllerBonePositionBeforeDrag = state.selectedBone?.position.clone() || null;
    state.transformChanged = false;
  } else if (state.transformPoseBeforeDrag) {
    if (state.transformChanged && !posesEqual(state.transformPoseBeforeDrag, clonePose())) {
      pushUndo(state.transformPoseBeforeDrag);
      status.textContent = 'Pose changed';
    }
    state.transformPoseBeforeDrag = null;
    state.controllerPoseBeforeDrag = null;
    state.controllerPivotBeforeDrag = null;
    state.controllerBoneBeforeDrag = null;
    state.controllerBonePositionBeforeDrag = null;
    state.transformChanged = false;
  }
});
transform.addEventListener('objectChange', () => {
  state.transformChanged = true;
  if (state.currentTransformMode === 'position') {
    applyTransformControllerTranslation();
  }
  updateJointControllers();
  updateJointHighlight();
  updateSelectedBoneLinks();
  syncRotationUi();
});
scene.add(transformHelper);

const highlightMaterial = new THREE.MeshBasicMaterial({
  color: 0xffc857,
  depthTest: false,
  transparent: true,
  opacity: 0.92,
});
state.jointHighlight = new THREE.Mesh(new THREE.SphereGeometry(0.035, 20, 20), highlightMaterial);
state.jointHighlight.renderOrder = 10;
state.jointHighlight.visible = false;
scene.add(state.jointHighlight);

state.selectedBoneLinks = new THREE.Group();
state.selectedBoneLinks.visible = false;
state.selectedBoneLinks.renderOrder = 9;
scene.add(state.selectedBoneLinks);

new GLTFLoader().load(
  MODEL_URL,
  (gltf) => {
    state.model = gltf.scene;
    state.model.traverse((node) => {
      if (node.isMesh) {
        node.material = stickmanMaterial.clone();
        node.material.color.setHex(DEFAULT_PART_COLORS[node.name] ?? 0xf0f3f8);
        node.castShadow = true;
        node.receiveShadow = true;
        node.frustumCulled = false;
      }
    });

    const box = new THREE.Box3().setFromObject(state.model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    state.model.position.sub(center);
    state.model.position.y += size.y / 2;
    state.model.scale.multiplyScalar(1.6 / maxDimension);
    scene.add(state.model);

    state.bones = collectBones(state.model);
    applyDefaultPose(state.bones);
    state.pelvisBone = findPelvisBone(state.bones);
    state.basePose = new Map(
      state.bones.map((bone) => [
        bone.uuid,
        {
          x: bone.rotation.x,
          y: bone.rotation.y,
          z: bone.rotation.z,
          px: bone.position.x,
          py: bone.position.y,
          pz: bone.position.z,
        },
      ]),
    );

    state.skeletonHelper = new THREE.SkeletonHelper(state.model);
    state.skeletonHelper.visible = state.showSkeleton;
    scene.add(state.skeletonHelper);
    createJointRotationControllers();
    exposeDebugApi();

    populateJointSelect();
    deselectBone();
    status.textContent = `${state.bones.length} joints ready`;
    loading.hidden = true;
    loading.style.display = 'none';
    loadPoseButton.disabled = !localStorage.getItem(STORAGE_KEY);
  },
  undefined,
  (error) => {
    console.error(error);
    status.textContent = 'Could not load stickman_parts.glb';
    loading.textContent = 'Load failed';
  },
);

new GLTFLoader().load(
  BASEPLATE_URL,
  (gltf) => {
    state.baseplate = gltf.scene;
    state.baseplate.name = 'Default baseplate';
    state.baseplate.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = false;
        node.receiveShadow = true;
        node.frustumCulled = false;
        if (node.material) {
          node.material = node.material.clone();
          if (node.material.color) node.material.color.setHex(DEFAULT_BASEPLATE_COLOR);
          node.material.roughness = Math.max(node.material.roughness ?? 0.6, 0.72);
        }
      }
    });
    const baseplateBox = new THREE.Box3().setFromObject(state.baseplate);
    const baseplateCenter = baseplateBox.getCenter(new THREE.Vector3());
    state.baseplate.position.x -= baseplateCenter.x;
    state.baseplate.position.z -= baseplateCenter.z;
    state.baseplate.position.y += 0.002 - baseplateBox.max.y;
    state.baseplate.visible = state.showBaseplate;
    scene.add(state.baseplate);
  },
  undefined,
  (error) => {
    console.warn('Could not load default_baseplate.glb', error);
    if (baseplateToggle) {
      baseplateToggle.disabled = true;
      baseplateToggle.classList.remove('active');
      baseplateToggle.setAttribute('aria-pressed', 'false');
    }
  },
);

function exposeDebugApi() {
  window.stickpersonPoserDebug = {
    state,
    getHandlePosition(role) {
      return state.controlHandleByRole.get(role)?.position.toArray() || null;
    },
    getBoneWorldPosition(pattern) {
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
      const bone = state.bones.find((candidate) => regex.test(candidate.name));
      if (!bone) return null;
      return bone.getWorldPosition(new THREE.Vector3()).toArray();
    },
    getBoneWorldQuaternion(pattern) {
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
      const bone = state.bones.find((candidate) => regex.test(candidate.name));
      if (!bone) return null;
      return bone.getWorldQuaternion(new THREE.Quaternion()).toArray();
    },
    solveRole(role) {
      const handle = state.controlHandleByRole.get(role);
      if (handle) solveHandleIk(handle);
    },
    getHandleInfo(role) {
      const handle = state.controlHandleByRole.get(role);
      if (!handle) return null;
      return {
        role: handle.userData.role,
        limbType: handle.userData.limbType,
        targetBone: handle.userData.targetBone?.name,
        chain: handle.userData.ikChain?.map((bone) => bone.name) || [],
      };
    },
    getSelectionInfo() {
      return {
        mode: state.currentTransformMode,
        requestedMode: state.requestedTransformMode,
        selectedController: state.selectedController?.userData?.role || null,
        selectedBone: state.selectedBone?.name || null,
        dragging: Boolean(state.screenDrag),
      };
    },
    getHandleScreenPosition(role) {
      const handle = state.controlHandleByRole.get(role);
      if (!handle) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      const projected = handle.position.clone().project(camera);
      return [
        rect.left + ((projected.x + 1) / 2) * rect.width,
        rect.top + ((1 - projected.y) / 2) * rect.height,
      ];
    },
  };
}

function collectBones(root) {
  const bones = [];
  root.traverse((node) => {
    if (node.isBone) bones.push(node);
  });
  return bones;
}

function applyDefaultPose(bones) {
  bones.forEach((bone) => {
    const pose = DEFAULT_POSE[bone.name];
    if (!pose) return;
    if (pose.rotation) bone.rotation.fromArray(pose.rotation);
    if (pose.position) bone.position.fromArray(pose.position);
  });
  state.model?.updateMatrixWorld(true);
}

function findPelvisBone(bones) {
  return bones.find((bone) => /hips|pelvis/i.test(bone.name)) || bones[0] || null;
}

function createJointRotationControllers() {
  state.bones.forEach((bone, index) => {
    const controller = createControlRing(`${bone.name || `Joint ${index + 1}`} rotation controller`);
    const semanticRole = getJointSemanticRole(bone);
    controller.userData.controllerType = 'joint';
    controller.userData.targetBone = bone;
    controller.userData.label = bone.name || `Joint ${index + 1}`;
    controller.userData.role = bone.uuid;
    controller.userData.semanticRole = semanticRole;
    bone.getWorldPosition(controller.position);
    state.controlHandles.push(controller);
    state.controlHandleByRole.set(bone.uuid, controller);
    if (semanticRole) state.controlHandleByRole.set(semanticRole, controller);
    scene.add(controller);
  });
}

function getJointSemanticRole(bone) {
  const name = bone.name || '';
  if (/hips|pelvis/i.test(name)) return 'hips';
  if (/leftfoot$/i.test(name)) return 'leftFoot';
  if (/rightfoot$/i.test(name)) return 'rightFoot';
  return null;
}

function createPelvisController() {
  if (!state.pelvisBone) return;

  const controller = createControlRing('Pelvis controller');
  const pivot = new THREE.Object3D();
  pivot.name = 'Pelvis control pivot';
  pivot.userData.controllerType = 'pelvis';
  pivot.userData.targetBone = state.pelvisBone;
  pivot.userData.role = 'hips';
  controller.userData.controllerType = 'pelvis';
  controller.userData.targetBone = state.pelvisBone;
  controller.userData.role = 'hips';
  state.pelvisControlPivot = pivot;
  state.pelvisController = controller;
  state.controlHandles.push(controller);
  state.controlHandleByRole.set('hips', pivot);
  scene.add(pivot);
  scene.add(controller);
  state.pelvisBone.getWorldPosition(pivot.position);
  updatePelvisController();
}

function createControlRing(name) {
  const controller = new THREE.Mesh(
    new THREE.TorusGeometry(
      Math.max(CONTROL_RING_DIAMETER / 2 - CONTROL_RING_STROKE / 2, 0.001),
      CONTROL_RING_STROKE / 2,
      12,
      48,
    ),
    new THREE.MeshBasicMaterial({
      color: CONTROL_RING_COLOR,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    }),
  );
  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(CONTROL_RING_DIAMETER / 2 - CONTROL_RING_STROKE, 0.001), 48),
    new THREE.MeshBasicMaterial({
      color: CONTROL_RING_FILL_COLOR,
      depthTest: false,
      transparent: true,
      opacity: 0.72,
    }),
  );
  fill.name = `${name} fill`;
  fill.renderOrder = 10;
  fill.userData.controlHandleParent = controller;
  controller.name = name;
  controller.renderOrder = 11;
  controller.userData.fill = fill;
  controller.add(fill);
  return controller;
}

function createLimbControllers() {
  [
    { side: 'Left', end: /left(hand|wrist)$/i, root: /leftarm$/i, label: 'Left wrist', limbType: 'arm', role: 'leftWrist', parentRole: 'chest' },
    { side: 'Right', end: /right(hand|wrist)$/i, root: /rightarm$/i, label: 'Right wrist', limbType: 'arm', role: 'rightWrist', parentRole: 'chest' },
    { side: 'Left', end: /leftfoot$/i, root: /leftupleg$/i, label: 'Left foot', limbType: 'leg', role: 'leftFoot' },
    { side: 'Right', end: /rightfoot$/i, root: /rightupleg$/i, label: 'Right foot', limbType: 'leg', role: 'rightFoot' },
    { side: 'Left', end: /lefttoebase$/i, root: /leftfoot$/i, label: 'Left toe', limbType: 'toe', role: 'leftToe', parentRole: 'leftFoot' },
    { side: 'Right', end: /righttoebase$/i, root: /rightfoot$/i, label: 'Right toe', limbType: 'toe', role: 'rightToe', parentRole: 'rightFoot' },
  ].forEach((config) => {
    const endBone = state.bones.find((bone) => config.end.test(bone.name));
    const chain = endBone ? buildIkChain(endBone, config.root) : [];
    if (!endBone || chain.length === 0) return;

    const controller = createControlRing(`${config.label} controller`);
    controller.userData.controllerType = 'ik';
    controller.userData.targetBone = endBone;
    controller.userData.ikChain = chain;
    controller.userData.label = config.label;
    controller.userData.limbType = config.limbType;
    controller.userData.role = config.role;
    controller.userData.parentRole = config.parentRole;
    controller.userData.ikOptions = getIkOptionsForLimb(config.limbType);
    endBone.getWorldPosition(controller.position);
    state.controlHandles.push(controller);
    state.controlHandleByRole.set(config.role, controller);
    scene.add(controller);
  });
}

function createTorsoControllers() {
  [
    { end: /spine2|chest/i, root: /spine$/i, label: 'Chest', limbType: 'torso', role: 'chest', parentRole: 'hips' },
    { end: /headtop/i, root: /neck/i, label: 'Head top', limbType: 'head', role: 'headTop', parentRole: 'chest' },
  ].forEach((config) => {
    const endBone = state.bones.find((bone) => config.end.test(bone.name));
    const chain = endBone ? buildIkChain(endBone, config.root) : [];
    if (!endBone || chain.length === 0) return;

    const controller = createControlRing(`${config.label} controller`);
    controller.userData.controllerType = 'ik';
    controller.userData.targetBone = endBone;
    controller.userData.ikChain = chain;
    controller.userData.label = config.label;
    controller.userData.limbType = config.limbType;
    controller.userData.role = config.role;
    controller.userData.parentRole = config.parentRole;
    controller.userData.ikOptions = getIkOptionsForLimb(config.limbType);
    endBone.getWorldPosition(controller.position);
    state.controlHandles.push(controller);
    state.controlHandleByRole.set(config.role, controller);
    scene.add(controller);
  });
}

function getIkOptionsForLimb(limbType) {
  if (limbType === 'arm') {
    return { twoBone: true, iterations: 3, damping: 1, maxAngle: 0.75, poleStrength: 1, lockEndRotation: true };
  }
  if (limbType === 'leg') {
    return { twoBone: true, iterations: 4, damping: 1, maxAngle: 0.75, poleStrength: 1, lockEndRotation: true };
  }
  if (limbType === 'toe') {
    return { iterations: 6, damping: 0.34, maxAngle: 0.12, poleStrength: 0.35, lockEndRotation: true };
  }
  return { iterations: 8, damping: 0.38, maxAngle: 0.14, poleStrength: 0.55, lockEndRotation: false };
}

function createPoleVectorControllers() {
  [
    { role: 'leftElbowPole', parentRole: 'leftWrist', ikRole: 'leftWrist', bone: /leftforearm$/i, label: 'Left elbow pole', offset: new THREE.Vector3(0, 0, -0.5) },
    { role: 'rightElbowPole', parentRole: 'rightWrist', ikRole: 'rightWrist', bone: /rightforearm$/i, label: 'Right elbow pole', offset: new THREE.Vector3(0, 0, -0.5) },
    { role: 'leftKneePole', parentRole: 'leftFoot', ikRole: 'leftFoot', bone: /leftleg$/i, label: 'Left knee pole', offset: new THREE.Vector3(0, 0, 0.5) },
    { role: 'rightKneePole', parentRole: 'rightFoot', ikRole: 'rightFoot', bone: /rightleg$/i, label: 'Right knee pole', offset: new THREE.Vector3(0, 0, 0.5) },
  ].forEach((config) => {
    const anchorBone = state.bones.find((bone) => config.bone.test(bone.name));
    const ikHandle = state.controlHandleByRole.get(config.ikRole);
    if (!anchorBone || !ikHandle) return;

    const controller = createControlRing(`${config.label} controller`);
    controller.userData.controllerType = 'pole';
    controller.userData.role = config.role;
    controller.userData.parentRole = config.parentRole;
    controller.userData.ikRole = config.ikRole;
    controller.userData.label = config.label;
    controller.userData.poleAnchorPattern = config.bone;
    controller.visible = false;
    anchorBone.getWorldPosition(controller.position);
    controller.position.add(config.offset);
    ikHandle.userData.poleHandle = controller;
    state.controlHandles.push(controller);
    state.controlHandleByRole.set(config.role, controller);
    scene.add(controller);
  });
}

function buildIkChain(endBone, rootPattern) {
  const chain = [];
  let current = endBone.parent;
  while (current?.isBone) {
    chain.push(current);
    if (rootPattern.test(current.name)) break;
    current = current.parent;
  }
  return chain;
}

function updatePelvisController() {
  if (!state.pelvisController || !state.pelvisBone) return;
  updateControlHandleVisual(state.pelvisController, state.pelvisControlPivot.position);
}

function updateControlHandleVisual(handle, position) {
  const isSelected =
    state.selectedController === handle ||
    (handle.userData.controllerType === 'pelvis' && state.selectedController === state.pelvisControlPivot);
  const isEnabled = isHandleEnabledForCurrentMode(handle);
  handle.position.copy(position);
  handle.quaternion.copy(camera.quaternion);
  handle.material.color.setHex(
    isSelected ? CONTROL_RING_SELECTED_COLOR : isEnabled ? CONTROL_RING_COLOR : CONTROL_RING_DISABLED_COLOR,
  );
  handle.material.opacity = isSelected ? 1 : isEnabled ? 0.9 : 0.28;
  handle.userData.fill?.material.color.setHex(
    isSelected ? CONTROL_RING_SELECTED_FILL_COLOR : isEnabled ? CONTROL_RING_FILL_COLOR : CONTROL_RING_DISABLED_FILL_COLOR,
  );
  if (handle.userData.fill?.material) handle.userData.fill.material.opacity = isEnabled ? 0.72 : 0.16;
  handle.userData.interactive = isEnabled;
}

function isHandleEnabledForCurrentMode(handle) {
  if (state.currentTransformMode === 'rotation') {
    return handle.userData.controllerType === 'joint';
  }
  return canUsePositionIk(handle);
}

function updateLimbControllers() {
  state.controlHandles.forEach((handle) => {
    if (handle.userData.controllerType !== 'joint') return;
    const targetBone = handle.userData.targetBone;
    if (!targetBone) return;
    targetBone.getWorldPosition(handle.position);
    updateControlHandleVisual(handle, handle.position);
  });
}

function updateJointControllers() {
  state.controlHandles.forEach((handle) => {
    if (handle.userData.controllerType !== 'joint') return;
    const targetBone = handle.userData.targetBone;
    if (!targetBone) return;
    const ikTarget = state.currentTransformMode === 'position'
      ? state.positionIkTargets.get(handle.userData.semanticRole)
      : null;
    if (ikTarget) {
      updateControlHandleVisual(handle, ikTarget);
      return;
    }
    targetBone.getWorldPosition(handle.position);
    updateControlHandleVisual(handle, handle.position);
  });
}

function updateInactiveIkControllers() {
  state.controlHandles.forEach((handle) => {
    if (handle.userData.controllerType !== 'ik' && handle.userData.controllerType !== 'pole') return;
    if (handle.userData.controllerType === 'pole') {
      handle.visible = false;
      return;
    }
    updateControlHandleVisual(handle, handle.position);
  });
}

function applySelectedControllerRotation() {
  if (state.selectedController?.userData.controllerType !== 'pelvis') return;
  if (state.currentTransformMode !== 'rotation') return;
  if (!state.controllerPivotBeforeDrag || !state.controllerBoneBeforeDrag) return;
  const rotationDelta = state.selectedController.quaternion
    .clone()
    .multiply(state.controllerPivotBeforeDrag.clone().invert());
  state.selectedBone.quaternion.copy(rotationDelta.multiply(state.controllerBoneBeforeDrag));
}

function applySelectedControllerTranslation() {
  if (state.selectedController?.userData.controllerType !== 'pelvis') return;
  if (state.currentTransformMode !== 'position') return;
  if (!state.selectedBone?.parent) return;
  const plantedEndStates = capturePlantedEndStates();
  const constrainedPosition = constrainPelvisTargetPosition(state.selectedController.position);
  state.selectedController.position.copy(constrainedPosition);
  const localPosition = constrainedPosition.clone();
  state.selectedBone.parent.worldToLocal(localPosition);
  state.selectedBone.position.copy(localPosition);
  applyLegIkTargets(plantedEndStates);
}

function constrainPelvisTargetPosition(desiredPosition) {
  if (!state.pelvisBone) return desiredPosition.clone();
  const currentPelvisPosition = state.pelvisBone.getWorldPosition(new THREE.Vector3());
  const constrainedPosition = desiredPosition.clone();

  ['leftFoot', 'rightFoot'].forEach((role) => {
    const handle = state.controlHandleByRole.get(role);
    if (!handle?.userData?.ikChain || handle.userData.ikChain.length < 2) return;
    const upperBone = handle.userData.ikChain[1];
    const lowerBone = handle.userData.ikChain[0];
    const endBone = handle.userData.targetBone;
    const rootPosition = upperBone.getWorldPosition(new THREE.Vector3());
    const midPosition = lowerBone.getWorldPosition(new THREE.Vector3());
    const endPosition = endBone.getWorldPosition(new THREE.Vector3());
    const maxReach = Math.max(rootPosition.distanceTo(midPosition) + midPosition.distanceTo(endPosition) - 0.012, 0.05);
    const delta = constrainedPosition.clone().sub(currentPelvisPosition);
    const desiredRootPosition = rootPosition.clone().add(delta);
    const targetPosition = handle.position;
    const distance = desiredRootPosition.distanceTo(targetPosition);
    if (distance <= maxReach) return;

    const rootDirection = desiredRootPosition.clone().sub(targetPosition).normalize();
    const clampedRootPosition = targetPosition.clone().add(rootDirection.multiplyScalar(maxReach));
    const correction = clampedRootPosition.sub(desiredRootPosition);
    constrainedPosition.add(correction);
  });

  return constrainedPosition;
}

function applySelectedMoveController() {
  applySelectedControllerTranslation();
  applySelectedIkController();
  applySelectedPoleController();
  applyChildControlSolves(state.selectedController?.userData.role);
  syncRotationUi();
}

function getChildControls(parentRole) {
  return state.controlHandles.filter((handle) => handle.userData.parentRole === parentRole);
}

function moveChildControls(parentRole, offset) {
  getChildControls(parentRole).forEach((child) => {
    child.position.add(offset);
    moveChildControls(child.userData.role, offset);
  });
}

function applyChildControlSolves(parentRole) {
  getChildControls(parentRole).forEach((child) => {
    if (child.userData.controllerType === 'ik') {
      solveHandleIk(child);
    } else if (child.userData.controllerType === 'pole') {
      applyPoleHandleSolve(child);
    }
    applyChildControlSolves(child.userData.role);
  });
}

function applySelectedIkController() {
  if (state.selectedController?.userData.controllerType !== 'ik') return;
  solveHandleIk(state.selectedController);
}

function applySelectedPoleController() {
  if (state.selectedController?.userData.controllerType !== 'pole') return;
  applyPoleHandleSolve(state.selectedController);
}

function applyPoleHandleSolve(poleHandle) {
  const ikHandle = state.controlHandleByRole.get(poleHandle.userData.ikRole);
  if (!ikHandle) return;
  solveHandleIk(ikHandle, poleHandle.position.clone());
}

function capturePlantedEndStates() {
  const plantedRoles = ['leftFoot', 'rightFoot', 'leftToe', 'rightToe'];
  const states = new Map();
  plantedRoles.forEach((role) => {
    const handle = state.controlHandleByRole.get(role);
    if (!handle?.userData?.targetBone) return;
    states.set(role, {
      position: handle.position.clone(),
      worldQuaternion: handle.userData.targetBone.getWorldQuaternion(new THREE.Quaternion()),
    });
  });
  return states;
}

function applyLegIkTargets(plantedEndStates = null) {
  ['leftFoot', 'rightFoot'].forEach((role) => {
    const footHandle = state.controlHandleByRole.get(role);
    if (footHandle) solveHandleIk(footHandle, null, getPlantedIkOptions(plantedEndStates, role));
  });
  ['leftToe', 'rightToe'].forEach((role) => {
    const toeHandle = state.controlHandleByRole.get(role);
    if (toeHandle) solveHandleIk(toeHandle, null, getPlantedIkOptions(plantedEndStates, role));
  });
  ['leftFoot', 'rightFoot'].forEach((role) => {
    const footHandle = state.controlHandleByRole.get(role);
    if (footHandle) solveHandleIk(footHandle, null, getPlantedIkOptions(plantedEndStates, role));
  });
}

function getPlantedIkOptions(plantedEndStates, role) {
  const planted = plantedEndStates?.get(role);
  if (!planted) return null;
  return {
    targetPosition: planted.position,
    lockedEndWorldQuaternion: planted.worldQuaternion,
  };
}

function applyToeIkTargets() {
  state.controlHandles.forEach((handle) => {
    if (handle.userData.controllerType !== 'ik' || handle.userData.limbType !== 'toe') return;
    solveHandleIk(handle);
  });
}

function solveHandleIk(handle, overridePolePosition = null, overrideOptions = null) {
  if (!handle?.userData?.targetBone || !handle.userData.ikChain) return;
  solveIk(
    handle.userData.targetBone,
    handle.userData.ikChain,
    overrideOptions?.targetPosition || handle.position.clone(),
    overridePolePosition || handle.userData.poleHandle?.position,
    { ...handle.userData.ikOptions, ...overrideOptions },
  );
}

function syncControlsToBones() {
  const position = new THREE.Vector3();
  if (state.pelvisControlPivot && state.pelvisBone) {
    state.pelvisBone.getWorldPosition(state.pelvisControlPivot.position);
  }
  state.controlHandles.forEach((handle) => {
    if (handle.userData.controllerType === 'joint') {
      handle.userData.targetBone?.getWorldPosition(position);
      handle.position.copy(position);
      return;
    }
    if (handle.userData.controllerType !== 'ik') return;
    handle.userData.targetBone.getWorldPosition(position);
    handle.position.copy(position);
  });
  resetPoleVectorPositions();
}

function resetPoleVectorPositions() {
  state.controlHandles.forEach((handle) => {
    if (handle.userData.controllerType !== 'pole') return;
    const anchor = state.bones.find((bone) => handle.userData.poleAnchorPattern.test(bone.name));
    if (!anchor) return;
    anchor.getWorldPosition(handle.position);
    handle.position.z += handle.userData.ikRole.includes('Wrist') ? -0.5 : 0.5;
  });
}

function solveIk(endBone, chain, targetPosition, polePosition = null, options = {}) {
  if (!endBone || !chain?.length) return;
  const config = { ...IK_DEFAULT_OPTIONS, ...options };
  if (config.twoBone && chain.length >= 2) {
    solveTwoBoneIk(endBone, chain, targetPosition, polePosition, config);
    return;
  }
  const endPosition = new THREE.Vector3();
  const jointPosition = new THREE.Vector3();
  const toEnd = new THREE.Vector3();
  const toTarget = new THREE.Vector3();
  const boneWorldQuaternion = new THREE.Quaternion();
  const parentWorldQuaternion = new THREE.Quaternion();
  const newWorldQuaternion = new THREE.Quaternion();
  const lockedEndWorldQuaternion = new THREE.Quaternion();
  if (config.lockEndRotation) {
    lockedEndWorldQuaternion.copy(config.lockedEndWorldQuaternion || endBone.getWorldQuaternion(new THREE.Quaternion()));
  }

  for (let iteration = 0; iteration < config.iterations; iteration += 1) {
    for (const bone of chain) {
      bone.updateWorldMatrix(true, true);
      endBone.updateWorldMatrix(true, false);
      bone.getWorldPosition(jointPosition);
      endBone.getWorldPosition(endPosition);

      toEnd.copy(endPosition).sub(jointPosition);
      toTarget.copy(targetPosition).sub(jointPosition);
      if (toEnd.lengthSq() < 0.000001 || toTarget.lengthSq() < 0.000001) continue;

      toEnd.normalize();
      toTarget.normalize();
      const dot = THREE.MathUtils.clamp(toEnd.dot(toTarget), -1, 1);
      if (dot > 0.9995) continue;

      const angle = Math.min(Math.acos(dot) * config.damping, config.maxAngle);
      if (angle < 0.00001) continue;
      const axis = new THREE.Vector3().crossVectors(toEnd, toTarget);
      if (axis.lengthSq() < 0.000001) continue;
      axis.normalize();
      const deltaWorld = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      bone.getWorldQuaternion(boneWorldQuaternion);
      newWorldQuaternion.copy(deltaWorld).multiply(boneWorldQuaternion);

      if (bone.parent) {
        bone.parent.getWorldQuaternion(parentWorldQuaternion).invert();
        bone.quaternion.copy(parentWorldQuaternion.multiply(newWorldQuaternion));
      } else {
        bone.quaternion.copy(newWorldQuaternion);
      }
      bone.updateWorldMatrix(true, true);
    }
  }
  if (polePosition) applyPoleVector(endBone, chain, targetPosition, polePosition, config.poleStrength);
  if (config.lockEndRotation) setWorldQuaternion(endBone, lockedEndWorldQuaternion);
}

function solveTwoBoneIk(endBone, chain, targetPosition, polePosition, config) {
  const lowerBone = chain[0];
  const upperBone = chain[1];
  const rootPosition = new THREE.Vector3();
  const midPosition = new THREE.Vector3();
  const endPosition = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const poleDirection = new THREE.Vector3();
  const desiredMidPosition = new THREE.Vector3();
  const lockedEndWorldQuaternion = new THREE.Quaternion();

  if (config.lockEndRotation) {
    lockedEndWorldQuaternion.copy(config.lockedEndWorldQuaternion || endBone.getWorldQuaternion(new THREE.Quaternion()));
  }

  for (let iteration = 0; iteration < config.iterations; iteration += 1) {
    upperBone.updateWorldMatrix(true, true);
    lowerBone.updateWorldMatrix(true, true);
    endBone.updateWorldMatrix(true, false);
    upperBone.getWorldPosition(rootPosition);
    lowerBone.getWorldPosition(midPosition);
    endBone.getWorldPosition(endPosition);

    const upperLength = Math.max(rootPosition.distanceTo(midPosition), 0.0001);
    const lowerLength = Math.max(midPosition.distanceTo(endPosition), 0.0001);
    const targetDistance = THREE.MathUtils.clamp(
      rootPosition.distanceTo(targetPosition),
      0.0001,
      upperLength + lowerLength - 0.0001,
    );

    axis.copy(targetPosition).sub(rootPosition);
    if (axis.lengthSq() < 0.000001) return;
    axis.normalize();

    if (polePosition) {
      poleDirection.copy(polePosition).sub(rootPosition).projectOnPlane(axis);
    } else {
      poleDirection.copy(midPosition).sub(rootPosition).projectOnPlane(axis);
    }
    if (poleDirection.lengthSq() < 0.000001) {
      poleDirection.set(0, 0, 1).projectOnPlane(axis);
    }
    if (poleDirection.lengthSq() < 0.000001) {
      poleDirection.set(1, 0, 0).projectOnPlane(axis);
    }
    poleDirection.normalize();

    const along = THREE.MathUtils.clamp(
      (targetDistance * targetDistance + upperLength * upperLength - lowerLength * lowerLength) / (2 * targetDistance),
      0,
      upperLength,
    );
    const bendHeight = Math.sqrt(Math.max(upperLength * upperLength - along * along, 0));
    desiredMidPosition.copy(rootPosition)
      .addScaledVector(axis, along)
      .addScaledVector(poleDirection, bendHeight);

    rotateBoneTowardWorldPoint(upperBone, midPosition, desiredMidPosition, rootPosition, config);

    lowerBone.updateWorldMatrix(true, true);
    endBone.updateWorldMatrix(true, false);
    lowerBone.getWorldPosition(midPosition);
    endBone.getWorldPosition(endPosition);
    rotateBoneTowardWorldPoint(lowerBone, endPosition, targetPosition, midPosition, config);
  }

  if (config.lockEndRotation) setWorldQuaternion(endBone, lockedEndWorldQuaternion);
}

function rotateBoneTowardWorldPoint(bone, currentPoint, desiredPoint, pivotPoint, config) {
  const from = currentPoint.clone().sub(pivotPoint);
  const to = desiredPoint.clone().sub(pivotPoint);
  if (from.lengthSq() < 0.000001 || to.lengthSq() < 0.000001) return;
  from.normalize();
  to.normalize();
  const dot = THREE.MathUtils.clamp(from.dot(to), -1, 1);
  if (dot > 0.9999) return;
  const axis = new THREE.Vector3().crossVectors(from, to);
  if (axis.lengthSq() < 0.000001) return;
  axis.normalize();
  const angle = Math.min(Math.acos(dot) * config.damping, config.maxAngle);
  const deltaWorld = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const boneWorldQuaternion = bone.getWorldQuaternion(new THREE.Quaternion());
  setWorldQuaternion(bone, deltaWorld.multiply(boneWorldQuaternion));
}

function setWorldQuaternion(node, worldQuaternion) {
  const parentWorldQuaternion = new THREE.Quaternion();
  if (node.parent) {
    node.parent.getWorldQuaternion(parentWorldQuaternion).invert();
    node.quaternion.copy(parentWorldQuaternion.multiply(worldQuaternion));
  } else {
    node.quaternion.copy(worldQuaternion);
  }
  node.updateWorldMatrix(true, true);
}

function applyPoleVector(endBone, chain, targetPosition, polePosition, strength = 0.85) {
  if (chain.length < 2) return;
  const upperBone = chain[1];
  const midBone = chain[0];
  const rootPosition = new THREE.Vector3();
  const midPosition = new THREE.Vector3();
  const endPosition = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const currentPole = new THREE.Vector3();
  const desiredPole = new THREE.Vector3();
  const upperWorldQuaternion = new THREE.Quaternion();
  const parentWorldQuaternion = new THREE.Quaternion();
  const newWorldQuaternion = new THREE.Quaternion();

  upperBone.updateWorldMatrix(true, true);
  midBone.updateWorldMatrix(true, true);
  endBone.updateWorldMatrix(true, false);
  upperBone.getWorldPosition(rootPosition);
  midBone.getWorldPosition(midPosition);
  endBone.getWorldPosition(endPosition);

  axis.copy(targetPosition).sub(rootPosition);
  if (axis.lengthSq() < 0.000001) axis.copy(endPosition).sub(rootPosition);
  if (axis.lengthSq() < 0.000001) return;
  axis.normalize();

  currentPole.copy(midPosition).sub(rootPosition).projectOnPlane(axis);
  desiredPole.copy(polePosition).sub(rootPosition).projectOnPlane(axis);
  if (currentPole.lengthSq() < 0.000001 || desiredPole.lengthSq() < 0.000001) return;
  currentPole.normalize();
  desiredPole.normalize();

  let angle = currentPole.angleTo(desiredPole);
  const cross = new THREE.Vector3().crossVectors(currentPole, desiredPole);
  if (cross.dot(axis) < 0) angle *= -1;

  const deltaWorld = new THREE.Quaternion().setFromAxisAngle(axis, angle * strength);
  upperBone.getWorldQuaternion(upperWorldQuaternion);
  newWorldQuaternion.copy(deltaWorld).multiply(upperWorldQuaternion);

  if (upperBone.parent) {
    upperBone.parent.getWorldQuaternion(parentWorldQuaternion).invert();
    upperBone.quaternion.copy(parentWorldQuaternion.multiply(newWorldQuaternion));
  } else {
    upperBone.quaternion.copy(newWorldQuaternion);
  }
  upperBone.updateWorldMatrix(true, true);
}

function setTransformMode(mode) {
  const nextMode = mode === 'position' ? 'position' : 'rotation';
  state.requestedTransformMode = nextMode;
  state.currentTransformMode = nextMode;
  if (nextMode === 'position') {
    initializePositionIkTargets();
  } else {
    state.positionIkTargets.clear();
  }
  configureTransformControls();
  updateModeButtons();
  updateJointControllers();
  updatePelvisController();
}

function initializePositionIkTargets() {
  ['leftFoot', 'rightFoot'].forEach((role) => {
    const handle = state.controlHandleByRole.get(role);
    if (!handle) return;
    if (!state.positionIkTargets.has(role)) {
      state.positionIkTargets.set(role, handle.position.clone());
    }
  });
}

function effectiveTransformModeForSelection() {
  return state.requestedTransformMode;
}

function refreshTransformMode() {
  state.currentTransformMode = effectiveTransformModeForSelection();
  configureTransformControls();
  updateModeButtons();
  updateJointControllers();
  updatePelvisController();
}

function configureTransformControls() {
  const isPosition = state.currentTransformMode === 'position';
  const positionTarget = isPosition && canUsePositionIk(state.selectedController)
    ? state.selectedController
    : null;
  const rotationTarget = !isPosition ? state.selectedBone : null;
  const target = positionTarget || rotationTarget;

  transform.setMode(isPosition ? 'translate' : 'rotate');
  transform.setSpace(isPosition ? 'world' : 'local');
  if (target) {
    transform.attach(target);
  } else {
    transform.detach();
  }
  transform.enabled = Boolean(target);
  transform.visible = transform.enabled;
  transformHelper.visible = transform.enabled;
}

function applyTransformControllerTranslation() {
  const controller = state.selectedController;
  if (!canUsePositionIk(controller)) return;

  const role = controller.userData.semanticRole;
  const targetPosition = controller.position.clone();
  if (role === 'hips') {
    moveHipsWithAnchoredFeet(targetPosition);
    return;
  }
  if (role === 'leftFoot' || role === 'rightFoot') {
    state.positionIkTargets.set(role, targetPosition);
    solveLegToFootHandle(role);
  }
}

function updateModeButtons() {
  const isPosition = state.currentTransformMode === 'position';
  moveToolButton?.classList.toggle('active', isPosition);
  rotateToolButton?.classList.toggle('active', !isPosition);
  positionModeButton?.classList.toggle('active', isPosition);
  rotationModeButton?.classList.toggle('active', !isPosition);
  positionModeButton?.setAttribute('aria-pressed', String(isPosition));
  rotationModeButton?.setAttribute('aria-pressed', String(!isPosition));
}

function getScreenDragPoint(event, plane) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, point) ? point : null;
}

function startScreenDrag(event, controller) {
  selectController(controller);
  if (state.currentTransformMode === 'position' && !canUsePositionIk(controller)) {
    status.textContent = 'Position IK is only for hips and ankles';
    return false;
  }

  const normal = new THREE.Vector3();
  camera.getWorldDirection(normal);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, controller.position);
  const startPoint = getScreenDragPoint(event, plane);
  if (!startPoint) return false;

  state.screenDrag = {
    controller,
    plane,
    startPoint,
    startPosition: controller.position.clone(),
    startPose: clonePose(),
    lastClientX: event.clientX,
    lastClientY: event.clientY,
    changed: false,
  };
  orbit.enabled = false;
  renderer.domElement.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  return true;
}

function updateScreenDrag(event) {
  if (!state.screenDrag) return;
  if (state.currentTransformMode === 'position') {
    updatePositionIkDrag(event);
    return;
  }

  const dx = event.clientX - state.screenDrag.lastClientX;
  const dy = event.clientY - state.screenDrag.lastClientY;
  state.screenDrag.lastClientX = event.clientX;
  state.screenDrag.lastClientY = event.clientY;
  applyScreenRotationDrag(state.screenDrag.controller, dx, dy);
  state.screenDrag.changed = true;
  status.textContent = 'Pose changed';
}

function canUsePositionIk(controller) {
  return ['hips', 'leftFoot', 'rightFoot'].includes(controller?.userData?.semanticRole);
}

function updatePositionIkDrag(event) {
  const point = getScreenDragPoint(event, state.screenDrag.plane);
  if (!point) return;

  const controller = state.screenDrag.controller;
  const role = controller.userData.semanticRole;
  const offset = point.sub(state.screenDrag.startPoint);
  const targetPosition = state.screenDrag.startPosition.clone().add(offset);

  if (role === 'hips') {
    moveHipsWithAnchoredFeet(targetPosition);
  } else if (role === 'leftFoot' || role === 'rightFoot') {
    controller.position.copy(targetPosition);
    state.positionIkTargets.set(role, targetPosition.clone());
    solveLegToFootHandle(role);
  }

  state.screenDrag.changed = true;
  status.textContent = 'Pose changed';
}

function moveHipsWithAnchoredFeet(targetPosition) {
  if (!state.pelvisBone?.parent) return;
  const footAnchors = captureFootIkAnchors();
  const constrainedTarget = constrainHipsForFootAnchors(targetPosition, footAnchors);
  const localPosition = constrainedTarget.clone();
  state.pelvisBone.parent.worldToLocal(localPosition);
  state.pelvisBone.position.copy(localPosition);
  solveLegToFootHandle('leftFoot', footAnchors.leftFoot);
  solveLegToFootHandle('rightFoot', footAnchors.rightFoot);
}

function captureFootIkAnchors() {
  const anchors = {};
  ['leftFoot', 'rightFoot'].forEach((role) => {
    const handle = state.controlHandleByRole.get(role);
    const bone = handle?.userData?.targetBone;
    if (!handle || !bone) return;
    const target = state.positionIkTargets.get(role) || handle.position;
    anchors[role] = {
      position: target.clone(),
      worldQuaternion: bone.getWorldQuaternion(new THREE.Quaternion()),
    };
  });
  return anchors;
}

function constrainHipsForFootAnchors(targetPosition, anchors) {
  const currentHipsPosition = state.pelvisBone.getWorldPosition(new THREE.Vector3());
  const constrained = targetPosition.clone();
  ['leftFoot', 'rightFoot'].forEach((role) => {
    const handle = state.controlHandleByRole.get(role);
    const anchor = anchors[role];
    const chain = getLegChainForFootRole(role);
    if (!handle || !anchor || !chain) return;

    const rootPosition = chain.upper.getWorldPosition(new THREE.Vector3());
    const midPosition = chain.lower.getWorldPosition(new THREE.Vector3());
    const endPosition = chain.end.getWorldPosition(new THREE.Vector3());
    const maxReach = rootPosition.distanceTo(midPosition) + midPosition.distanceTo(endPosition) - 0.012;
    const desiredRoot = rootPosition.clone().add(constrained.clone().sub(currentHipsPosition));
    const distance = desiredRoot.distanceTo(anchor.position);
    if (distance <= maxReach) return;

    const direction = desiredRoot.clone().sub(anchor.position).normalize();
    const clampedRoot = anchor.position.clone().add(direction.multiplyScalar(maxReach));
    constrained.add(clampedRoot.sub(desiredRoot));
  });
  return constrained;
}

function applyScreenRotationDrag(controller, dx, dy) {
  const targetBone = controller?.userData?.targetBone;
  if (!targetBone) return;
  const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const cameraUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const sensitivity = 0.01;
  const yaw = new THREE.Quaternion().setFromAxisAngle(cameraUp, dx * sensitivity);
  const pitch = new THREE.Quaternion().setFromAxisAngle(cameraRight, dy * sensitivity);
  const boneWorldQuaternion = targetBone.getWorldQuaternion(new THREE.Quaternion());
  setWorldQuaternion(targetBone, yaw.multiply(pitch).multiply(boneWorldQuaternion));
  syncRotationUi();
}

function getLegChainForFootRole(role) {
  const footHandle = state.controlHandleByRole.get(role);
  const footBone = footHandle?.userData?.targetBone;
  if (!footBone) return null;
  const lowerPattern = role === 'leftFoot' ? /leftleg$/i : /rightleg$/i;
  const upperPattern = role === 'leftFoot' ? /leftupleg$/i : /rightupleg$/i;
  const lower = state.bones.find((bone) => lowerPattern.test(bone.name));
  const upper = state.bones.find((bone) => upperPattern.test(bone.name));
  if (!upper || !lower) return null;
  return { upper, lower, end: footBone };
}

function solveLegToFootHandle(role, anchorOverride = null) {
  const handle = state.controlHandleByRole.get(role);
  const chain = getLegChainForFootRole(role);
  if (!handle || !chain) return;

  const targetPosition = anchorOverride?.position || handle.position.clone();
  const lockedFootWorldQuaternion =
    anchorOverride?.worldQuaternion || chain.end.getWorldQuaternion(new THREE.Quaternion());
  const kneePoleOffset = role === 'leftFoot' ? new THREE.Vector3(0, 0, 0.5) : new THREE.Vector3(0, 0, 0.5);

  solveStableTwoJointIk(chain.upper, chain.lower, chain.end, targetPosition, kneePoleOffset);
  setWorldQuaternion(chain.end, lockedFootWorldQuaternion);
  if (anchorOverride) {
    handle.position.copy(anchorOverride.position);
  } else {
    chain.end.getWorldPosition(handle.position);
  }
}

function solveStableTwoJointIk(upperBone, lowerBone, endBone, targetPosition, poleOffset) {
  upperBone.updateWorldMatrix(true, true);
  lowerBone.updateWorldMatrix(true, true);
  endBone.updateWorldMatrix(true, false);

  const rootPosition = upperBone.getWorldPosition(new THREE.Vector3());
  const midPosition = lowerBone.getWorldPosition(new THREE.Vector3());
  const endPosition = endBone.getWorldPosition(new THREE.Vector3());
  const upperLength = Math.max(rootPosition.distanceTo(midPosition), 0.0001);
  const lowerLength = Math.max(midPosition.distanceTo(endPosition), 0.0001);
  const maxReach = upperLength + lowerLength - 0.0001;
  const minReach = Math.abs(upperLength - lowerLength) + 0.0001;

  const targetVector = targetPosition.clone().sub(rootPosition);
  const rawDistance = targetVector.length();
  if (rawDistance < 0.0001) return;
  const distance = THREE.MathUtils.clamp(rawDistance, minReach, maxReach);
  const axis = targetVector.normalize();

  const polePosition = midPosition.clone().add(poleOffset);
  const poleDirection = polePosition.sub(rootPosition).projectOnPlane(axis);
  if (poleDirection.lengthSq() < 0.000001) poleDirection.set(0, 0, 1).projectOnPlane(axis);
  if (poleDirection.lengthSq() < 0.000001) poleDirection.set(1, 0, 0).projectOnPlane(axis);
  poleDirection.normalize();

  const along = THREE.MathUtils.clamp(
    (distance * distance + upperLength * upperLength - lowerLength * lowerLength) / (2 * distance),
    0,
    upperLength,
  );
  const bendHeight = Math.sqrt(Math.max(upperLength * upperLength - along * along, 0));
  const desiredMidPosition = rootPosition.clone()
    .addScaledVector(axis, along)
    .addScaledVector(poleDirection, bendHeight);
  const desiredEndPosition = rootPosition.clone().addScaledVector(axis, distance);

  rotateBoneExactlyTowardWorldPoint(upperBone, midPosition, desiredMidPosition, rootPosition);

  lowerBone.updateWorldMatrix(true, true);
  endBone.updateWorldMatrix(true, false);
  const newMidPosition = lowerBone.getWorldPosition(new THREE.Vector3());
  const newEndPosition = endBone.getWorldPosition(new THREE.Vector3());
  rotateBoneExactlyTowardWorldPoint(lowerBone, newEndPosition, desiredEndPosition, newMidPosition);
}

function rotateBoneExactlyTowardWorldPoint(bone, currentPoint, desiredPoint, pivotPoint) {
  const from = currentPoint.clone().sub(pivotPoint);
  const to = desiredPoint.clone().sub(pivotPoint);
  if (from.lengthSq() < 0.000001 || to.lengthSq() < 0.000001) return;
  from.normalize();
  to.normalize();
  const dot = THREE.MathUtils.clamp(from.dot(to), -1, 1);
  if (dot > 0.999999) return;
  const axis = new THREE.Vector3().crossVectors(from, to);
  if (axis.lengthSq() < 0.000001) return;
  axis.normalize();
  const deltaWorld = new THREE.Quaternion().setFromAxisAngle(axis, Math.acos(dot));
  const boneWorldQuaternion = bone.getWorldQuaternion(new THREE.Quaternion());
  setWorldQuaternion(bone, deltaWorld.multiply(boneWorldQuaternion));
}

function finishScreenDrag(event) {
  if (!state.screenDrag) return;
  if (state.screenDrag.changed && !posesEqual(state.screenDrag.startPose, clonePose())) {
    pushUndo(state.screenDrag.startPose);
  }
  updateJointControllers();
  renderer.domElement.releasePointerCapture?.(event.pointerId);
  state.screenDrag = null;
  orbit.enabled = true;
}

function populateJointSelect() {
  jointSelect.replaceChildren(
    new Option('None selected', ''),
    ...state.bones.map((bone, index) => {
      const option = document.createElement('option');
      option.value = bone.uuid;
      option.textContent = bone.name || `Joint ${index + 1}`;
      return option;
    }),
  );
}

function selectBone(bone) {
  if (!bone) return;
  if (bone === state.pelvisBone && state.pelvisControlPivot) {
    selectController(state.pelvisControlPivot);
    return;
  }
  state.selectedController = null;
  state.selectedBone = bone;
  jointSelect.value = bone.uuid;
  transform.attach(bone);
  refreshTransformMode();
  state.jointHighlight.visible = true;
  state.selectedBoneLinks.visible = state.showSkeleton;
  updateJointHighlight();
  updatePelvisController();
  rebuildSelectedBoneLinks();
  syncRotationUi();
}

function selectController(controller) {
  const targetBone = controller?.userData.targetBone;
  if (!controller) return;
  state.selectedController = controller;
  state.selectedBone = targetBone || null;
  jointSelect.value = targetBone?.uuid || '';
  controller.quaternion.identity();
  if (targetBone) {
    transform.attach(targetBone);
  } else {
    transform.detach();
  }
  refreshTransformMode();
  if (state.jointHighlight) state.jointHighlight.visible = false;
  state.selectedBoneLinks.visible = state.showSkeleton && Boolean(targetBone);
  rebuildSelectedBoneLinks();
  updatePelvisController();
  syncRotationUi();
}

function deselectBone() {
  state.selectedController = null;
  state.selectedBone = null;
  jointSelect.value = '';
  transform.detach();
  transform.enabled = false;
  transform.visible = false;
  transformHelper.visible = false;
  if (state.jointHighlight) state.jointHighlight.visible = false;
  if (state.selectedBoneLinks) {
    state.selectedBoneLinks.visible = false;
    state.selectedBoneLinks.clear();
  }
  updatePelvisController();
  refreshTransformMode();
  ['x', 'y', 'z'].forEach((axis) => {
    rotationInputs[axis].value = 0;
    rotationOutputs[axis].textContent = '0°';
  });
}

function updateJointHighlight() {
  if (!state.selectedBone || !state.jointHighlight) return;
  state.selectedBone.getWorldPosition(state.jointHighlight.position);
  const cameraDistance = camera.position.distanceTo(state.jointHighlight.position);
  const scale = Math.max(0.035, cameraDistance * 0.018);
  state.jointHighlight.scale.setScalar(scale);
}

function rebuildSelectedBoneLinks() {
  if (!state.selectedBoneLinks || !state.selectedBone) return;
  state.selectedBoneLinks.clear();

  const linkedBones = [];
  state.selectedBone.children.forEach((child) => {
    if (child.isBone) linkedBones.push(child);
  });

  linkedBones.forEach((linkedBone) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const segment = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0xffc857,
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      }),
    );
    segment.userData.linkedBone = linkedBone;
    segment.renderOrder = 9;
    state.selectedBoneLinks.add(segment);
  });
}

function updateSelectedBoneLinks() {
  if (!state.selectedBone || !state.selectedBoneLinks || !state.showSkeleton) return;
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();

  state.selectedBone.getWorldPosition(start);
  state.selectedBoneLinks.children.forEach((segment) => {
    const linkedBone = segment.userData.linkedBone;
    if (!linkedBone) return;

    linkedBone.getWorldPosition(end);
    const positions = segment.geometry.attributes.position;
    positions.setXYZ(0, start.x, start.y, start.z);
    positions.setXYZ(1, end.x, end.y, end.z);
    positions.needsUpdate = true;
    segment.geometry.computeBoundingSphere();
  });
}

function syncRotationUi() {
  if (!state.selectedBone) return;
  ['x', 'y', 'z'].forEach((axis) => {
    const value = Math.round(state.selectedBone.rotation[axis] * RAD_TO_DEG);
    rotationInputs[axis].value = value;
    rotationOutputs[axis].textContent = `${value}°`;
  });
}

function applyRotation(axis, degrees) {
  if (!state.selectedBone) return;
  const value = Number(degrees);
  state.selectedBone.rotation[axis] = value * DEG_TO_RAD;
  rotationOutputs[axis].textContent = `${value}°`;
}

function clonePose() {
  return state.bones.map((bone) => ({
    uuid: bone.uuid,
    name: bone.name,
    rotation: [bone.rotation.x, bone.rotation.y, bone.rotation.z],
    position: [bone.position.x, bone.position.y, bone.position.z],
  }));
}

function applyPoseSnapshot(pose) {
  pose.forEach((entry) => {
    const bone = state.bones.find((candidate) => candidate.uuid === entry.uuid || candidate.name === entry.name);
    if (bone) {
      bone.rotation.fromArray(entry.rotation);
      if (entry.position) bone.position.fromArray(entry.position);
    }
  });
  syncControlsToBones();
  syncRotationUi();
}

function posesEqual(first, second) {
  if (!first || !second || first.length !== second.length) return false;
  return first.every((entry, index) => {
    const other = second[index];
    if (!other || entry.uuid !== other.uuid) return false;
    const sameRotation = entry.rotation.every((value, axisIndex) => Math.abs(value - other.rotation[axisIndex]) < 0.000001);
    const samePosition = (entry.position || []).every((value, axisIndex) => Math.abs(value - other.position[axisIndex]) < 0.000001);
    return sameRotation && samePosition;
  });
}

function pushUndo(pose) {
  if (!pose || !pose.length) return;
  state.undoStack.push(pose);
  if (state.undoStack.length > 80) state.undoStack.shift();
  updateUndoButton();
}

function updateUndoButton() {
  undoPoseButton.disabled = state.undoStack.length === 0;
}

function undoPoseChange() {
  const pose = state.undoStack.pop();
  if (!pose) return;
  state.sliderPoseBeforeChange = null;
  state.sliderChanging = false;
  state.transformPoseBeforeDrag = null;
  state.transformChanged = false;
  state.controllerBonePositionBeforeDrag = null;
  applyPoseSnapshot(pose);
  updateUndoButton();
  status.textContent = 'Pose change undone';
}

function restoreBasePose({ label = 'Pose reset', clearHistory = false } = {}) {
  state.bones.forEach((bone) => {
    const base = state.basePose.get(bone.uuid);
    if (base) {
      bone.rotation.set(base.x, base.y, base.z);
      bone.position.set(base.px, base.py, base.pz);
    }
  });
  syncControlsToBones();
  deselectBone();
  if (clearHistory) {
    state.undoStack = [];
    updateUndoButton();
  }
  syncRotationUi();
  status.textContent = label;
}

function serializePose() {
  const pose = {};
  state.bones.forEach((bone) => {
    pose[bone.uuid] = {
      name: bone.name,
      rotation: [bone.rotation.x, bone.rotation.y, bone.rotation.z],
      position: [bone.position.x, bone.position.y, bone.position.z],
    };
  });
  return pose;
}

function setMeshVisible(visible) {
  state.showMesh = visible;
  state.model?.traverse((node) => {
    if (node.isMesh) node.visible = visible;
  });
}

function isDescendantOf(node, ancestor) {
  let current = node;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function isVisibleForRaycast(node) {
  let current = node;
  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function getPaintableMeshes() {
  const meshes = [];
  [state.model, state.baseplate].forEach((root) => {
    if (!root || !isVisibleForRaycast(root)) return;
    root.traverse((node) => {
      if (node.isMesh && node.material && isVisibleForRaycast(node)) {
        if (node.isSkinnedMesh) {
          node.computeBoundingBox();
          node.computeBoundingSphere();
        }
        meshes.push(node);
      }
    });
  });
  return meshes;
}

function clonePaintedMaterial(material, color) {
  const painted = material.clone();
  if (painted.color) painted.color.set(color);
  painted.needsUpdate = true;
  return painted;
}

function paintMesh(mesh, color) {
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((material) => clonePaintedMaterial(material, color));
  } else {
    mesh.material = clonePaintedMaterial(mesh.material, color);
  }
}

function paintObjectRoot(root, color) {
  root.traverse((node) => {
    if (node.isMesh && node.material) paintMesh(node, color);
  });
}

function selectPaintColor(button) {
  state.selectedPaintColor = button.dataset.paintColor;
  state.selectedPaintLabel = button.dataset.paintLabel || 'Color';
  colorSwatches.forEach((swatch) => swatch.classList.toggle('active', swatch === button));
  status.textContent = `${state.selectedPaintLabel} selected`;
}

function setColorPaletteVisible(visible) {
  state.showColorPalette = visible;
  colorPalette?.classList.toggle('hidden', !visible);
  paintToggle?.classList.toggle('active', visible);
  paintToggle?.setAttribute('aria-pressed', String(visible));
}

function paintObjectAtPointer() {
  if (!state.showColorPalette) return false;

  const hits = raycaster.intersectObjects(getPaintableMeshes(), true);
  if (!hits.length) return false;

  const hitMesh = hits[0].object;
  const isCharacterPart = state.model && isDescendantOf(hitMesh, state.model);

  if (isCharacterPart) {
    paintMesh(hitMesh, state.selectedPaintColor);
  } else if (state.baseplate && isDescendantOf(hitMesh, state.baseplate)) {
    paintObjectRoot(state.baseplate, state.selectedPaintColor);
  } else {
    return false;
  }

  const targetLabel = isCharacterPart ? (hitMesh.name || 'character part') : 'baseplate';
  status.textContent = `${state.selectedPaintLabel} applied to ${targetLabel}`;
  return true;
}

function toggleButton(button, active) {
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
}

document.querySelector('#meshToggle').addEventListener('click', (event) => {
  setMeshVisible(!state.showMesh);
  toggleButton(event.currentTarget, state.showMesh);
});

document.querySelector('#skeletonToggle').addEventListener('click', (event) => {
  state.showSkeleton = !state.showSkeleton;
  if (state.skeletonHelper) state.skeletonHelper.visible = state.showSkeleton;
  if (state.selectedBoneLinks) state.selectedBoneLinks.visible = state.showSkeleton && Boolean(state.selectedBone);
  toggleButton(event.currentTarget, state.showSkeleton);
});

document.querySelector('#gridToggle').addEventListener('click', (event) => {
  state.showGrid = !state.showGrid;
  if (state.grid) state.grid.visible = state.showGrid;
  toggleButton(event.currentTarget, state.showGrid);
});

baseplateToggle?.addEventListener('click', (event) => {
  state.showBaseplate = !state.showBaseplate;
  if (state.baseplate) state.baseplate.visible = state.showBaseplate;
  toggleButton(event.currentTarget, state.showBaseplate);
});

paintToggle?.addEventListener('click', () => {
  setColorPaletteVisible(!state.showColorPalette);
});

colorSwatches.forEach((button) => {
  button.addEventListener('click', () => selectPaintColor(button));
});

moveToolButton.addEventListener('click', () => setTransformMode('position'));
rotateToolButton.addEventListener('click', () => setTransformMode('rotation'));
positionModeButton?.addEventListener('click', () => setTransformMode('position'));
rotationModeButton?.addEventListener('click', () => setTransformMode('rotation'));

jointSelect.addEventListener('change', () => {
  if (!jointSelect.value) {
    deselectBone();
    return;
  }
  selectBone(state.bones.find((bone) => bone.uuid === jointSelect.value));
});

Object.entries(rotationInputs).forEach(([axis, input]) => {
  const finishSliderChange = () => {
    if (!state.sliderChanging) return;
    state.sliderPoseBeforeChange = null;
    state.sliderChanging = false;
  };

  input.addEventListener('input', () => {
    if (!state.sliderChanging) {
      state.sliderPoseBeforeChange = clonePose();
      pushUndo(state.sliderPoseBeforeChange);
      state.sliderChanging = true;
    }
    applyRotation(axis, input.value);
    status.textContent = 'Pose changed';
  });

  input.addEventListener('change', finishSliderChange);
  input.addEventListener('pointerup', finishSliderChange);
  input.addEventListener('pointercancel', finishSliderChange);
});

undoPoseButton.addEventListener('click', undoPoseChange);

document.querySelector('#newPose').addEventListener('click', () => {
  restoreBasePose({ label: 'New pose', clearHistory: true });
});

document.querySelector('#savePose').addEventListener('click', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializePose()));
  loadPoseButton.disabled = false;
  status.textContent = 'Pose saved';
});

loadPoseButton.addEventListener('click', () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  const pose = JSON.parse(raw);
  state.bones.forEach((bone) => {
    const saved = pose[bone.uuid] || Object.values(pose).find((entry) => entry.name === bone.name);
    if (saved?.rotation) bone.rotation.fromArray(saved.rotation);
    if (saved?.position) bone.position.fromArray(saved.position);
  });
  syncControlsToBones();
  syncRotationUi();
  status.textContent = 'Pose loaded';
});

document.querySelector('#resetPose').addEventListener('click', () => {
  restoreBasePose({ label: 'Pose reset' });
});

window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undoPoseChange();
    return;
  }

  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if (event.key.toLowerCase() === 'w') {
    setTransformMode('position');
  }
  if (event.key.toLowerCase() === 'e') {
    setTransformMode('rotation');
  }
});

document.querySelectorAll('[data-viewport]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-viewport]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    stageWrap.className = `stageWrap ${viewportClasses[button.dataset.viewport]}`;
    requestAnimationFrame(resize);
  });
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!state.bones.length || transform.dragging || state.transformPointerActive) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  if (paintObjectAtPointer()) return;

  const hittableHandles = state.controlHandles.filter((handle) => handle.visible && isHandleEnabledForCurrentMode(handle));
  const controllerHits = raycaster.intersectObjects(hittableHandles, true);
  if (controllerHits.length > 0) {
    const handle = controllerHits[0].object.userData.controlHandleParent || controllerHits[0].object;
    if (handle.userData.controllerType === 'pelvis') {
      if (startScreenDrag(event, state.pelvisControlPivot)) return;
      return;
    }
    if (startScreenDrag(event, handle)) return;
    return;
  }

  deselectBone();
});

renderer.domElement.addEventListener('pointermove', (event) => {
  updateScreenDrag(event);
});

renderer.domElement.addEventListener('pointerup', (event) => {
  finishScreenDrag(event);
});

renderer.domElement.addEventListener('pointercancel', (event) => {
  finishScreenDrag(event);
});

function resize() {
  const { clientWidth, clientHeight } = viewer;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / Math.max(clientHeight, 1);
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  resize();
  updatePelvisController();
  updateLimbControllers();
  updateJointHighlight();
  updateSelectedBoneLinks();
  orbit.update();
  renderer.render(scene, camera);
}

animate();
