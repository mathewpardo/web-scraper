import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Checkpoint, FailureRecord } from "./types";

export class Storage {
  readonly documentsFile: string;
  readonly failuresFile: string;
  readonly checkpointFile: string;
  readonly pdfDirectory: string;

  constructor(readonly outputDirectory: string) {
    this.documentsFile = join(outputDirectory, "documents.jsonl");
    this.failuresFile = join(outputDirectory, "failures.jsonl");
    this.checkpointFile = join(outputDirectory, "checkpoint.json");
    this.pdfDirectory = join(outputDirectory, "pdfs");
  }

  async initialize(): Promise<void> {
    await Promise.all([mkdir(this.outputDirectory, { recursive: true }), mkdir(this.pdfDirectory, { recursive: true })]);
  }

  async appendDocument(value: unknown): Promise<void> {
    await appendFile(this.documentsFile, `${JSON.stringify(value)}\n`, "utf8");
  }

  async logFailure(value: FailureRecord): Promise<void> {
    await appendFile(this.failuresFile, `${JSON.stringify(value)}\n`, "utf8");
  }

  async loadCheckpoint(): Promise<Checkpoint> {
    try {
      return JSON.parse(await readFile(this.checkpointFile, "utf8")) as Checkpoint;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { completedPages: [], completedDocumentIds: [] };
      throw error;
    }
  }

  async saveCheckpoint(value: Checkpoint): Promise<void> {
    const temporary = `${this.checkpointFile}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, this.checkpointFile);
  }

  pdfFile(name: string): string {
    return join(this.pdfDirectory, `${safeFilename(name)}.pdf`);
  }
}

export function safeFilename(value: string): string {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 150) || "document";
}

export function relativePdfPath(outputDirectory: string, file: string): string {
  return file.slice(dirname(outputDirectory).length + 1).replaceAll("\\", "/");
}
