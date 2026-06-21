import SceneKit

extension SCNVector3 {
    var simd: SIMD3<Float> {
        SIMD3<Float>(x, y, z)
    }

    init(_ value: SIMD3<Float>) {
        self.init(value.x, value.y, value.z)
    }
}

extension SCNQuaternion {
    var simd: SIMD4<Float> {
        SIMD4<Float>(x, y, z, w)
    }

    init(_ value: SIMD4<Float>) {
        self.init(value.x, value.y, value.z, value.w)
    }
}

extension SCNNode {
    func isDescendant(of ancestor: SCNNode) -> Bool {
        var current = parent
        while let node = current {
            if node === ancestor {
                return true
            }
            current = node.parent
        }
        return false
    }

    func forceWorldTransformUpdate() {
        _ = worldTransform
        childNodes.forEach { $0.forceWorldTransformUpdate() }
    }
}

func +(lhs: SCNVector3, rhs: SCNVector3) -> SCNVector3 {
    SCNVector3(lhs.x + rhs.x, lhs.y + rhs.y, lhs.z + rhs.z)
}

func -(lhs: SCNVector3, rhs: SCNVector3) -> SCNVector3 {
    SCNVector3(lhs.x - rhs.x, lhs.y - rhs.y, lhs.z - rhs.z)
}

func *(lhs: SCNVector3, rhs: Float) -> SCNVector3 {
    SCNVector3(lhs.x * rhs, lhs.y * rhs, lhs.z * rhs)
}

func /(lhs: SCNVector3, rhs: Float) -> SCNVector3 {
    SCNVector3(lhs.x / rhs, lhs.y / rhs, lhs.z / rhs)
}

func min(_ lhs: SCNVector3, _ rhs: SCNVector3) -> SCNVector3 {
    SCNVector3(Swift.min(lhs.x, rhs.x), Swift.min(lhs.y, rhs.y), Swift.min(lhs.z, rhs.z))
}

func max(_ lhs: SCNVector3, _ rhs: SCNVector3) -> SCNVector3 {
    SCNVector3(Swift.max(lhs.x, rhs.x), Swift.max(lhs.y, rhs.y), Swift.max(lhs.z, rhs.z))
}

func dot(_ lhs: SCNVector3, _ rhs: SCNVector3) -> Float {
    lhs.x * rhs.x + lhs.y * rhs.y + lhs.z * rhs.z
}

func cross(_ lhs: SCNVector3, _ rhs: SCNVector3) -> SCNVector3 {
    SCNVector3(
        lhs.y * rhs.z - lhs.z * rhs.y,
        lhs.z * rhs.x - lhs.x * rhs.z,
        lhs.x * rhs.y - lhs.y * rhs.x
    )
}

func length(_ value: SCNVector3) -> Float {
    sqrt(dot(value, value))
}

func normalized(_ value: SCNVector3) -> SCNVector3 {
    let magnitude = length(value)
    guard magnitude > 0.000001 else { return SCNVector3Zero }
    return value * (1 / magnitude)
}
