import { resolve } from "node:path";
import { PjScraper } from "./scraper";
import { SearchOptions } from "./types";

function optionsFromArgs(args: string[]): SearchOptions {
  const value = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  if (args.includes("--help")) {
    console.log("Uso: npm run dev -- [--limit 10] [--query texto] [--year AAAA] [--no-download-pdfs] [--resume] [--output-dir ruta]");
    process.exit(0);
  }
  const limit = Number(value("--limit") ?? "10");
  if (!Number.isInteger(limit) || limit < 0) throw new Error("--limit debe ser un entero igual o mayor a cero.");
  return {
    query: value("--query") ?? "civil", year: value("--year"), limit,
    downloadPdfs: !args.includes("--no-download-pdfs"), resume: args.includes("--resume"),
    outputDir: resolve(value("--output-dir") ?? "output"),
  };
}

async function main(): Promise<void> {
  const options = optionsFromArgs(process.argv.slice(2));
  console.log(`Iniciando PJ Perú: límite=${options.limit === 0 ? "sin límite" : options.limit}, PDFs=${options.downloadPdfs ? "sí" : "no"}`);
  await new PjScraper(options).run();
  console.log("Ejecución finalizada.");
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
