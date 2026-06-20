import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var viewModel: SceneViewModel

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.12, green: 0.47, blue: 0.73),
                        Color(red: 0.35, green: 0.62, blue: 0.82),
                        Color(red: 0.58, green: 0.69, blue: 0.82),
                        Color(red: 0.51, green: 0.60, blue: 0.74)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                SceneKitContainer(viewModel: viewModel)
                    .ignoresSafeArea()

                VStack {
                    overlayControls
                    Spacer()
                    bottomBar(for: proxy.size)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
            }
        }
    }

    private var overlayControls: some View {
        HStack(alignment: .top) {
            HStack(spacing: 8) {
                toggleButton("Mesh", systemImage: "cube", isOn: viewModel.showMesh) {
                    viewModel.showMesh.toggle()
                    viewModel.sceneController?.setMeshVisible(viewModel.showMesh)
                }
                toggleButton("Skeleton", systemImage: "figure.walk", isOn: viewModel.showSkeleton) {
                    viewModel.showSkeleton.toggle()
                    viewModel.sceneController?.setSkeletonVisible(viewModel.showSkeleton)
                }
                toggleButton("Grid", systemImage: "grid", isOn: viewModel.showGrid) {
                    viewModel.showGrid.toggle()
                    viewModel.sceneController?.setGridVisible(viewModel.showGrid)
                }
            }
            .controlGroupStyle()

            Spacer(minLength: 10)

            HStack(spacing: 8) {
                actionButton("New", systemImage: "plus") {
                    viewModel.sceneController?.newPose()
                }
                actionButton("Undo", systemImage: "arrow.uturn.backward", disabled: !viewModel.canUndo) {
                    viewModel.sceneController?.undo()
                }
                actionButton("Save", systemImage: "square.and.arrow.down") {
                    viewModel.sceneController?.savePose()
                }
                actionButton("Load", systemImage: "square.and.arrow.up", disabled: !viewModel.canLoad) {
                    viewModel.sceneController?.loadPose()
                }
                actionButton("Reset", systemImage: "arrow.clockwise") {
                    viewModel.sceneController?.resetPose()
                }
            }
            .controlGroupStyle()
        }
    }

    private func bottomBar(for size: CGSize) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Stickperson Poser")
                    .font(.headline)
                Text(viewModel.status)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .padding(12)
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .frame(maxWidth: size.width > 700 ? 420 : .infinity)
    }

    private func toggleButton(_ label: String, systemImage: String, isOn: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .frame(width: 34, height: 34)
        }
        .accessibilityLabel(label)
        .foregroundStyle(isOn ? Color.black : Color.white)
        .background(isOn ? Color.yellow.opacity(0.88) : Color.black.opacity(0.28))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func actionButton(_ label: String, systemImage: String, disabled: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .frame(width: 34, height: 34)
        }
        .accessibilityLabel(label)
        .disabled(disabled)
        .foregroundStyle(disabled ? Color.white.opacity(0.35) : Color.white)
        .background(Color.black.opacity(disabled ? 0.16 : 0.28))
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private extension View {
    func controlGroupStyle() -> some View {
        padding(6)
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

