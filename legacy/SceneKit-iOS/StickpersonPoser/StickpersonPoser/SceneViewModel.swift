import Foundation

@MainActor
final class SceneViewModel: ObservableObject {
    @Published var status: String = "Loading model"
    @Published var showMesh: Bool = true
    @Published var showSkeleton: Bool = true
    @Published var showGrid: Bool = true
    @Published var canUndo: Bool = false
    @Published var canLoad: Bool = PoseStore.hasSavedPose

    weak var sceneController: PoseSceneController?

    func attach(_ controller: PoseSceneController) {
        sceneController = controller
        controller.viewModel = self
    }

    func setStatus(_ value: String) {
        DispatchQueue.main.async { [weak self] in
            self?.status = value
        }
    }

    func refreshUndoState(_ canUndo: Bool) {
        DispatchQueue.main.async { [weak self] in
            self?.canUndo = canUndo
        }
    }

    func refreshLoadState() {
        DispatchQueue.main.async { [weak self] in
            self?.canLoad = PoseStore.hasSavedPose
        }
    }
}
