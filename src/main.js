import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const MODEL_URL = '/public/stickman_default.glb';
const STORAGE_KEY = 'stickperson-poser.savedPose.v1';
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const CONTROL_RING_DIAMETER = 0.036;
const CONTROL_RING_STROKE = 0.006;
const CONTROL_RING_COLOR = 0xd4741f;
const CONTROL_RING_FILL_COLOR = 0xf4d1ad;
const CONTROL_RING_SELECTED_COLOR = 0xffc857;
const CONTROL_RING_SELECTED_FILL_COLOR = 0xffeebc;
const stickmanMaterial = new THREE.MeshStandardMaterial({
  color: 0xf0f3f8,
  roughness: 0.74,
  metalness: 0.02,
});

const viewer = document.querySelector('#viewer');
const stageWrap = document.querySelector('#stageWrap');
const loading = document.querySelector('#loading');
const status = document.querySelector('#status');
const jointSelect = document.querySelector('#jointSelect');
const moveToolButton = document.querySelector('#moveTool');
const rotateToolButton = document.querySelector('#rotateTool');
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
  skeletonHelper: null,
  grid: null,
  jointHighlight: null,
  pelvisBone: null,
  pelvisController: null,
  pelvisControlPivot: null,
  controlHandles: [],
  controlHandleByRole: new Map(),
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
  requestedTransformMode: 'translate',
  currentTransformMode: 'translate',
  showMesh: true,
  showSkeleton: false,
  showGrid: true,
};

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
camera.position.set(1.5, 1.2, 2.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewer.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xd7efff, 0x6f86aa, 1.35));

const keyLight = new THREE.DirectionalLight(0xfffbf2, 1.55);
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

const rimLight = new THREE.DirectionalLight(0x9fc8f5, 0.58);
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
transform.setMode('translate');
transform.setSpace('local');
transform.setSize(0.475);
transform.enabled = false;
transform.visible = false;
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
  applySelectedControllerRotation();
  applySelectedControllerTranslation();
  applySelectedIkController();
  syncRotationUi();
});
scene.add(transform.getHelper());

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
        node.material = stickmanMaterial;
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
    createPelvisController();
    createLimbControllers();
    createTorsoControllers();
    createPoleVectorControllers();

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
    status.textContent = 'Could not load stickman_default.glb';
    loading.textContent = 'Load failed';
  },
);

function collectBones(root) {
  const bones = [];
  root.traverse((node) => {
    if (node.isBone) bones.push(node);
  });
  return bones;
}

function findPelvisBone(bones) {
  return bones.find((bone) => /hips|pelvis/i.test(bone.name)) || bones[0] || null;
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
    endBone.getWorldPosition(controller.position);
    state.controlHandles.push(controller);
    state.controlHandleByRole.set(config.role, controller);
    scene.add(controller);
  });
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
  handle.position.copy(position);
  handle.quaternion.copy(camera.quaternion);
  handle.material.color.setHex(isSelected ? CONTROL_RING_SELECTED_COLOR : CONTROL_RING_COLOR);
  handle.material.opacity = isSelected ? 1 : 0.9;
  handle.userData.fill?.material.color.setHex(isSelected ? CONTROL_RING_SELECTED_FILL_COLOR : CONTROL_RING_FILL_COLOR);
}

function updateLimbControllers() {
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
  if (state.currentTransformMode !== 'rotate') return;
  if (!state.controllerPivotBeforeDrag || !state.controllerBoneBeforeDrag) return;
  const rotationDelta = state.selectedController.quaternion
    .clone()
    .multiply(state.controllerPivotBeforeDrag.clone().invert());
  state.selectedBone.quaternion.copy(rotationDelta.multiply(state.controllerBoneBeforeDrag));
}

function applySelectedControllerTranslation() {
  if (state.selectedController?.userData.controllerType !== 'pelvis') return;
  if (state.currentTransformMode !== 'translate') return;
  if (!state.selectedBone?.parent) return;
  const localPosition = state.selectedController.position.clone();
  state.selectedBone.parent.worldToLocal(localPosition);
  state.selectedBone.position.copy(localPosition);
  applyLegIkTargets();
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
      solveIk(child.userData.targetBone, child.userData.ikChain, child.position.clone(), child.userData.poleHandle?.position);
    } else if (child.userData.controllerType === 'pole') {
      applyPoleHandleSolve(child);
    }
    applyChildControlSolves(child.userData.role);
  });
}

function applySelectedIkController() {
  if (state.selectedController?.userData.controllerType !== 'ik') return;
  solveIk(
    state.selectedController.userData.targetBone,
    state.selectedController.userData.ikChain,
    state.selectedController.position,
    state.selectedController.userData.poleHandle?.position,
  );
}

function applySelectedPoleController() {
  if (state.selectedController?.userData.controllerType !== 'pole') return;
  applyPoleHandleSolve(state.selectedController);
}

function applyPoleHandleSolve(poleHandle) {
  const ikHandle = state.controlHandleByRole.get(poleHandle.userData.ikRole);
  if (!ikHandle) return;
  solveIk(ikHandle.userData.targetBone, ikHandle.userData.ikChain, ikHandle.position.clone(), poleHandle.position.clone());
}

function applyLegIkTargets() {
  state.controlHandles.forEach((handle) => {
    if (handle.userData.controllerType !== 'ik' || handle.userData.limbType !== 'leg') return;
    solveIk(handle.userData.targetBone, handle.userData.ikChain, handle.position.clone(), handle.userData.poleHandle?.position);
  });
  applyToeIkTargets();
}

function applyToeIkTargets() {
  state.controlHandles.forEach((handle) => {
    if (handle.userData.controllerType !== 'ik' || handle.userData.limbType !== 'toe') return;
    solveIk(handle.userData.targetBone, handle.userData.ikChain, handle.position.clone(), handle.userData.poleHandle?.position);
  });
}

function syncControlsToBones() {
  const position = new THREE.Vector3();
  if (state.pelvisControlPivot && state.pelvisBone) {
    state.pelvisBone.getWorldPosition(state.pelvisControlPivot.position);
  }
  state.controlHandles.forEach((handle) => {
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

function solveIk(endBone, chain, targetPosition, polePosition = null) {
  if (!endBone || !chain?.length) return;
  const endPosition = new THREE.Vector3();
  const jointPosition = new THREE.Vector3();
  const toEnd = new THREE.Vector3();
  const toTarget = new THREE.Vector3();
  const boneWorldQuaternion = new THREE.Quaternion();
  const parentWorldQuaternion = new THREE.Quaternion();
  const newWorldQuaternion = new THREE.Quaternion();

  for (let iteration = 0; iteration < 8; iteration += 1) {
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

      const deltaWorld = new THREE.Quaternion().setFromUnitVectors(toEnd, toTarget);
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
  if (polePosition) applyPoleVector(endBone, chain, targetPosition, polePosition);
}

function applyPoleVector(endBone, chain, targetPosition, polePosition) {
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

  const deltaWorld = new THREE.Quaternion().setFromAxisAngle(axis, angle * 0.85);
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
  state.requestedTransformMode = 'translate';
  state.currentTransformMode = 'translate';
  transform.setMode('translate');
  transform.enabled = false;
  transform.visible = false;
  moveToolButton.classList.add('active');
  rotateToolButton.classList.remove('active');
}

function effectiveTransformModeForSelection() {
  return 'translate';
}

function refreshTransformMode() {
  state.currentTransformMode = effectiveTransformModeForSelection();
  transform.setMode('translate');
  transform.enabled = false;
  transform.visible = false;
  moveToolButton.classList.add('active');
  rotateToolButton.classList.remove('active');
  moveToolButton.disabled = !state.selectedController;
  rotateToolButton.disabled = true;
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
  if (state.currentTransformMode !== 'translate') return false;

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
    changed: false,
  };
  orbit.enabled = false;
  renderer.domElement.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  return true;
}

function updateScreenDrag(event) {
  if (!state.screenDrag) return;
  const point = getScreenDragPoint(event, state.screenDrag.plane);
  if (!point) return;
  const offset = point.sub(state.screenDrag.startPoint);
  const previousPosition = state.screenDrag.controller.position.clone();
  state.screenDrag.controller.position.copy(state.screenDrag.startPosition).add(offset);
  const frameOffset = state.screenDrag.controller.position.clone().sub(previousPosition);
  moveChildControls(state.screenDrag.controller.userData.role, frameOffset);
  state.selectedController = state.screenDrag.controller;
  state.selectedBone = state.screenDrag.controller.userData.targetBone;
  applySelectedMoveController();
  state.screenDrag.changed = true;
  status.textContent = 'Pose changed';
}

function finishScreenDrag(event) {
  if (!state.screenDrag) return;
  if (state.screenDrag.changed && !posesEqual(state.screenDrag.startPose, clonePose())) {
    pushUndo(state.screenDrag.startPose);
  }
  if (state.screenDrag.controller.userData.controllerType === 'ik') {
    state.screenDrag.controller.userData.targetBone.getWorldPosition(state.screenDrag.controller.position);
  }
  updatePelvisController();
  updateLimbControllers();
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
  transform.detach();
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
  transform.detach();
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

moveToolButton.addEventListener('click', () => setTransformMode('translate'));
rotateToolButton.addEventListener('click', () => setTransformMode('translate'));

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
    setTransformMode('translate');
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

  const controllerHits = raycaster.intersectObjects(state.controlHandles.filter((handle) => handle.visible), true);
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
