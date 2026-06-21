import SceneKit
import UIKit
import simd

@MainActor
final class PoseSceneController {
    weak var viewModel: SceneViewModel?

    private weak var scnView: SCNView?
    private let scene = SCNScene()
    private let cameraNode = SCNNode()
    private let cameraTarget = SCNVector3(0, 0.55, 0)
    private var cameraDistance: Float = 2.2
    private var cameraYaw: Float = 0.48
    private var cameraPitch: Float = -0.18

    private var modelRoot: SCNNode?
    private var skeletonNode: SCNNode?
    private var gridNode: SCNNode?
    private var shadowGroundNode: SCNNode?
    private var skeletonVisible = true
    private var bones: [String: SCNNode] = [:]
    private var canonicalBoneNames: [ObjectIdentifier: String] = [:]
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
    private var isOrbitingSingleTouch = false

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
        skeletonVisible = visible
        refreshSkeleton()
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
            guard let handle = hitHandle(at: location, in: view) else {
                isOrbitingSingleTouch = true
                isDraggingHandle = false
                return
            }
            selectedHandle = handle
            setHandleSelection(handle.role)
            dragStartPose = snapshot()
            dragStartHandle = handle.node.convertPosition(SCNVector3Zero, to: nil)
            dragPlanePoint = dragStartHandle
            dragPlaneNormal = cameraForward()
            guard let world = worldPoint(for: location, in: view) else { return }
            dragStartWorld = world
            isDraggingHandle = true
            isOrbitingSingleTouch = false
        case .changed:
            if isOrbitingSingleTouch {
                orbit(using: gesture)
                return
            }
            guard isDraggingHandle, let selectedHandle, let world = worldPoint(for: location, in: view) else { return }
            let offset = world - dragStartWorld
            let previous = selectedHandle.node.position
            selectedHandle.node.position = dragStartHandle + offset
            moveChildHandles(of: selectedHandle.role, by: selectedHandle.node.position - previous)
            apply(handle: selectedHandle)
            applyChildSolves(of: selectedHandle.role)
            refreshSkeleton()
            viewModel?.setStatus("Pose changed")
        case .ended, .cancelled, .failed:
            if let dragStartPose, !posesEqual(dragStartPose, snapshot()) {
                undoStack.append(dragStartPose)
                viewModel?.refreshUndoState(true)
            }
            isDraggingHandle = false
            isOrbitingSingleTouch = false
            self.dragStartPose = nil
        default:
            break
        }
    }

    func handleOrbitPan(_ gesture: UIPanGestureRecognizer) {
        orbit(using: gesture)
    }

    private func orbit(using gesture: UIPanGestureRecognizer) {
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
        key.shadowMode = .deferred
        key.shadowRadius = 5
        key.shadowSampleCount = 16
        key.shadowMapSize = CGSize(width: 2048, height: 2048)
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

        createShadowGround()
        createGrid()
    }

    private func loadModel() {
        viewModel?.setStatus("Loading model")
        guard let url = Bundle.main.url(forResource: "stickman_default", withExtension: "usdz") else {
            viewModel?.setStatus("Missing stickman_default.usdz")
            return
        }

        let loadedScene: SCNScene
        do {
            loadedScene = try SCNScene(url: url)
        } catch {
            viewModel?.setStatus("Missing or invalid stickman_default.usdz")
            print("SceneKit failed to load stickman_default.usdz:", error.localizedDescription)
            return
        }

        let root = SCNNode()
        loadedScene.rootNode.childNodes.forEach { root.addChildNode($0) }
        scene.rootNode.addChildNode(root)
        modelRoot = root
        collectBones(from: root)
        orientAndFrameModel(root)
        scene.rootNode.forceWorldTransformUpdate()
        applyWhiteMaterial(to: root)
        skeletonNode = makeSkeletonNode()
        if let skeletonNode {
            skeletonNode.isHidden = !skeletonVisible
            scene.rootNode.addChildNode(skeletonNode)
        }
        refreshSkeleton()

        createHandles()
        scene.rootNode.forceWorldTransformUpdate()
        refreshSkeleton()
        basePose = snapshot()
        viewModel?.setStatus("\(uniqueBones.count) joints ready, \(handles.count) controls")
    }

    private func orientAndFrameModel(_ root: SCNNode) {
        root.eulerAngles.x = -.pi / 2
        root.scale = SCNVector3(1, 1, 1)
        root.position = SCNVector3Zero
        scene.rootNode.forceWorldTransformUpdate()

        let bounds = rigBounds() ?? worldBounds(for: root)
        let size = bounds.max - bounds.min
        let largestDimension = Swift.max(size.x, Swift.max(size.y, size.z))
        guard largestDimension > 0.000001 else { return }

        let scale = Float(1.05) / largestDimension
        let center = (bounds.min + bounds.max) * 0.5
        root.scale = SCNVector3(scale, scale, scale)
        root.position = SCNVector3(-center.x * scale, -bounds.min.y * scale, -center.z * scale)
    }

    private func rigBounds() -> (min: SCNVector3, max: SCNVector3)? {
        guard !uniqueBones.isEmpty else { return nil }
        var minPoint = SCNVector3(Float.greatestFiniteMagnitude, Float.greatestFiniteMagnitude, Float.greatestFiniteMagnitude)
        var maxPoint = SCNVector3(-Float.greatestFiniteMagnitude, -Float.greatestFiniteMagnitude, -Float.greatestFiniteMagnitude)

        uniqueBones.forEach { bone in
            let point = bone.convertPosition(SCNVector3Zero, to: scene.rootNode)
            minPoint = min(minPoint, point)
            maxPoint = max(maxPoint, point)
        }

        return (minPoint, maxPoint)
    }

    private func worldBounds(for root: SCNNode) -> (min: SCNVector3, max: SCNVector3) {
        var minPoint = SCNVector3(Float.greatestFiniteMagnitude, Float.greatestFiniteMagnitude, Float.greatestFiniteMagnitude)
        var maxPoint = SCNVector3(-Float.greatestFiniteMagnitude, -Float.greatestFiniteMagnitude, -Float.greatestFiniteMagnitude)
        var foundGeometry = false

        root.enumerateChildNodes { node, _ in
            guard node.geometry != nil else { return }
            let bounds = node.boundingBox
            let corners = [
                SCNVector3(bounds.min.x, bounds.min.y, bounds.min.z),
                SCNVector3(bounds.min.x, bounds.min.y, bounds.max.z),
                SCNVector3(bounds.min.x, bounds.max.y, bounds.min.z),
                SCNVector3(bounds.min.x, bounds.max.y, bounds.max.z),
                SCNVector3(bounds.max.x, bounds.min.y, bounds.min.z),
                SCNVector3(bounds.max.x, bounds.min.y, bounds.max.z),
                SCNVector3(bounds.max.x, bounds.max.y, bounds.min.z),
                SCNVector3(bounds.max.x, bounds.max.y, bounds.max.z)
            ]
            corners.forEach { corner in
                let point = node.convertPosition(corner, to: scene.rootNode)
                minPoint = min(minPoint, point)
                maxPoint = max(maxPoint, point)
                foundGeometry = true
            }
        }

        if foundGeometry {
            return (minPoint, maxPoint)
        }
        return (SCNVector3(-0.5, 0, -0.5), SCNVector3(0.5, 1.55, 0.5))
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
        canonicalBoneNames.removeAll()
        if collectSkinnerBones(from: root) {
            return
        }

        root.enumerateChildNodes { node, _ in
            if let name = node.name, name.lowercased().contains("mixamorig") {
                registerBone(node, aliases: [name])
            }
        }
    }

    private func collectSkinnerBones(from root: SCNNode) -> Bool {
        var skinnerBones: [SCNNode] = []
        root.enumerateChildNodes { node, stop in
            if let bones = node.skinner?.bones, bones.count >= mixamoJointNames.count {
                skinnerBones = Array(bones.prefix(mixamoJointNames.count))
                stop.pointee = true
            }
        }

        guard skinnerBones.count == mixamoJointNames.count else { return false }
        for (index, bone) in skinnerBones.enumerated() {
            let mixamoName = "mixamorig\(mixamoJointNames[index])"
            registerBone(bone, aliases: [bone.name, mixamoName])
        }
        return true
    }

    private func registerBone(_ bone: SCNNode, aliases: [String?]) {
        aliases.compactMap { $0 }.forEach { alias in
            bones[alias] = bone
            bones[normalizedBoneName(alias)] = bone
        }
        if let canonical = aliases.compactMap({ $0 }).first(where: { $0.lowercased().contains("mixamorig") }) {
            canonicalBoneNames[ObjectIdentifier(bone)] = normalizedBoneName(canonical)
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
        guard let target = bone(matching: targetName) else { return }
        let chain = buildChain(from: target, through: rootName).map { $0.name ?? "" }
        let handle = makeHandle(role: role, kind: .ik, targetBone: target, parent: parent, chain: chain, pole: pole, hidden: false)
        handles[role] = handle
    }

    private func createPole(_ role: RigHandleRole, anchor anchorName: String, parent: RigHandleRole, ik: RigHandleRole, zOffset: Float) {
        guard let anchor = bone(matching: anchorName) else { return }
        let handle = makeHandle(role: role, kind: .pole, targetBone: nil, parent: parent, hidden: true)
        handle.node.position = anchor.convertPosition(SCNVector3Zero, to: nil) + SCNVector3(0, 0, zOffset)
        handles[role] = handle
        handles[ik]?.poleRole = role
    }

    private func makeHandle(role: RigHandleRole, kind: RigHandleKind, targetBone: SCNNode?, parent: RigHandleRole?, chain: [String] = [], pole: RigHandleRole? = nil, hidden: Bool) -> RigHandle {
        let node = SCNNode()
        node.name = "ControlHandle"
        let billboard = SCNBillboardConstraint()
        billboard.freeAxes = .all
        node.constraints = [billboard]
        node.renderingOrder = 20
        node.isHidden = hidden
        node.castsShadow = false

        let ring = SCNNode(geometry: SCNPlane(width: 0.065, height: 0.065))
        ring.name = "ControlHandleRing"
        ring.geometry?.firstMaterial = controlMaterial(selected: false)
        ring.renderingOrder = 21
        ring.castsShadow = false
        node.addChildNode(ring)

        if let targetBone {
            node.position = targetBone.convertPosition(SCNVector3Zero, to: nil)
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
        let color = selected
            ? UIColor(red: 1, green: 0.78, blue: 0.22, alpha: 1)
            : UIColor(red: 0.83, green: 0.45, blue: 0.12, alpha: 1)
        let material = SCNMaterial()
        material.diffuse.contents = controlRingImage(color: color)
        material.emission.contents = controlRingImage(color: color)
        material.lightingModel = .constant
        material.blendMode = .alpha
        material.isDoubleSided = true
        material.readsFromDepthBuffer = false
        material.writesToDepthBuffer = false
        return material
    }

    private func controlRingImage(color: UIColor) -> UIImage {
        let size = CGSize(width: 96, height: 96)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { context in
            let rect = CGRect(origin: .zero, size: size).insetBy(dx: 8, dy: 8)
            color.setFill()
            UIBezierPath(ovalIn: rect).fill()

            context.cgContext.setBlendMode(.clear)
            UIBezierPath(ovalIn: rect.insetBy(dx: 24, dy: 24)).fill()
            context.cgContext.setBlendMode(.normal)

            UIColor.white.withAlphaComponent(0.35).setStroke()
            let highlight = UIBezierPath(ovalIn: rect.insetBy(dx: 2, dy: 2))
            highlight.lineWidth = 3
            highlight.stroke()
        }
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
        let roles: [RigHandleRole] = [.leftFoot, .rightFoot, .leftToe, .rightToe]
        roles.forEach { role in
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
        let bonePoses = uniqueBones.compactMap { node -> BonePose? in
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
        refreshSkeleton()
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
        let touchRadius: CGFloat = 44
        return handles.values
            .filter { !$0.hidden }
            .compactMap { handle -> (handle: RigHandle, distance: CGFloat)? in
                let worldPosition = handle.node.convertPosition(SCNVector3Zero, to: nil)
                let projected = view.projectPoint(worldPosition)
                guard projected.z >= 0, projected.z <= 1 else { return nil }

                let projectedPoint = CGPoint(x: CGFloat(projected.x), y: CGFloat(projected.y))
                let distance = hypot(projectedPoint.x - point.x, projectedPoint.y - point.y)
                guard distance <= touchRadius else { return nil }
                return (handle, distance)
            }
            .min { $0.distance < $1.distance }?
            .handle
    }

    private func setHandleSelection(_ role: RigHandleRole?) {
        handles.values.forEach { handle in
            handle.node.geometry?.firstMaterial = controlMaterial(selected: handle.role == role)
            handle.node.childNodes.forEach { child in
                child.geometry?.firstMaterial = controlMaterial(selected: handle.role == role)
            }
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
        cameraNode.look(at: cameraTarget, up: SCNVector3(0, 1, 0), localFront: SCNVector3(0, 0, -1))
    }

    private func createShadowGround() {
        let floor = SCNFloor()
        floor.reflectivity = 0

        let material = SCNMaterial()
        material.lightingModel = .shadowOnly
        material.diffuse.contents = UIColor.black
        material.isDoubleSided = true
        floor.materials = [material]

        let node = SCNNode(geometry: floor)
        node.name = "ShadowGround"
        node.castsShadow = false
        node.renderingOrder = -10
        shadowGroundNode = node
        scene.rootNode.addChildNode(node)
    }

    private func createGrid() {
        let grid = SCNNode()
        gridNode = grid
        grid.castsShadow = false
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
        let node = SCNNode(geometry: geometry)
        node.castsShadow = false
        return node
    }

    private func makeSkeletonNode() -> SCNNode {
        let root = SCNNode()
        root.name = "SkeletonOverlay"
        return root
    }

    private func refreshSkeleton() {
        guard let skeletonNode else { return }
        skeletonNode.childNodes.forEach { $0.removeFromParentNode() }
        guard skeletonVisible else { return }

        uniqueBones.forEach { bone in
            let bonePosition = bone.convertPosition(SCNVector3Zero, to: nil)
            bone.childNodes.filter { isRigBone($0) }.forEach { child in
                skeletonNode.addChildNode(lineNode(from: bonePosition, to: child.convertPosition(SCNVector3Zero, to: nil)))
            }
        }
    }

    private func jointNode(at position: SCNVector3) -> SCNNode {
        let node = SCNNode(geometry: SCNSphere(radius: 0.03))
        node.position = position
        node.renderingOrder = 15
        let material = SCNMaterial()
        material.diffuse.contents = UIColor(red: 1, green: 0.82, blue: 0.24, alpha: 1)
        material.emission.contents = UIColor(red: 0.42, green: 0.26, blue: 0.05, alpha: 1)
        material.readsFromDepthBuffer = false
        material.writesToDepthBuffer = false
        node.geometry?.materials = [material]
        return node
    }

    private func skeletonBoneNode(from start: SCNVector3, to end: SCNVector3) -> SCNNode {
        let direction = end - start
        let height = CGFloat(length(direction))
        let node = SCNNode(geometry: SCNCylinder(radius: 0.015, height: height))
        node.position = (start + end) * 0.5
        node.renderingOrder = 14
        node.look(at: end, up: scene.rootNode.worldUp, localFront: SCNVector3(0, 1, 0))

        let material = SCNMaterial()
        material.diffuse.contents = UIColor(red: 1, green: 0.76, blue: 0.18, alpha: 1)
        material.emission.contents = UIColor(red: 0.36, green: 0.2, blue: 0.04, alpha: 1)
        material.readsFromDepthBuffer = false
        material.writesToDepthBuffer = false
        node.geometry?.materials = [material]
        return node
    }

    private func buildChain(from endBone: SCNNode, through rootName: String) -> [SCNNode] {
        var chain: [SCNNode] = []
        var current = endBone.parent
        while let bone = current {
            if isRigBone(bone) {
                chain.append(bone)
            }
            if canonicalName(for: bone) == normalizedBoneName(rootName) { break }
            current = bone.parent
        }
        return chain
    }

    private func bone(matching name: String) -> SCNNode? {
        bones[name] ?? bones[normalizedBoneName(name)]
    }

    private var uniqueBones: [SCNNode] {
        var seen: Set<ObjectIdentifier> = []
        return bones.values.filter { bone in
            seen.insert(ObjectIdentifier(bone)).inserted
        }
    }

    private func isRigBone(_ node: SCNNode) -> Bool {
        canonicalBoneNames[ObjectIdentifier(node)] != nil
            || node.name?.lowercased().contains("mixamorig") == true
    }

    private func canonicalName(for node: SCNNode) -> String? {
        canonicalBoneNames[ObjectIdentifier(node)] ?? node.name.map(normalizedBoneName)
    }

    private let mixamoJointNames = [
        "Hips",
        "Spine",
        "Spine1",
        "Spine2",
        "Neck",
        "Head",
        "HeadTop_End",
        "LeftShoulder",
        "LeftArm",
        "LeftForeArm",
        "LeftHand",
        "LeftHandIndex1",
        "LeftHandIndex2",
        "LeftHandIndex3",
        "LeftHandIndex4",
        "RightShoulder",
        "RightArm",
        "RightForeArm",
        "RightHand",
        "RightHandIndex1",
        "RightHandIndex2",
        "RightHandIndex3",
        "RightHandIndex4",
        "LeftUpLeg",
        "LeftLeg",
        "LeftFoot",
        "LeftToeBase",
        "LeftToe_End",
        "RightUpLeg",
        "RightLeg",
        "RightFoot",
        "RightToeBase",
        "RightToe_End"
    ]

    private func normalizedBoneName(_ name: String) -> String {
        name
            .replacingOccurrences(of: ":", with: "")
            .replacingOccurrences(of: "_", with: "")
            .lowercased()
    }
}
