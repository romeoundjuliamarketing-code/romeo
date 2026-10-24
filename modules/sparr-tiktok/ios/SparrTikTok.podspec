Pod::Spec.new do |s|
  s.name           = 'SparrTikTok'
  s.version        = '1.0.0'
  s.summary        = 'TikTok App Events SDK bridge for Sparr'
  s.description    = 'Asks for App Tracking Transparency and reports app events to TikTok.'
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
  s.dependency 'TikTokBusinessSDK', '~> 1.7'
  s.frameworks = 'AppTrackingTransparency'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
