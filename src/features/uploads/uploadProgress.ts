import { Message } from "../../lib/types";

export interface UploadProgressItem {
  id: string;
  fileName: string;
  progress: number;
  type: "image" | "video" | "file";
}

const resolveUploadType = (file: File): UploadProgressItem["type"] => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "file";
};

export const createUploadProgressItem = (id: string, file: File): UploadProgressItem => ({
  id,
  fileName: file.name,
  progress: 0,
  type: resolveUploadType(file)
});

export const buildUploadId = () => `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const canOpenMessageFile = (message: Message) => Boolean(message.fileURL);
