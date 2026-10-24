import ExpoModulesCore
import ImageIO
import Vision

// Face detection with Apple Vision (on-device, free). Reads the EXIF
// orientation so faces in rotated photos are found and the coordinates refer
// to the upright image.
public class SparrFaceDetectorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SparrFaceDetector")

    AsyncFunction("detectFaces") { (uri: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          promise.resolve(try SparrFaceDetectorModule.detect(uri: uri))
        } catch {
          promise.reject("ERR_FACE_DETECTION", error.localizedDescription)
        }
      }
    }
  }

  private struct ImageUnreadable: LocalizedError {
    var errorDescription: String? { "Image could not be read" }
  }

  private static func detect(uri: String) throws -> [String: Any] {
    let url: URL
    if let parsed = URL(string: uri), parsed.scheme != nil {
      url = parsed
    } else {
      url = URL(fileURLWithPath: uri)
    }
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
      throw ImageUnreadable()
    }
    let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
    let rawOrientation = (properties?[kCGImagePropertyOrientation] as? UInt32) ?? 1
    let orientation = CGImagePropertyOrientation(rawValue: rawOrientation) ?? .up

    let request = VNDetectFaceRectanglesRequest()
    let handler = VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:])
    try handler.perform([request])

    // Orientations 5-8 swap width and height of the upright image.
    let swapped = rawOrientation >= 5 && rawOrientation <= 8
    let width = Double(swapped ? image.height : image.width)
    let height = Double(swapped ? image.width : image.height)

    // Vision returns normalized boxes with the origin bottom-left.
    let faces: [[String: Any]] = (request.results ?? []).map { face in
      let box = face.boundingBox
      var entry: [String: Any] = [
        "x": Double(box.minX) * width,
        "y": (1.0 - Double(box.maxY)) * height,
        "width": Double(box.width) * width,
        "height": Double(box.height) * height,
      ]
      if let yaw = face.yaw {
        entry["yaw"] = yaw.doubleValue * 180.0 / Double.pi
      }
      return entry
    }
    return ["imageWidth": width, "imageHeight": height, "faces": faces]
  }
}
