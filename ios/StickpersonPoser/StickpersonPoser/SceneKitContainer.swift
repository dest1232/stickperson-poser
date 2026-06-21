import SceneKit
import SwiftUI

@MainActor
struct SceneKitContainer: UIViewRepresentable {
    @ObservedObject var viewModel: SceneViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(viewModel: viewModel)
    }

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView(frame: .zero)
        view.backgroundColor = .clear
        view.allowsCameraControl = false
        view.autoenablesDefaultLighting = false
        view.antialiasingMode = .multisampling4X
        view.rendersContinuously = true

        viewModel.attach(context.coordinator.controller)
        context.coordinator.controller.install(in: view)

        let pan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePan(_:)))
        pan.maximumNumberOfTouches = 1
        view.addGestureRecognizer(pan)

        let orbit = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleOrbit(_:)))
        orbit.minimumNumberOfTouches = 2
        view.addGestureRecognizer(orbit)

        let pinch = UIPinchGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handlePinch(_:)))
        view.addGestureRecognizer(pinch)

        return view
    }

    func updateUIView(_ uiView: SCNView, context: Context) {
        context.coordinator.controller.setMeshVisible(viewModel.showMesh)
        context.coordinator.controller.setSkeletonVisible(viewModel.showSkeleton)
        context.coordinator.controller.setGridVisible(viewModel.showGrid)
    }

    @MainActor
    final class Coordinator: NSObject {
        let controller = PoseSceneController()
        private let viewModel: SceneViewModel

        init(viewModel: SceneViewModel) {
            self.viewModel = viewModel
            super.init()
        }

        @objc func handlePan(_ gesture: UIPanGestureRecognizer) {
            controller.handleSingleFingerPan(gesture)
        }

        @objc func handleOrbit(_ gesture: UIPanGestureRecognizer) {
            controller.handleOrbitPan(gesture)
        }

        @objc func handlePinch(_ gesture: UIPinchGestureRecognizer) {
            controller.handlePinch(gesture)
        }
    }
}
