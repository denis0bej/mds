export type AvatarCropSettings = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export const DEFAULT_AVATAR_CROP: AvatarCropSettings = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

export const AVATAR_OUTPUT_SIZE = 256;

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!file.type.match(/^image\/(jpeg|png|jpg)$/i) && !file.name.match(/\.(jpe?g|png)$/i)) {
      reject(new Error("Please select a JPG or PNG image."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load the selected image."));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

export function renderCircularAvatar(
  image: HTMLImageElement,
  settings: AvatarCropSettings,
  outputSize = AVATAR_OUTPUT_SIZE,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const { scale, offsetX, offsetY } = settings;
  const imgW = image.naturalWidth;
  const imgH = image.naturalHeight;
  const baseScale = Math.max(outputSize / imgW, outputSize / imgH);
  const drawScale = baseScale * scale;
  const drawW = imgW * drawScale;
  const drawH = imgH * drawScale;

  const maxOffsetX = Math.max(0, (drawW - outputSize) / 2);
  const maxOffsetY = Math.max(0, (drawH - outputSize) / 2);
  const x = (outputSize - drawW) / 2 - offsetX * maxOffsetX;
  const y = (outputSize - drawH) / 2 - offsetY * maxOffsetY;

  ctx.beginPath();
  ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, x, y, drawW, drawH);

  return canvas.toDataURL("image/jpeg", 0.9);
}
