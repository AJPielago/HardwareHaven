/**
 * Expo config plugin that adds Firebase Messaging native dependencies.
 *
 * When EAS Build runs `expo prebuild`, the android/ directory is regenerated
 * from scratch. Any manual changes to build.gradle or MainApplication are lost.
 * This plugin ensures firebase-bom and firebase-messaging are added to the
 * app-level build.gradle so that FirebaseApp auto-initializes via
 * FirebaseInitProvider (which the google-services plugin already sets up).
 */

const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins');

function addFirebaseDependencies(buildGradle) {
  // Check if firebase-bom is already present
  if (buildGradle.includes('com.google.firebase:firebase-bom')) {
    return buildGradle;
  }

  // Insert Firebase BOM + messaging into the dependencies block
  const anchor = 'implementation("com.facebook.react:react-android")';
  if (!buildGradle.includes(anchor)) {
    console.warn('[withFirebaseMessaging] Could not find react-android dependency anchor in app/build.gradle');
    return buildGradle;
  }

  const firebaseDeps = `${anchor}

    // Firebase BOM + Cloud Messaging (added by withFirebaseMessaging plugin)
    implementation platform('com.google.firebase:firebase-bom:33.8.0')
    implementation 'com.google.firebase:firebase-messaging'`;

  return buildGradle.replace(anchor, firebaseDeps);
}

function addGoogleServicesClasspath(buildGradle) {
  // Check if google-services classpath is already present
  if (buildGradle.includes('com.google.gms:google-services')) {
    return buildGradle;
  }

  // Insert google-services classpath into the buildscript dependencies
  const anchor = "classpath('com.android.tools.build:gradle')";
  if (!buildGradle.includes(anchor)) {
    console.warn('[withFirebaseMessaging] Could not find gradle classpath anchor in build.gradle');
    return buildGradle;
  }

  return buildGradle.replace(
    anchor,
    `${anchor}\n        classpath('com.google.gms:google-services:4.4.2')`
  );
}

function addGoogleServicesPlugin(buildGradle) {
  // Check if the plugin is already applied
  if (buildGradle.includes('com.google.gms.google-services')) {
    return buildGradle;
  }

  // Apply the plugin after com.facebook.react
  const anchor = 'apply plugin: "com.facebook.react"';
  if (!buildGradle.includes(anchor)) {
    console.warn('[withFirebaseMessaging] Could not find react plugin anchor in app/build.gradle');
    return buildGradle;
  }

  return buildGradle.replace(
    anchor,
    `${anchor}\napply plugin: "com.google.gms.google-services"`
  );
}

const withFirebaseMessaging = (config) => {
  // 1. Add google-services classpath to root build.gradle
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = addGoogleServicesClasspath(config.modResults.contents);
    }
    return config;
  });

  // 2. Add google-services plugin + firebase dependencies to app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = addGoogleServicesPlugin(config.modResults.contents);
      config.modResults.contents = addFirebaseDependencies(config.modResults.contents);
    }
    return config;
  });

  return config;
};

module.exports = withFirebaseMessaging;
