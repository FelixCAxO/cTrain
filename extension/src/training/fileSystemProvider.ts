import { lessonIdFromUriString } from '../contentProvider';

export interface TrainingFileStore {
  seed(uri: string, content: string): void;
  readFile(uri: string): Uint8Array;
  writeFile(uri: string, content: Uint8Array): void;
  delete(uri: string): void;
  rename(oldUri: string, newUri: string): void;
  stat(uri: string): { ctime: number; mtime: number; size: number };
}

export function createTrainingFileStore(): TrainingFileStore {
  const files = new Map<string, Uint8Array>();

  return {
    seed(uri: string, content: string): void {
      files.set(uri, Buffer.from(content, 'utf8'));
    },

    readFile(uri: string): Uint8Array {
      const bytes = files.get(uri);
      if (bytes === undefined) {
        throw new Error(`File not found: ${uri}`);
      }

      return bytes;
    },

    writeFile(uri: string, content: Uint8Array): void {
      lessonIdFromUriString(uri);
      files.set(uri, content);
    },

    delete(uri: string): void {
      files.delete(uri);
    },

    rename(oldUri: string, newUri: string): void {
      const bytes = this.readFile(oldUri);
      lessonIdFromUriString(newUri);
      files.set(newUri, bytes);
      files.delete(oldUri);
    },

    stat(uri: string): { ctime: number; mtime: number; size: number } {
      const bytes = this.readFile(uri);
      return {
        ctime: 0,
        mtime: Date.now(),
        size: bytes.byteLength
      };
    }
  };
}
