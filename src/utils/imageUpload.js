export const MAX_SOURCE_IMAGE_BYTES = 75 * 1024 * 1024;
export const IMAGE_FILE_ACCEPT = 'image/*,.heic,.heif';
const MAX_STORED_IMAGE_BYTES = 450 * 1024;

export const isSupportedImageFile = (file) => Boolean(file) && (
  String(file.type || '').toLowerCase().startsWith('image/')
  || /\.(?:jpe?g|jfif|png|webp|gif|bmp|avif|svg|heic|heif)$/i.test(String(file.name || ''))
);

const readBlobAsDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('The prepared image could not be read.'));
  reader.readAsDataURL(blob);
});

const loadDrawable = (blob) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('Browser decoder rejected the image.'));
  };
  image.src = objectUrl;
});

const normalizeHeic = async (file) => {
  const { default: heic2any } = await import('heic2any');
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!(blob instanceof Blob)) throw new Error('HEIC conversion produced no image.');
  return blob;
};

const decodeImage = async (file) => {
  try {
    return await loadDrawable(file);
  } catch {
    // WhatsApp/iPhone downloads can have a .jpeg filename while their actual
    // bytes are HEIC/HEIF. A conversion attempt is safe for both explicit HEIC
    // files and mislabeled images; unsupported data is rejected afterwards.
    return loadDrawable(await normalizeHeic(file));
  }
};

export const prepareImageFile = async (file) => {
  if (!isSupportedImageFile(file)) throw new Error(`${file?.name || 'This file'} is not an image.`);
  if (!file.size) throw new Error(`${file.name} is empty. Please choose the original image again.`);
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error(`${file.name} is larger than 75 MB. Export or resend it at a smaller size.`);

  let image;
  try {
    image = await decodeImage(file);
  } catch {
    throw new Error(`${file.name} is damaged or uses an unsupported camera format. Resend it as a photo, JPEG or PNG.`);
  }

  const scale = Math.min(1, 1800 / image.naturalWidth, 2200 / image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error(`${file.name} could not be processed by this browser.`);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const encode = (quality) => new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error(`${file.name} could not be converted.`));
      if (blob.size > MAX_STORED_IMAGE_BYTES && quality > 0.45) return resolve(encode(quality - 0.08));
      try { return resolve(await readBlobAsDataUrl(blob)); } catch (error) { return reject(error); }
    }, 'image/jpeg', quality);
  });
  return encode(0.86);
};
