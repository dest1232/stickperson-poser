import SceneKit
import simd

enum IKSolver {
    static func solve(endBone: SCNNode, chain: [SCNNode], target: SCNVector3, pole: SCNVector3?) {
        guard !chain.isEmpty else { return }

        for _ in 0..<8 {
            for bone in chain {
                let jointPosition = bone.convertPosition(SCNVector3Zero, to: nil)
                let endPosition = endBone.convertPosition(SCNVector3Zero, to: nil)
                let toEnd = normalized(endPosition - jointPosition)
                let toTarget = normalized(target - jointPosition)

                guard length(toEnd) > 0.000001, length(toTarget) > 0.000001 else { continue }
                let clampedDot = max(-1, min(1, dot(toEnd, toTarget)))
                guard clampedDot < 0.9995 else { continue }

                let axis = normalized(cross(toEnd, toTarget))
                guard length(axis) > 0.000001 else { continue }

                let angle = acos(clampedDot)
                let delta = SCNQuaternion(axis.x * sin(angle / 2), axis.y * sin(angle / 2), axis.z * sin(angle / 2), cos(angle / 2))
                applyWorldRotation(delta, to: bone)
            }
        }

        if let pole {
            applyPoleVector(endBone: endBone, chain: chain, target: target, pole: pole)
        }
    }

    private static func applyPoleVector(endBone: SCNNode, chain: [SCNNode], target: SCNVector3, pole: SCNVector3) {
        guard chain.count >= 2 else { return }
        let upperBone = chain[1]
        let midBone = chain[0]
        let rootPosition = upperBone.convertPosition(SCNVector3Zero, to: nil)
        let midPosition = midBone.convertPosition(SCNVector3Zero, to: nil)
        let endPosition = endBone.convertPosition(SCNVector3Zero, to: nil)

        var axis = target - rootPosition
        if length(axis) < 0.000001 {
            axis = endPosition - rootPosition
        }
        axis = normalized(axis)
        guard length(axis) > 0.000001 else { return }

        var currentPole = project(midPosition - rootPosition, onPlaneWithNormal: axis)
        var desiredPole = project(pole - rootPosition, onPlaneWithNormal: axis)
        guard length(currentPole) > 0.000001, length(desiredPole) > 0.000001 else { return }

        currentPole = normalized(currentPole)
        desiredPole = normalized(desiredPole)
        var angle = acos(max(-1, min(1, dot(currentPole, desiredPole))))
        if dot(cross(currentPole, desiredPole), axis) < 0 {
            angle *= -1
        }
        angle *= 0.85

        let delta = SCNQuaternion(axis.x * sin(angle / 2), axis.y * sin(angle / 2), axis.z * sin(angle / 2), cos(angle / 2))
        applyWorldRotation(delta, to: upperBone)
    }

    private static func project(_ vector: SCNVector3, onPlaneWithNormal normal: SCNVector3) -> SCNVector3 {
        vector - normal * dot(vector, normal)
    }

    private static func applyWorldRotation(_ worldRotation: SCNQuaternion, to node: SCNNode) {
        let current = simd_quatf(ix: node.simdWorldOrientation.imag.x, iy: node.simdWorldOrientation.imag.y, iz: node.simdWorldOrientation.imag.z, r: node.simdWorldOrientation.real)
        let delta = simd_quatf(ix: worldRotation.x, iy: worldRotation.y, iz: worldRotation.z, r: worldRotation.w)
        let newWorld = delta * current

        if let parent = node.parent {
            let parentWorld = simd_quatf(ix: parent.simdWorldOrientation.imag.x, iy: parent.simdWorldOrientation.imag.y, iz: parent.simdWorldOrientation.imag.z, r: parent.simdWorldOrientation.real)
            node.simdOrientation = simd_inverse(parentWorld) * newWorld
        } else {
            node.simdOrientation = newWorld
        }
    }
}
