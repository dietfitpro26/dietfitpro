/**
 * Compresse une image côté client. Cible : <= maxSizeKB (par défaut 300 Ko).
 * Utilisé pour les uploads de photos repas / progression.
 */
export async function compressImage(file: File, maxSizeKB = 300): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(file);

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const maxWidth = 1200;
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.9;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              URL.revokeObjectURL(url);
              return resolve(file);
            }
            if (blob.size / 1024 <= maxSizeKB || quality <= 0.1) {
              URL.revokeObjectURL(url);
              resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
            } else {
              quality -= 0.1;
              tryCompress();
            }
          },
          "image/jpeg",
          quality,
        );
      };
      tryCompress();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
