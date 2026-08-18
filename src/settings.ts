export const SETTINGS = {
  baseUrl: "https://jurisprudencia.pj.gob.pe",
  initialPath: "/jurisprudenciaweb/faces/page/inicio.xhtml",
  requestTimeoutMs: 45_000,
  minRequestDelayMs: 1_200,
  pdfRetries: 5,
  pdfBackoffBaseMs: 2_000,
  userAgent: "Mozilla/5.0 (compatible; PJPeruScraperChallenge/1.0; +https://github.com/mathewpardo/web-scraper)",
} as const;
