import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { SETTINGS } from "./settings";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class HttpClient {
  private readonly client: AxiosInstance;
  private lastRequestAt = 0;

  constructor() {
    this.client = axios.create({
      timeout: SETTINGS.requestTimeoutMs,
      maxRedirects: 0,
      validateStatus: () => true,
      headers: { "User-Agent": SETTINGS.userAgent, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    });
  }

  async request(config: AxiosRequestConfig): Promise<{ data: string | Buffer; status: number; headers: Record<string, unknown>; url: string }> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < SETTINGS.minRequestDelayMs) await delay(SETTINGS.minRequestDelayMs - elapsed);
    this.lastRequestAt = Date.now();
    const response = await this.client.request<Buffer>({ ...config, responseType: "arraybuffer", headers: { ...config.headers, Cookie: this.cookieHeader() } });
    this.captureCookies(response.headers["set-cookie"]);
    const location = response.headers.location as string | undefined;
    if (response.status >= 300 && response.status < 400 && location) {
      const redirect = new URL(location, config.url).toString().replace(/^http:\/\/jurisprudencia\.pj\.gob\.pe/i, "https://jurisprudencia.pj.gob.pe");
      return this.request({ method: "GET", url: redirect, responseType: config.responseType });
    }
    const data = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);
    return { data, status: response.status, headers: response.headers as Record<string, unknown>, url: response.config.url ?? String(config.url) };
  }

  async getHtml(url: string): Promise<{ html: string; url: string }> {
    const result = await this.request({ method: "GET", url });
    if (result.status >= 400) throw httpError(result.status, `GET ${url}`);
    return { html: Buffer.from(result.data).toString("utf8"), url: result.url };
  }

  async postForm(url: string, fields: URLSearchParams): Promise<{ html: string; url: string }> {
    const result = await this.request({ method: "POST", url, data: fields.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: `${SETTINGS.baseUrl}${SETTINGS.initialPath}` } });
    if (result.status >= 400) throw httpError(result.status, `POST ${url}`);
    return { html: Buffer.from(result.data).toString("utf8"), url: result.url };
  }

  async postPartialForm(url: string, fields: URLSearchParams): Promise<{ xml: string; url: string }> {
    const result = await this.request({ method: "POST", url, data: fields.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded", "Faces-Request": "partial/ajax", Accept: "application/xml, text/xml, */*; q=0.01" } });
    if (result.status >= 400) throw httpError(result.status, `POST ${url}`);
    return { xml: Buffer.from(result.data).toString("utf8"), url: result.url };
  }

  async download(url: string): Promise<{ body: Buffer; headers: Record<string, unknown> }> {
    const result = await this.request({ method: "GET", url, responseType: "arraybuffer" });
    if (result.status >= 400) throw httpError(result.status, `GET ${url}`, result.headers);
    return { body: Buffer.from(result.data), headers: result.headers };
  }

  private readonly cookies = new Map<string, string>();

  private captureCookies(header: string | string[] | undefined): void {
    for (const cookie of header ? (Array.isArray(header) ? header : [header]) : []) {
      const first = cookie.split(";", 1)[0];
      const separator = first.indexOf("=");
      if (separator > 0) this.cookies.set(first.slice(0, separator), first.slice(separator + 1));
    }
  }

  private cookieHeader(): string {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

export function httpError(status: number, context: string, headers: Record<string, unknown> = {}): Error & { status: number; headers: Record<string, unknown> } {
  return Object.assign(new Error(`${context} returned HTTP ${status}`), { status, headers });
}

export async function withPdfRetries<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < SETTINGS.pdfRetries; attempt += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      const status = (error as { status?: number }).status;
      if (status !== 429 || attempt === SETTINGS.pdfRetries - 1) throw error;
      const retryAfter = Number((error as { headers?: Record<string, unknown> }).headers?.["retry-after"]);
      const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1_000 : SETTINGS.pdfBackoffBaseMs * 2 ** attempt + Math.floor(Math.random() * 500);
      await delay(waitMs);
    }
  }
  throw lastError;
}
