export interface UploadResult {
  url: string;
  path: string;
}

export type UploadPayload = Blob | ArrayBuffer | Uint8Array | string;

export interface StorageClient {
  uploadImage(file: UploadPayload, path: string): Promise<UploadResult>;
}

export const createStorage = (): StorageClient => {
  return {
    uploadImage: async (_file, path) => ({ url: "", path }),
  };
};
