import SwiftUI

@main
struct StickpersonPoserApp: App {
    @StateObject private var viewModel = SceneViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(viewModel)
        }
    }
}

