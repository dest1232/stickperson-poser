import SceneKit

enum RigHandleRole: String, CaseIterable, Codable {
    case hips
    case chest
    case headTop
    case leftWrist
    case rightWrist
    case leftFoot
    case rightFoot
    case leftToe
    case rightToe
    case leftElbowPole
    case rightElbowPole
    case leftKneePole
    case rightKneePole
}

enum RigHandleKind {
    case pelvis
    case ik
    case pole
}

final class RigHandle {
    let role: RigHandleRole
    let kind: RigHandleKind
    let node: SCNNode
    let targetBoneName: String?
    let parentRole: RigHandleRole?
    let chainBoneNames: [String]
    var poleRole: RigHandleRole?
    var hidden: Bool

    init(
        role: RigHandleRole,
        kind: RigHandleKind,
        node: SCNNode,
        targetBoneName: String?,
        parentRole: RigHandleRole?,
        chainBoneNames: [String] = [],
        poleRole: RigHandleRole? = nil,
        hidden: Bool = false
    ) {
        self.role = role
        self.kind = kind
        self.node = node
        self.targetBoneName = targetBoneName
        self.parentRole = parentRole
        self.chainBoneNames = chainBoneNames
        self.poleRole = poleRole
        self.hidden = hidden
    }
}

struct BonePose: Codable {
    let name: String
    let position: SIMD3<Float>
    let orientation: SIMD4<Float>
}

struct HandlePose: Codable {
    let role: RigHandleRole
    let position: SIMD3<Float>
}

struct PoseSnapshot: Codable {
    let bones: [BonePose]
    let handles: [HandlePose]
}

