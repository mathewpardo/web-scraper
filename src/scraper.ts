import { writeFile } from "node:fs/promises";
import { HttpClient, withPdfRetries } from "./httpClient";
import { applySearchCommand, buildPageRequest, extractFormState, extractNextPage, mergePartialResponse } from "./jsf";
import { extractPdfUrl, parseDocuments } from "./parser";
import { SETTINGS } from "./settings";
import { Storage } from "./storage";
import { Checkpoint, DocumentRecord, FailureRecord, SearchOptions } from "./types";

export class PjScraper {
  private readonly http = new HttpClient();
  private readonly storage: Storage;
  constructor(private readonly options: SearchOptions) { this.storage = new Storage(options.outputDir); }

  async run(): Promise<void> {
    await this.storage.initialize();
    const checkpoint = this.options.resume ? await this.storage.loadCheckpoint() : { completedPages: [], completedDocumentIds: [] };
    const initial = await this.http.getHtml(`${SETTINGS.baseUrl}${SETTINGS.initialPath}`);
    const form = extractFormState(initial.html, initial.url);
    applySearchCommand(initial.html, form, this.options);
    let current = await this.http.postForm(form.action, form.fields);
    let page = 1;
    let processed = 0;
    while (true) {
      const documents = parseDocuments(current.html, current.url, page);
      if (!documents.length) throw new Error("La búsqueda no produjo filas reconocibles. Revise los selectores JSF del portal.");
      for (const document of documents) {
        if (checkpoint.completedDocumentIds.includes(document.uniquenessId)) continue;
        if (this.options.limit > 0 && processed >= this.options.limit) return;
        await this.processDocument(document);
        checkpoint.completedDocumentIds.push(document.uniquenessId);
        await this.storage.saveCheckpoint(checkpoint);
        processed += 1;
      }
      checkpoint.completedPages.push(page);
      await this.storage.saveCheckpoint(checkpoint);
      if (this.options.limit > 0 && processed >= this.options.limit) return;
      page += 1;
      const next = extractNextPage(current.html, current.url);
      if (next) { current = await this.http.getHtml(next); continue; }
      const partial = buildPageRequest(current.html, current.url, page);
      if (!partial) return;
      const response = await this.http.postPartialForm(partial.action, partial.fields);
      current = { html: mergePartialResponse(current.html, response.xml), url: response.url };
    }
  }

  private async processDocument(document: DocumentRecord): Promise<void> {
    try {
      if (!document.pdfUrl && document.detailUrl) {
        const detail = await this.http.getHtml(document.detailUrl);
        document.pdfUrl = extractPdfUrl(detail.html, detail.url);
      }
      if (this.options.downloadPdfs && document.pdfUrl) {
        try {
          const downloaded = await withPdfRetries(() => this.http.download(document.pdfUrl!));
          const destination = this.storage.pdfFile(document.uniquenessId);
          await writeFile(destination, downloaded.body);
          document.pdfPath = destination;
        } catch (error) {
          await this.failure("pdf", document.uniquenessId, error);
        }
      }
      await this.storage.appendDocument(document);
    } catch (error) { await this.failure("document", document.uniquenessId, error); }
  }

  private async failure(stage: FailureRecord["stage"], identifier: string, error: unknown): Promise<void> {
    const typed = error as { message?: string; status?: number };
    await this.storage.logFailure({ occurredAt: new Date().toISOString(), stage, identifier, reason: typed.message ?? String(error), status: typed.status, retryable: typed.status === 429 || !typed.status || typed.status >= 500 });
  }
}
