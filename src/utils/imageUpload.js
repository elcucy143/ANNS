export const MAX_SOURCE_IMAGE_BYTES = 75 * 1024 * 1024;
export const IMAGE_FILE_ACCEPT = 'image/*,.jpg,.jpeg,.jfif,.png,.webp,.gif,.bmp,.avif,.svg,.heic,.heif';
const MAX_STORED_IMAGE_BYTES = 450 * 1024;
const MAX_PASSTHROUGH_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_SERVER_NORMALIZE_BYTES = 3.5 * 1024 * 1024;

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

const detectImageType = async (file) => {
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const ascii = String.fromCharCode(...bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && ascii.slice(1, 4) === 'PNG') return 'image/png';
  if (ascii.slice(0, 4) === 'RIFF' && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  if (ascii.slice(0, 6) === 'GIF87a' || ascii.slice(0, 6) === 'GIF89a') return 'image/gif';
  if (ascii.slice(0, 2) === 'BM') return 'image/bmp';
  if (ascii.slice(4, 8) === 'ftyp') {
    const brand = ascii.slice(8, 16).toLowerCase();
    if (brand.includes('avif') || brand.includes('avis')) return 'image/avif';
    if (/heic|heix|hevc|hevx|mif1|msf1/.test(brand)) return 'image/heic';
  }
  const prefix = new TextDecoder().decode(bytes).trimStart().toLowerCase();
  if (prefix.startsWith('<svg') || prefix.startsWith('<?xml')) return 'image/svg+xml';
  return '';
};

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

const loadDrawableFromDataUrl = async (blob) => {
  const dataUrl = await readBlobAsDataUrl(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Browser data decoder rejected the image.'));
    image.src = dataUrl;
  });
};

const loadImageBitmap = async (blob) => {
  if (typeof createImageBitmap !== 'function') throw new Error('Image bitmap decoding is unavailable.');
  return createImageBitmap(blob, { imageOrientation: 'from-image' });
};

const loadJpegWithJavascript = async (blob) => {
  const module = await import('jpeg-js');
  const decode = module.decode || module.default?.decode;
  if (typeof decode !== 'function') throw new Error('JPEG fallback decoder is unavailable.');
  const decoded = decode(new Uint8Array(await blob.arrayBuffer()), {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: 80,
    maxMemoryUsageInMB: 256,
  });
  if (!decoded?.width || !decoded?.height || !decoded?.data) throw new Error('JPEG fallback decoder found no pixels.');
  const canvas = document.createElement('canvas');
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('JPEG fallback canvas is unavailable.');
  const pixels = decoded.data instanceof Uint8ClampedArray ? decoded.data : new Uint8ClampedArray(decoded.data);
  context.putImageData(new ImageData(pixels, decoded.width, decoded.height), 0, 0);
  return canvas;
};

const normalizeHeic = async (file) => {
  const { default: heic2any } = await import('heic2any');
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  if (!(blob instanceof Blob)) throw new Error('HEIC conversion produced no image.');
  return blob;
};

const decodeImage = async (file) => {
  const detectedType = await detectImageType(file);
  const normalizedFile = detectedType && detectedType !== file.type
    ? new Blob([file], { type: detectedType })
    : file;
  for (const decoder of [loadDrawable, loadDrawableFromDataUrl, loadImageBitmap]) {
    try {
      return await decoder(normalizedFile);
    } catch {
      // Try the next browser decoding path.
    }
  }
  if (detectedType === 'image/jpeg' || String(file.type || '').toLowerCase() === 'image/jpeg' || /\.jpe?g$/i.test(file.name || '')) {
    try {
      return await loadJpegWithJavascript(normalizedFile);
    } catch {
      // Continue to HEIC conversion for mislabeled camera files.
    }
  }
  // WhatsApp/iPhone downloads can have a .jpeg filename while their actual
  // bytes are HEIC/HEIF. Convert those before declaring the file unreadable.
  return loadDrawable(await normalizeHeic(normalizedFile));
};

const drawableWidth = (image) => image.naturalWidth || image.width || 0;
const drawableHeight = (image) => image.naturalHeight || image.height || 0;

export const prepareImageFile = async (file, serverNormalizer) => {
  if (!isSupportedImageFile(file)) throw new Error(`${file?.name || 'This file'} is not an image.`);
  if (!file.size) throw new Error(`${file.name} is empty. Please choose the original image again.`);
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error(`${file.name} is larger than 75 MB. Export or resend it at a smaller size.`);

  let image;
  try {
    image = await decodeImage(file);
  } catch {
    if (typeof serverNormalizer === 'function' && file.size <= MAX_SERVER_NORMALIZE_BYTES) {
      return serverNormalizer(file, 'image');
    }
    // Review screenshots received through WhatsApp are occasionally wrapped in
    // a way Safari cannot decode locally. Preserve their original bytes so the
    // admin can still save them instead of blocking the workflow. The small
    // ceiling keeps the MongoDB/API document safely below platform limits.
    if (file.size <= MAX_PASSTHROUGH_IMAGE_BYTES) {
      const detectedType = await detectImageType(file);
      return readBlobAsDataUrl(new Blob([file], { type: detectedType || file.type || 'image/jpeg' }));
    }
    throw new Error(`${file.name} could not be compressed by this browser. Send the original file under 2 MB or export it once as JPEG/PNG.`);
  }

  const width = drawableWidth(image);
  const height = drawableHeight(image);
  if (!width || !height) throw new Error(`${file.name} has no readable image dimensions.`);
  const scale = Math.min(1, 1800 / width, 2200 / height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
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

export const prepareBannerImageFile = async (file, serverNormalizer) => {
  if (!isSupportedImageFile(file)) throw new Error(`${file?.name || 'This file'} is not an image.`);
  if (!file.size) throw new Error(`${file.name} is empty. Please choose the original image again.`);
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error(`${file.name} is larger than 75 MB. Export or resend it at a smaller size.`);

  let image;
  try {
    image = await decodeImage(file);
  } catch {
    // Some WhatsApp, camera and design-tool JPEGs use colour profiles or
    // wrappers Chrome cannot decode. Use the API's Sharp decoder as a safe
    // fallback instead of asking the admin to re-export the image.
    if (typeof serverNormalizer === 'function' && file.size <= MAX_SERVER_NORMALIZE_BYTES) {
      return serverNormalizer(file, 'banner');
    }
    throw new Error(`${file.name} could not be decoded. Choose the original image file (up to 75 MB) and try again.`);
  }

  const width = drawableWidth(image);
  const height = drawableHeight(image);
  if (!width || !height) throw new Error(`${file.name} has no readable image dimensions.`);
  const scale = Math.min(1, 2400 / width, 1400 / height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error(`${file.name} could not be processed by this browser.`);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const maximumBytes = 850 * 1024;
  const encode = (quality) => new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error(`${file.name} could not be converted.`));
      if (blob.size > maximumBytes && quality > 0.5) return resolve(encode(quality - 0.07));
      try { return resolve(await readBlobAsDataUrl(blob)); } catch (error) { return reject(error); }
    }, 'image/jpeg', quality);
  });
  return encode(0.9);
};
