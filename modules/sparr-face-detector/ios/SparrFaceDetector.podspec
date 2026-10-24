Pod::Spec.new do |s|
  s.name           = 'SparrFaceDetector'
  s.version        = '1.0.0'
  s.summary        = 'On-device face detection for Sparr profile photos'
  s.description    = 'Detects faces in a local image with Apple Vision.'
  s.license        = 'MIT'
  s.author         = 'Sparr'
  s.homepage       = 'https://sparrapp.com'
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'ImageIO'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
