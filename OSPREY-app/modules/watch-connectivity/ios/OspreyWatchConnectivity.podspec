require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  # NOTE: deliberately NOT named "WatchConnectivity" — that's Apple's own
  # system framework (`import WatchConnectivity` in WatchConnectivityModule.swift).
  # CocoaPods compiles this pod as its own Swift module named after `s.name`,
  # and a Swift module can't import a system framework that shares its own
  # in-progress module name, so this pod needs a distinct name even though
  # the JS-facing bridge name (`Name("WatchConnectivity")` in the Swift file)
  # and the Swift class (`WatchConnectivityModule`) both still say
  # "WatchConnectivity" — those are separate namespaces (JS bridge key /
  # Swift class name) from the CocoaPods module name.
  s.name           = 'OspreyWatchConnectivity'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
