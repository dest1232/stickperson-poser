import SceneKit
import UIKit
import simd

@MainActor
final class PoseSceneController {
    weak var viewModel: SceneViewModel?

    private weak var scnView: SCNView?
    private let scene = SCNScene()
    private let cameraNode = SCNNode()
    private let cameraTarget = SCNVector3(0, 0.8, 0)
    private var cameraDistance: Float = 2.8
    private var cameraYaw: Float = 0.48
    private var cameraPitch: Float = -0.18

    private var modelRoot: SCNNode?
    private var skeletonNode: SCNNode?
    private var gridNode: SCNNode?
    private var bones: [String: SCNNode] = [:]
    private var basePose: PoseSnapshot?
    private var handles: [RigHandleRole: RigHandle] = [:]
    private var selectedHandle: RigHandle?
    private var undoStack: [PoseSnapshot] = []

    private var dragPlanePoint = SCNVector3Zero
    private var dragPlaneNormal = SCNVector3Zero
    private var dragStartWorld = SCNVector3Zero
    private var dragStartHandle = SCNVector3Zero
    private var dragStartPose: PoseSnapshot?
    private var isDraggingHandle = false

    func install(in view: SCNView) {
        scnView = view
        view.scene = scene
        setupScene()
        loadModel()
    }

    func setMeshVisible(_ visible: Bool) {
        modelRoot?.enumerateChildNodes { node, _ in
            if node.geometry != nil, node.name != "ControlHandle" {
                node.isHidden = !visible
            }
        }
    }

    func setSkeletonVisible(_ visible: Bool) {
        skeletonNode?.isHidden = !visible
    }

    func setGridVisible(_ visible: Bool) {
        gridNode?.isHidden = !visible
    }

    func newPose() {
        restoreBasePose(label: "New pose", clearHistory: true)
    }

    func resetPose() {
        restoreBasePose(label: "Pose reset", clearHistory: false)
    }

    func undo() {
        guard let snapshot = undoStack.popLast() else { return }
        apply(snapshot)
        viewModel?.refreshUndoState(!undoStack.isEmpty)
        viewModel?.setStatus("Pose change undone")
    }

    func savePose() {
        do {
            try PoseStore.save(snapshot())
            viewModel?.refreshLoadState()
            viewModel?.setStatus("Pose saved")
        } catch {
            viewModel?.setStatus("Could not save pose")
        }
    }

    func loadPose() {
        do {
            let loaded = try PoseStore.load()
            apply(loaded)
            viewModel?.setStatus("Pose loaded")
        } catch {
            viewModel?.setStatus("Could not load pose")
        }
    }

    func handleSingleFingerPan(_ gesture: UIPanGestureRecognizer) {
        guard let view = scnView else { return }
        let location = gesture.location(in: view)

        switch gesture.state {
        case .began:
            guard let handle = hitHandle(at: location, in: view) else { return }
            selectedHandle = handle
            setHandleSelection(handle.role)
            dragStartPose = snapshot()
            dragStartHandle = handle.node.presentation.worldPosition
            dragPlanePoint = dragStartHandle
            dragPlaneNormal = cameraForward()
            guard let world = worldPoint(for: location, in: view) else { return }
            dragStartWorld = world
            isDraggingHandle = true
        case .changed:
            guard isDraggingHandle, let selectedHandle, let world = worldPoint(for: location, in: view) else { return }
            let offset = world - dragStartWorld
            let previous = selectedHandle.node.position
            selectedHandle.node.position = dragStartHandle + offset
            moveChildHandles(of: selectedHandle.role, by: selectedHandle.node.position - previous)
            apply(handle: selectedHandle)
            applyChildSolves(of: selectedHandle.role)
            viewModel?.setStatus("Pose changed")
        case .ended, .cancelled, .failed:
            if let dragStartPose, !posesEqual(dragStartPose, snapshot()) {
                undoStack.append(dragStartPose)
                viewModel?.refreshUndoState(true)
            }
            isDraggingHandle = false
            self.dragStartPose = nil
        default:
            break
        }
    }

    func handleOrbitPan(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: gesture.view)
        cameraYaw -= Float(translation.x) * 0.006
        cameraPitch = max(-1.1, min(0.7, cameraPitch - Float(translation.y) * 0.006))
        gesture.setTranslation(.zero, in: gesture.view)
        updateCamera()
    }

    func handlePinch(_ gesture: UIPinchGestureRecognizer) {
        cameraDistance = max(1.2, min(6, cameraDistance / Float(gesture.scale)))
        gesture.scale = 1
        updateCamera()
    }

    private func setupScene() {
        scene.background.contents = UIColor.clear

        cameraNode.camera = SCNCamera()
        cameraNode.camera?.fieldOfView = 45
        scene.rootNode.addChildNode(cameraNode)
        updateCamera()

        let ambient = SCNLight()
        ambient.type = .ambient
        ambient.color = UIColor(red: 0.66, green: 0.78, blue: 0.9, alpha: 1)
        ambient.intensity = 420
        let ambientNode = SCNNode()
        ambientNode.light = ambient
        scene.rootNode.addChildNode(ambientNode)

        let key = SCNLight()
        key.type = .directional
        key.color = UIColor(red: 1, green: 0.98, blue: 0.93, alpha: 1)
        key.intensity = 760
        key.castsShadow = true
        let keyNode = SCNNode()
        keyNode.light = key
        keyNode.eulerAngles = SCNVector3(-0.85, -0.55, 0)
        scene.rootNode.addChildNode(keyNode)

        let rim = SCNLight()
        rim.type = .directional
        rim.color = UIColor(red: 0.62, green: 0.78, blue: 0.96, alpha: 1)
        rim.intensity = 260
        let rimNode = SCNNode()
        rimNode.light = rim
        rimNode.eulerAngles = SCNVector3(-0.2, 2.35, 0)
        scene.rootNode.addChildNode(rimNode)

        createGrid()
    }

    private func loadModel() {
        guard let url = Bundle.main.url(forResource: "stickman_default", withExtension: "usdz"),
              let loadedScene = try? SCNScene(url: url) else {
            viewModel?.setStatus("Missing or invalid stickman_default.usdz")
            return
        }

        let root = SCNNode()
        loadedScene.rootNode.childNodes.forEach { root.addChildNode($0) }
        root.scale = SCNVector3(1, 1, 1)
        scene.rootNode.addChildNode(root)
        modelRoot = root

        collectBones(from: root)
        applyWhiteMaterial(to: root)
        skeletonNode = makeSkeletonNode()
        if let skeletonNode {
            skeletonNode.isHidden = true
            scene.rootNode.addChildNode(skeletonNode)
        }

        createHandles()
        basePose = snapshot()
        viewModel?.setStatus("\(bones.count) joints ready")
    }

    private func applyWhiteMaterial(to root: SCNNode) {
        let material = SCNMaterial()
        material.diffuse.contents = UIColor(red: 0.94, green: 0.95, blue: 0.98, alpha: 1)
        material.roughness.contents = 0.74
        material.metalness.contents = 0.02
        root.enumerateChildNodes { node, _ in
            if node.geometry != nil {
                node.geometry?.materials = [material]
                node.castsShadow = true
            }
        }
    }

    private func collectBones(from root: SCNNode) {
        bones.removeAll()
        root.enumerateChildNodes { node, _ in
            if let name = node.name, name.lowercased().contains("mixamorig") {
                bones[name] = node
            }
        }
    }

    private func createHandles() {
        guard let hips = bone(matching: "mixamorigHips") else { return }
        let hipsHandle = makeHandle(role: .hips, kind: .pelvis, targetBone: hips, parent: nil, hidden: false)
        handles[.hips] = hipsHandle

        createIKHandle(.chest, target: "mixamorigSpine2", root: "mixamorigSpine", parent: .hips)
        createIKHandle(.headTop, target: "mixamorigHeadTop_End", root: "mixamorigNeck", parent: .chest)
        createIKHandle(.leftWrist, target: "mixamorigLeftHand", root: "mixamorigLeftArm", parent: .chest, pole: .leftElbowPole)
        createIKHandle(.rightWrist, target: "mixamorigRightHand", root: "mixamorigRightArm", parent: .chest, pole: .rightElbowPole)
        createIKHandle(.leftFoot, target: "mixamorigLeftFoot", root: "mixamorigLeftUpLeg", parent: nil, pole: .leftKneePole)
        createIKHandle(.rightFoot, target: "mixamorigRightFoot", root: "mixamorigRightUpLeg", parent: nil, pole: .rightKneePole)
        createIKHandle(.leftToe, target: "mixamorigLeftToeBase", root: "mixamorigLeftFoot", parent: .leftFoot)
        createIKHandle(.rightToe, target: "mixamorigRightToeBase", root: "mixamorigRightFoot", parent: .rightFoot)

        createPole(.leftElbowPole, anchor: "mixamorigLeftForeArm", parent: .leftWrist, ik: .leftWrist, zOffset: -0.5)
        createPole(.rightElbowPole, anchor: "mixamorigRightForeArm", parent: .rightWrist, ik: .rightWrist, zOffset: -0.5)
        createPole(.leftKneePole, anchor: "mixamorigLeftLeg", parent: .leftFoot, ik: .leftFoot, zOffset: 0.5)
        createPole(.rightKneePole, anchor: "mixamorigRightLeg", parent: .rightFoot, ik: .rightFoot, zOffset: 0.5)
    }

    private func createIKHandle(_ role: RigHandleRole, target targetName: String, root rootName: String, parent: RigHandleRole?, pole: RigHandleRole? = nil) {
        guard let target = bones[targetName] else { return }
        let chain = buildChain(from: target, through: rootName).map { $0.name ?? "" }
        let handle = makeHandle(role: role, kind: .ik, targetBone: target, parent: parent, chain: chain, pole: pole, hidden: false)
        handles[role] = handle
    }

    private func createPole(_ role: RigHandleRole, anchor anchorName: String, parent: RigHandleRole, ik: RigHandleRole, zOffset: Float) {
        guard let anchor = bones[anchorName] else { return }
        let handle = makeHandle(role: role, kind: .pole, targetBone: nil, parent: parent, hidden: true)
        handle.node.position = anchor.presentation.worldPosition + SCNVector3(0, 0, zOffset)
        handles[role] = handle
        handles[ik]?.poleRole = role
    }

    private func makeHandle(role: RigHandleRole, kind: RigHandleKind, targetBone: SCNNode?, parent: RigHandleRole?, chain: [String] = [], pole: RigHandleRole? = nil, hidden: Bool) -> RigHandle {
        let node = SCNNode()
        node.name = "ControlHandle"
        node.geometry = SCNTorus(ringRadius: 0.018, pipeRadius: 0.003)
        node.geometry?.firstMaterial = controlMaterial(selected: false)
        node.constraints = [SCNBillboardConstraint()]
        node.isHidden = hidden
        if let targetBone {
            node.position = targetBone.presentation.worldPosition
        }
        scene.rootNode.addChildNode(node)

        return RigHandle(
            role: role,
            kind: kind,
            node: node,
            targetBoneName: targetBone?.name,
            parentRole: parent,
            chainBoneNames: chain,
            poleRole: pole,
            hidden: hidden
        )
    }

    private func controlMaterial(selected: Bool) -> SCNMaterial {
        let material = SCNMaterial()
        material.diffuse.contents = selected
            ? UIColor(red: 1, green: 0.78, blue: 0.22, alpha: 1)
            : UIColor(red: 0.83, green: 0.45, blue: 0.12, alpha: 1)
        material.emission.contents = selected
            ? UIColor(red: 0.6, green: 0.38, blue: 0.08, alpha: 1)
            : UIColor(red: 0.3, green: 0.16, blue: 0.04, alpha: 1)
        material.isDoubleSided = true
        return material
    }

    private func apply(handle: RigHandle) {
        switch handle.kind {
        case .pelvis:
            guard let targetName = handle.targetBoneName, let target = bones[targetName], let parent = target.parent else { return }
            target.position = parent.convertPosition(handle.node.position, from: nil)
            applyLegAndToeTargets()
        case .ik:
            guard let targetName = handle.targetBoneName, let target = bones[targetName] else { return }
            let chain = handle.chainBoneNames.compactMap { bones[$0] }
            let pole = handle.poleRole.flatMap { handles[$0]?.node.position }
            IKSolver.solve(endBone: target, chain: chain, target: handle.node.position, pole: pole)
        case .pole:
            guard let ikHandle = handles.first(where: { $0.value.poleRole == handle.role })?.value,
                  let targetName = ikHandle.targetBoneName,
                  let target = bones[targetName] else { return }
            let chain = ikHandle.chainBoneNames.compactMap { bones[$0] }
            IKSolver.solve(endBone: target, chain: chain, target: ikHandle.node.position, pole: handle.node.position)
        }
    }

    private func applyLegAndToeTargets() {
        [.leftFoot, .rightFoot, .leftToe, .rightToe].forEach { role in
            if let handle = handles[role] {
                apply(handle: handle)
            }
        }
    }

    private func moveChildHandles(of role: RigHandleRole, by offset: SCNVector3) {
        handles.values.filter { $0.parentRole == role }.forEach { child in
            child.node.position = child.node.position + offset
            moveChildHandles(of: child.role, by: offset)
        }
    }

    private func applyChildSolves(of role: RigHandleRole) {
        handles.values.filter { $0.parentRole == role }.forEach { child in
            apply(handle: child)
            applyChildSolves(of: child.role)
        }
    }

    private func snapshot() -> PoseSnapshot {
        let bonePoses = bones.values.compactMap { node -> BonePose? in
            guard let name = node.name else { return nil }
            return BonePose(name: name, position: node.simdPosition, orientation: node.simdOrientation.vector)
        }
        let handlePoses = handles.values.map { HandlePose(role: $0.role, position: $0.node.simdPosition) }
        return PoseSnapshot(bones: bonePoses, handles: handlePoses)
    }

    private func apply(_ snapshot: PoseSnapshot) {
        snapshot.bones.forEach { pose in
            guard let node = bones[pose.name] else { return }
            node.simdPosition = pose.position
            node.simdOrientation = simd_quatf(vector: pose.orientation)
        }
        snapshot.handles.forEach { pose in
            handles[pose.role]?.node.simdPosition = pose.position
        }
    }

    private func restoreBasePose(label: String, clearHistory: Bool) {
        guard let basePose else { return }
        apply(basePose)
        selectedHandle = nil
        setHandleSelection(nil)
        if clearHistory {
            undoStack.removeAll()
            viewModel?.refreshUndoState(false)
        }
        viewModel?.setStatus(label)
    }

    private func posesEqual(_ lhs: PoseSnapshot, _ rhs: PoseSnapshot) -> Bool {
        lhs.bones.map(\.orientation) == rhs.bones.map(\.orientation)
            && lhs.bones.map(\.position) == rhs.bones.map(\.position)
            && lhs.handles.map(\.position) == rhs.handles.map(\.position)
    }

    private func hitHandle(at point: CGPoint, in view: SCNView) -> RigHandle? {
        let hits = view.hitTest(point, options: [.boundingBoxOnly: true])
        guard let hitNode = hits.first?.node else { return nil }
        return handles.values.first { !$0.hidden && ($0.node === hitNode || hitNode.isDescendant(of: $0.node)) }
    }

    private func setHandleSelection(_ role: RigHandleRole?) {
        handles.values.forEach { handle in
            handle.node.geometry?.firstMaterial = controlMaterial(selected: handle.role == role)
        }
    }

    private func worldPoint(for point: CGPoint, in view: SCNView) -> SCNVector3? {
        let near = view.unprojectPoint(SCNVector3(Float(point.x), Float(point.y), 0))
        let far = view.unprojectPoint(SCNVector3(Float(point.x), Float(point.y), 1))
        let direction = normalized(far - near)
        let denominator = dot(direction, dragPlaneNormal)
        guard abs(denominator) > 0.00001 else { return nil }
        let t = dot(dragPlanePoint - near, dragPlaneNormal) / denominator
        return near + direction * t
    }

    private func cameraForward() -> SCNVector3 {
        let presentation = cameraNode.presentation.worldTransform
        return normalized(SCNVector3(-presentation.m31, -presentation.m32, -presentation.m33))
    }

    private func updateCamera() {
        let x = cameraTarget.x + cameraDistance * cos(cameraPitch) * sin(cameraYaw)
        let y = cameraTarget.y + cameraDistance * sin(cameraPitch)
        let z = cameraTarget.z + cameraDistance * cos(cameraPitch) * cos(cameraYaw)
        cameraNode.position = SCNVector3(x, y, z)
        cameraNode.look(at: cameraTarget)
    }

    private func createGrid() {
        let grid = SCNNode()
        gridNode = grid
        for i in -12...12 {
            let a = lineNode(from: SCNVector3(Float(i) * 0.25, 0, -3), to: SCNVector3(Float(i) * 0.25, 0, 3))
            let b = lineNode(from: SCNVector3(-3, 0, Float(i) * 0.25), to: SCNVector3(3, 0, Float(i) * 0.25))
            grid.addChildNode(a)
            grid.addChildNode(b)
        }
        scene.rootNode.addChildNode(grid)
    }

    private func lineNode(from: SCNVector3, to: SCNVector3) -> SCNNode {
        let source = SCNGeometrySource(vertices: [from, to])
        let element = SCNGeometryElement(indices: [UInt32(0), UInt32(1)], primitiveType: .line)
        let geometry = SCNGeometry(sources: [source], elements: [element])
        let material = SCNMaterial()
        material.diffuse.contents = UIColor(red: 0.76, green: 0.84, blue: 0.94, alpha: 0.55)
        geometry.materials = [material]
        return SCNNode(geometry: geometry)
    }

    private func makeSkeletonNode() -> SCNNode {
        let root = SCNNode()
        bones.values.forEach { bone in
            bone.childNodes.filter { $0.name?.lowercased().contains("mixamorig") == true }.forEach { child in
                root.addChildNode(lineNode(from: bone.presentation.worldPosition, to: child.presentation.worldPosition))
            }
        }
        return root
    }

    private func buildChain(from endBone: SCNNode, through rootName: String) -> [SCNNode] {
        var chain: [SCNNode] = []
        var current = endBone.parent
        while let bone = current {
            if bone.name?.lowercased().contains("mixamorig") == true {
                chain.append(bone)
            }
            if bone.name == rootName { break }
            current = bone.parent
        }
        return chain
    }

    private func bone(matching name: String) -> SCNNode? {
        bones[name]
    }
}
