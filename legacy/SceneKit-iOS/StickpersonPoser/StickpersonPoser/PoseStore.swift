import Foundation

enum PoseStore {
    private static let fileName = "saved-pose.json"

    static var fileURL: URL {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("StickpersonPoser", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent(fileName)
    }

    static var hasSavedPose: Bool {
        FileManager.default.fileExists(atPath: fileURL.path)
    }

    static func save(_ snapshot: PoseSnapshot) throws {
        let data = try JSONEncoder().encode(snapshot)
        try data.write(to: fileURL, options: .atomic)
    }

    static func load() throws -> PoseSnapshot {
        let data = try Data(contentsOf: fileURL)
        return try JSONDecoder().decode(PoseSnapshot.self, from: data)
    }
}

