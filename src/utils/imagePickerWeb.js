import { Platform, Alert } from 'react-native';

// Web-compatible image picker using file input
let ImagePicker = null;

if (Platform.OS !== 'web') {
  try {
    ImagePicker = require('expo-image-picker');
  } catch (e) {
    console.log('Expo image picker not available');
  }
}

// Web file picker helper
const pickImageWeb = (options = {}) => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = !!options.allowsMultipleSelection;
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      const assets = files.map(file => ({
        uri: URL.createObjectURL(file),
        file,
        width: 0,
        height: 0,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      }));
      resolve({ canceled: false, assets });
    };
    input.click();
  });
};

// Web camera helper (uses device camera via getUserMedia)
const takePhotoWeb = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // For simplicity, we return a placeholder that indicates camera is not fully supported on web
    // Full implementation would require a video element and canvas to capture frame
    Alert.alert('Camera on Web', 'Camera capture is limited on web. Please use image upload instead.');
    return { canceled: true };
  } catch (e) {
    Alert.alert('Camera Error', 'Could not access camera on web browser.');
    return { canceled: true };
  }
};

export const launchImageLibraryAsync = async (options = {}) => {
  if (Platform.OS === 'web') {
    return pickImageWeb(options);
  }
  if (ImagePicker) {
    return ImagePicker.launchImageLibraryAsync(options);
  }
  return { canceled: true };
};

export const launchCameraAsync = async (options = {}) => {
  if (Platform.OS === 'web') {
    return takePhotoWeb();
  }
  if (ImagePicker) {
    return ImagePicker.launchCameraAsync(options);
  }
  return { canceled: true };
};

export const requestCameraPermissionsAsync = async () => {
  if (Platform.OS === 'web') {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      return { status: 'granted' };
    } catch {
      return { status: 'denied' };
    }
  }
  if (ImagePicker) {
    return ImagePicker.requestCameraPermissionsAsync();
  }
  return { status: 'denied' };
};

export const requestMediaLibraryPermissionsAsync = async () => {
  if (Platform.OS === 'web') {
    return { status: 'granted' };
  }
  if (ImagePicker) {
    return ImagePicker.requestMediaLibraryPermissionsAsync();
  }
  return { status: 'denied' };
};

export const MediaTypeOptions = ImagePicker?.MediaTypeOptions || { Images: 'images', Videos: 'videos', All: 'all' };
