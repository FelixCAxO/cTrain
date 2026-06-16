import * as vscode from 'vscode';
import { createTrainingFileStore } from './fileSystemProvider';

export class CodeTrainerFileSystemProvider implements vscode.FileSystemProvider {
  private readonly store = createTrainingFileStore();
  private readonly emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();

  public readonly onDidChangeFile = this.emitter.event;

  public seed(uri: vscode.Uri, content: string): void {
    this.store.seed(uri.toString(), content);
    this.emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  public stat(uri: vscode.Uri): vscode.FileStat {
    const stat = this.store.stat(uri.toString());
    return {
      type: vscode.FileType.File,
      ctime: stat.ctime,
      mtime: stat.mtime,
      size: stat.size
    };
  }

  public readFile(uri: vscode.Uri): Uint8Array {
    try {
      return this.store.readFile(uri.toString());
    } catch {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
  }

  public writeFile(uri: vscode.Uri, content: Uint8Array): void {
    this.store.writeFile(uri.toString(), content);
    this.emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  public readDirectory(): [string, vscode.FileType][] {
    return [];
  }

  public createDirectory(): void {
    return;
  }

  public delete(uri: vscode.Uri): void {
    this.store.delete(uri.toString());
    this.emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
  }

  public rename(oldUri: vscode.Uri, newUri: vscode.Uri): void {
    this.store.rename(oldUri.toString(), newUri.toString());
    this.emitter.fire([
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri }
    ]);
  }

  public watch(): vscode.Disposable {
    return new vscode.Disposable(() => undefined);
  }
}
