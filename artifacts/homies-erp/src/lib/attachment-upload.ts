export type AttachmentType = "facture" | "declaration" | "cni";

export type AttachmentFiles = Partial<Record<AttachmentType, File[]>>;

export function uploadAttachmentWithProgress(
  productId: number,
  file: File,
  type: AttachmentType,
  onProgress?: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      try {
        const payload = JSON.parse(xhr.responseText || "{}");
        reject(new Error(payload.error || "Erreur upload"));
      } catch {
        reject(new Error("Erreur upload"));
      }
    };

    xhr.onerror = () => reject(new Error("Erreur reseau pendant l'upload"));
    xhr.open("POST", `/api/attachments/products/${productId}`);
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

export async function uploadAttachmentFiles(
  productId: number,
  filesByType: AttachmentFiles,
  onProgress?: (key: string, percent: number) => void,
) {
  const uploads: Promise<void>[] = [];

  (Object.entries(filesByType) as [AttachmentType, File[] | undefined][]).forEach(([type, files]) => {
    (files ?? []).forEach((file, index) => {
      const key = `${type}-${index}-${file.name}`;
      uploads.push(uploadAttachmentWithProgress(productId, file, type, (percent) => onProgress?.(key, percent)));
    });
  });

  await Promise.all(uploads);
}
