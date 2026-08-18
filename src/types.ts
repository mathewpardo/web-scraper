export type Scalar = string | number | boolean | null;

export interface SearchOptions {
  query?: string;
  year?: string;
  limit: number;
  downloadPdfs: boolean;
  resume: boolean;
  outputDir: string;
}

export interface DocumentRecord {
  documentId: string;
  scrapedAt: string;
  page: number;
  fields: Record<string, Scalar>;
  detailUrl?: string;
  pdfUrl?: string;
  pdfPath?: string;
}

export interface FailureRecord {
  occurredAt: string;
  stage: "search" | "pagination" | "document" | "pdf";
  identifier: string;
  reason: string;
  status?: number;
  retryable: boolean;
}

export interface Checkpoint {
  completedPages: number[];
  completedDocumentIds: string[];
}

export interface FormState {
  action: string;
  fields: URLSearchParams;
}
