# Google Pose Submission Plan

## Goal

Allow an iPhone or iPad user to submit a completed Stickperson pose so it can
be received, reviewed, converted into a printable mesh, and downloaded for 3D
printing.

The submission must preserve both:

- An editable pose recipe.
- A baked, print-ready representation of the posed character.

## Recommended Architecture

Use a small backend service between the app and Google services. Do not store
Google Drive or Gmail credentials inside the iOS app.

1. The iPhone or iPad app uploads a submission package to the backend.
2. The backend stores the upload privately and creates a submission record.
3. A processing worker applies the pose to the canonical model and generates
   printable files.
4. The completed package is archived in Google Drive.
5. Gmail sends a notification containing the submission details and private
   download links.

## Submission Package

Each submission should contain:

- `pose.json`: bone transforms, control positions, and part colors.
- `manifest.json`: submission ID, model version, app version, units, requested
  print size, and timestamp.
- `preview.png`: the pose approved by the user.
- `posed-model.usdz`: posed model for Apple-device inspection.
- `print-ready.3mf`: preferred printable output with color and part data.
- `print-ready.stl`: optional universal monochrome output.
- `validation.json`: dimensions, disconnected parts, manifold status, and
  printability warnings.

Bone transforms should be stored by stable bone name rather than runtime UUID.

## iOS Submission Interface

Add a Submit Pose sheet with:

- Customer name.
- Customer email.
- Optional notes.
- Desired finished height and units.
- Include or remove baseplate.
- Single-color or multicolor print.
- Quantity.
- Front, side, and perspective previews.
- Consent confirmation.
- Upload progress and retry state.
- Final submission number.

Use a background `URLSession` upload so submissions can continue while the app
is suspended or temporarily loses connectivity.

## Submission Status

The app should retain a local submission history with these states:

- Uploading
- Received
- Processing
- Needs review
- Print-ready
- Completed
- Failed

Incomplete uploads should remain locally available for retry.

## Print Processing

A server-side Blender worker should:

1. Load the exact canonical model version recorded in the manifest.
2. Apply the submitted bone transforms.
3. Evaluate and bake skin deformation.
4. Apply submitted part colors.
5. Preserve or join parts according to the requested print mode.
6. Fuse intersections and repair gaps.
7. Attach the feet securely to the baseplate when enabled.
8. Check wall thickness, manifold geometry, and disconnected components.
9. Convert scene units to millimeters.
10. Export 3MF, STL, USDZ, and preview renders.

Prefer 3MF as the primary print format because STL does not preserve color or
material assignments. Separate STL files per colored part may also be useful.

## Google Drive Delivery

The backend should create one private folder per submission:

`Stickperson Submissions/<year>/<submission-id>/`

The folder should contain:

- Original submission ZIP.
- Pose and manifest JSON files.
- Preview images.
- USDZ inspection model.
- 3MF print file.
- STL files.
- Validation report.

## Gmail Notification

After processing, send an email containing:

- Submission number.
- Customer details.
- Requested print size and options.
- Preview image or thumbnail.
- Processing status and warnings.
- Private Google Drive folder link.
- Direct expiring download links when available.

Prefer links instead of attaching large 3D files directly to email.

## Backend Interfaces

Suggested endpoints:

- `POST /submissions`: create a submission and return upload URLs.
- `POST /submissions/{id}/complete`: mark upload complete and start processing.
- `GET /submissions/{id}`: return processing and delivery status.
- `DELETE /submissions/{id}`: remove a pending submission when permitted.

Backend components:

- Private object storage.
- Submission database.
- Background processing queue.
- Blender conversion worker.
- Google Drive integration.
- Gmail or transactional email integration.
- Private admin review and download dashboard.

## Security And Privacy

- Never embed Google API credentials in the app.
- Encrypt uploads in transit and at rest.
- Use private storage and expiring download URLs.
- Collect explicit consent before submission.
- Publish privacy and retention policies.
- Allow deletion of pending submissions.
- Record the app version, model version, and model checksum.
- Update App Store privacy disclosures for customer details and submitted
  user-generated content.

## Implementation Phases

### Phase 1: Local Export

- Export `pose.json`, `manifest.json`, preview images, and USDZ locally.
- Add an iOS Share Sheet for manual testing.

### Phase 2: Submission Backend

- Create submissions and upload packages.
- Add submission IDs, progress, retry, and status tracking.
- Send initial Gmail notifications.

### Phase 3: Print Worker

- Automate Blender pose application and deformation baking.
- Repair geometry and export 3MF and STL.
- Produce validation reports and preview renders.

### Phase 4: Google Delivery

- Archive completed packages in Google Drive.
- Include Drive and download links in Gmail notifications.

### Phase 5: Production

- Add admin review tools.
- Add failure monitoring and processing retries.
- Complete privacy, retention, and deletion controls.
- Test through TestFlight on iPhone and iPad.

## MVP Recommendation

The first submission version should upload the pose recipe, model version,
colors, and preview. The backend should create the authoritative baked
print-ready mesh. This avoids relying on SceneKit export behavior and keeps the
web app, native app, and manufacturing pipeline synchronized.
