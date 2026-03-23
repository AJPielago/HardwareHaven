import { Platform } from 'react-native';

/**
 * Append an image picked from expo-image-picker or imagePickerWeb (web provides `file` as Blob/File).
 * React Native expects { uri, name, type }; browsers need a Blob/File or multer never receives the file.
 */
export function appendImageToFormData(formData, fieldName, asset, options = {}) {
  if (!asset) return;
  const fallbackName = options.fileName || 'upload.jpg';
  const blobOrFile = asset.file;

  if (Platform.OS === 'web' && blobOrFile instanceof Blob) {
    const name = asset.fileName || (blobOrFile instanceof File ? blobOrFile.name : null) || fallbackName;
    const type = asset.mimeType || blobOrFile.type || 'image/jpeg';
    const toSend =
      typeof File !== 'undefined' && !(blobOrFile instanceof File)
        ? new File([blobOrFile], name, { type })
        : blobOrFile;
    formData.append(fieldName, toSend, name);
    return;
  }

  if (asset.uri) {
    formData.append(fieldName, {
      uri: asset.uri,
      type: asset.mimeType || 'image/jpeg',
      name: asset.fileName || fallbackName,
    });
  }
}

export function imageExtensionFromAsset(asset) {
  const mime = (asset && (asset.mimeType || asset.file?.type)) || '';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  const uri = String(asset?.uri || '');
  const tail = uri.split('.').pop();
  if (tail && /^[a-z0-9]+$/i.test(tail.split('?')[0])) return tail.split('?')[0].toLowerCase();
  return 'jpg';
}
