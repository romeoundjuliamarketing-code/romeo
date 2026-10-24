package expo.modules.sparrfacedetector

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Face detection with bundled ML Kit (on-device, free). fromFilePath applies
// the EXIF rotation, so the boxes refer to the upright image.
class SparrFaceDetectorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SparrFaceDetector")

    AsyncFunction("detectFaces") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_FACE_DETECTION", "React context is not available", null)
        return@AsyncFunction
      }
      val image = try {
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (e: Exception) {
        promise.reject("ERR_FACE_DETECTION", "Image could not be read", e)
        return@AsyncFunction
      }
      val options = FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
        .setMinFaceSize(0.05f)
        .build()
      val detector = FaceDetection.getClient(options)
      val rotated = image.rotationDegrees % 180 != 0
      val width = (if (rotated) image.height else image.width).toDouble()
      val height = (if (rotated) image.width else image.height).toDouble()

      detector.process(image)
        .addOnSuccessListener { faces ->
          val list = faces.map { face ->
            val box = face.boundingBox
            mapOf(
              "x" to box.left.toDouble(),
              "y" to box.top.toDouble(),
              "width" to box.width().toDouble(),
              "height" to box.height().toDouble(),
              "yaw" to face.headEulerAngleY.toDouble()
            )
          }
          promise.resolve(mapOf("imageWidth" to width, "imageHeight" to height, "faces" to list))
        }
        .addOnFailureListener { e ->
          promise.reject("ERR_FACE_DETECTION", e.message ?: "Face detection failed", e)
        }
        .addOnCompleteListener { detector.close() }
    }
  }
}
