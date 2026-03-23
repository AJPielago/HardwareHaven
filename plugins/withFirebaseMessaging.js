/**
 * Expo config plugin that adds Firebase Messaging native dependencies
 * and ensures FirebaseApp is explicitly initialized in MainApplication.
 *
 * When EAS Build runs `expo prebuild`, the android/ directory is regenerated
 * from scratch. Any manual changes to build.gradle or MainApplication are lost.
 * This plugin ensures all Firebase native setup survives prebuild.
 */

const {
  withAppBuildGradle,
  withProjectBuildGradle,
  withDangerousMod,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ── 1. app/build.gradle: add firebase-bom + firebase-messaging ──────────────

function addFirebaseDependencies(buildGradle) {
  if (buildGradle.includes('com.google.firebase:firebase-bom')) {
    return buildGradle;
  }

  const anchor = 'implementation("com.facebook.react:react-android")';
  if (!buildGradle.includes(anchor)) {
    console.warn('[withFirebaseMessaging] Could not find react-android dependency anchor');
    return buildGradle;
  }

  const firebaseDeps = `${anchor}

    // Firebase BOM + Cloud Messaging (added by withFirebaseMessaging plugin)
    implementation platform('com.google.firebase:firebase-bom:33.8.0')
    implementation 'com.google.firebase:firebase-messaging'`;

  return buildGradle.replace(anchor, firebaseDeps);
}

// ── 2. root build.gradle: add google-services classpath ─────────────────────

function addGoogleServicesClasspath(buildGradle) {
  if (buildGradle.includes('com.google.gms:google-services')) {
    return buildGradle;
  }

  // Try both quoting styles Expo may generate
  for (const anchor of [
    "classpath('com.android.tools.build:gradle')",
    'classpath("com.android.tools.build:gradle")',
  ]) {
    if (buildGradle.includes(anchor)) {
      return buildGradle.replace(
        anchor,
        `${anchor}\n        classpath('com.google.gms:google-services:4.4.2')`
      );
    }
  }

  console.warn('[withFirebaseMessaging] Could not find gradle classpath anchor');
  return buildGradle;
}

// ── 3. app/build.gradle: apply google-services plugin ───────────────────────

function addGoogleServicesPlugin(buildGradle) {
  if (buildGradle.includes('com.google.gms.google-services')) {
    return buildGradle;
  }

  // Try both quoting styles
  for (const anchor of [
    'apply plugin: "com.facebook.react"',
    "apply plugin: 'com.facebook.react'",
  ]) {
    if (buildGradle.includes(anchor)) {
      return buildGradle.replace(
        anchor,
        `${anchor}\napply plugin: "com.google.gms.google-services"`
      );
    }
  }

  console.warn('[withFirebaseMessaging] Could not find react plugin anchor');
  return buildGradle;
}

// ── 4. MainApplication.kt: add FirebaseApp.initializeApp(this) ──────────────

function patchMainApplication(projectRoot, packageName) {
  const mainAppRelPath = path.join(
    'android',
    'app',
    'src',
    'main',
    'java',
    ...packageName.split('.'),
    'MainApplication.kt'
  );
  const mainAppPath = path.join(projectRoot, mainAppRelPath);

  if (!fs.existsSync(mainAppPath)) {
    console.warn('[withFirebaseMessaging] MainApplication.kt not found at', mainAppPath);
    return;
  }

  let contents = fs.readFileSync(mainAppPath, 'utf-8');

  // Skip if already patched
  if (contents.includes('FirebaseApp')) {
    return;
  }

  // Add import
  const importAnchor = 'import expo.modules.ApplicationLifecycleDispatcher';
  if (contents.includes(importAnchor)) {
    contents = contents.replace(
      importAnchor,
      `${importAnchor}\nimport com.google.firebase.FirebaseApp`
    );
  }

  // Add FirebaseApp.initializeApp(this) right after super.onCreate()
  const onCreateAnchor = 'super.onCreate()';
  if (contents.includes(onCreateAnchor)) {
    contents = contents.replace(
      onCreateAnchor,
      `${onCreateAnchor}\n    FirebaseApp.initializeApp(this)`
    );
  }

  fs.writeFileSync(mainAppPath, contents, 'utf-8');
  console.log('[withFirebaseMessaging] Patched MainApplication.kt with FirebaseApp.initializeApp');
}

// ── Compose the plugin ──────────────────────────────────────────────────────

const withFirebaseMessaging = (config) => {
  // 1. Root build.gradle – google-services classpath
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = addGoogleServicesClasspath(config.modResults.contents);
    }
    return config;
  });

  // 2. App build.gradle – google-services plugin + firebase deps
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents = addGoogleServicesPlugin(config.modResults.contents);
      config.modResults.contents = addFirebaseDependencies(config.modResults.contents);
    }
    return config;
  });

  // 3. MainApplication.kt – explicit FirebaseApp.initializeApp
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const packageName =
        config.android?.package || config.modRequest?.android?.package || 'com.shopapp.mobile';
      patchMainApplication(config.modRequest.projectRoot, packageName);
      return config;
    },
  ]);

  return config;
};

module.exports = withFirebaseMessaging;
