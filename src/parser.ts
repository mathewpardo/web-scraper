import * as cheerio from "cheerio";
import { DocumentRecord, Scalar } from "./types";

const normalize = (value: string) => repairEncoding(value.replace(/\s+/g, " ").trim());

function repairEncoding(value: string): string {
  return /[ÃÂ]/.test(value) ? Buffer.from(value, "latin1").toString("utf8") : value;
}

export function parseDocuments(html: string, pageUrl: string, page: number): DocumentRecord[] {
  const $ = cheerio.load(html);
  const panels = $("div[id^='formBuscador:repeat:'][id$='j_idt455']");
  if (panels.length) {
    const records: DocumentRecord[] = [];
    panels.each((_, panel) => {
      const fields: Record<string, Scalar> = {};
      const header = $(panel).find("table").first().find("td span").map((__, item) => normalize($(item).text())).get().filter(Boolean);
      if (header[0]) fields.recurso = header[0];
      if (header[1]) fields.expediente = header[1];
      $(panel).find(".txtbold").each((__, label) => {
        const key = normalize($(label).text()).replace(/:$/, "");
        const value = normalize($(label).next().text());
        if (key && value) fields[key] = value;
      });
      const downloadHref = $(panel).find("a[href*='ServletDescarga']").attr("href");
      if (!fields.expediente || !downloadHref) return;
      records.push({ uniquenessId: uniquenessId(`${fields.expediente}-${fields["Fecha Resolución"] ?? ""}`), scrapedAt: new Date().toISOString(), page, fields, pdfUrl: new URL(downloadHref, pageUrl).toString() });
    });
    return dedupe(records);
  }
  const rows = $("table tr").filter((_, row) => $(row).find("td").length >= 2);
  const output: DocumentRecord[] = [];
  rows.each((_, row) => {
    const cells = $(row).find("td");
    const fields: Record<string, Scalar> = {};
    cells.each((index, cell) => {
      const text = normalize($(cell).text());
      if (text) fields[`column${index + 1}`] = text;
    });
    if (Object.keys(fields).length < 2) return;
    const links = $(row).find("a");
    const hrefs = links.map((__, link) => $(link).attr("href")).get().filter((href): href is string => Boolean(href) && href !== "#");
    const absolute = hrefs.map((href) => new URL(href, pageUrl).toString());
    const pdfUrl = absolute.find((url) => /(?:\.pdf(?:$|[?#])|ServletDescarga)/i.test(url));
    const detailUrl = absolute.find((url) => url !== pdfUrl);
    const businessKey = Object.values(fields).join("-").slice(0, 180);
    output.push({
      uniquenessId: uniquenessId(businessKey), scrapedAt: new Date().toISOString(), page, fields, detailUrl, pdfUrl,
    });
  });
  return dedupe(output);
}

export function extractPdfUrl(html: string, pageUrl: string): string | undefined {
  const $ = cheerio.load(html);
  const href = $("a[href]").map((_, link) => $(link).attr("href")).get().find((value) => value && /\.pdf(?:$|[?#])/i.test(value));
  return href ? new URL(href, pageUrl).toString() : undefined;
}

export function uniquenessId(value: string): string {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `PE-PJ-${normalized || "UNKNOWN"}`.slice(0, 200);
}

function dedupe(records: DocumentRecord[]): DocumentRecord[] {
  return [...new Map(records.map((record) => [record.uniquenessId, record])).values()];
}
