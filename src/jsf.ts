import * as cheerio from "cheerio";
import { FormState } from "./types";

export function extractFormState(html: string, pageUrl: string): FormState {
  const $ = cheerio.load(html);
  const form = $("form#formBuscador");
  if (!form.length) throw new Error("No se encontró el formulario formBuscador; el portal pudo haber cambiado.");
  const fields = new URLSearchParams();
  form.find("input, select, textarea").each((_, element) => {
    const input = $(element);
    const name = input.attr("name");
    if (!name || input.is(":disabled")) return;
    const type = (input.attr("type") ?? "").toLowerCase();
    if (["submit", "button", "image", "reset", "file"].includes(type)) return;
    if (["checkbox", "radio"].includes(type) && !input.is(":checked")) return;
    const value = input.is("select") ? input.find("option:selected").attr("value") ?? "" : input.val()?.toString() ?? "";
    fields.set(name, value);
  });
  fields.set("formBuscador", "formBuscador");
  const action = new URL(form.attr("action") ?? pageUrl, pageUrl).toString();
  return { action, fields };
}

export function applySearchCommand(html: string, form: FormState, options: { query?: string; year?: string }): void {
  const $ = cheerio.load(html);
  if (options.query) form.fields.set("formBuscador:txtBusqueda", options.query);
  if (options.year) form.fields.set("formBuscador:buAnio", options.year);
  const searchButton = $("input[src*='btn-buscar']").first();
  if (!searchButton.length) throw new Error("No se encontró el botón de búsqueda general.");
  const command = searchButton.attr("onclick") ?? "";
  for (const match of command.matchAll(/\\?'([^']+)\\?'\s*:\s*\\?'([^']*)\\?'/g)) {
    form.fields.set(match[1].replace(/\\$/, ""), match[2].replace(/\\$/, ""));
  }
  const name = searchButton.attr("name");
  if (name) form.fields.set(name, name);
  if (!form.fields.get("forward")) form.fields.set("forward", "buscar");
  if (!form.fields.get("busqueda")) form.fields.set("busqueda", "especializada");
}

export function extractNextPage(html: string, pageUrl: string): string | undefined {
  const $ = cheerio.load(html);
  const labels = ["siguiente", "next", ">"];
  const anchor = $("a").filter((_, el) => labels.includes($(el).text().trim().toLowerCase())).first();
  const href = anchor.attr("href");
  return href && href !== "#" ? new URL(href, pageUrl).toString() : undefined;
}

export function buildPageRequest(html: string, pageUrl: string, page: number): FormState | undefined {
  const $ = cheerio.load(html);
  if (!$("#formBuscador\\:data1").length) return undefined;
  const form = extractFormState(html, pageUrl);
  form.fields.set("javax.faces.partial.ajax", "true");
  form.fields.set("javax.faces.source", "formBuscador:data1");
  form.fields.set("javax.faces.partial.execute", "@all");
  form.fields.set("javax.faces.partial.event", "click");
  form.fields.set("org.richfaces.ajax.component", "formBuscador:data1");
  form.fields.set("formBuscador:data1", "formBuscador:data1");
  form.fields.set("formBuscador:data1:page", String(page));
  return form;
}

export function extractPartialHtml(xml: string): string {
  const $ = cheerio.load(xml, { xmlMode: true });
  const chunks = $("update").map((_, update) => $(update).text()).get();
  if (!chunks.length) throw new Error("La respuesta AJAX de JSF no incluyó actualizaciones.");
  return chunks.join("\n");
}

export function mergePartialResponse(pageHtml: string, xml: string): string {
  const page = cheerio.load(pageHtml);
  const response = cheerio.load(xml, { xmlMode: true });
  const updates = response("update");
  const viewState = updates.filter((_, update) => response(update).attr("id") === "javax.faces.ViewState").first().text();
  if (viewState) page("input[name='javax.faces.ViewState']").attr("value", viewState);
  const resultMarkup = updates.filter((_, update) => response(update).attr("id") === "formBuscador:panel").first().text();
  if (!resultMarkup) throw new Error("La respuesta AJAX no actualizó los resultados de búsqueda.");
  page("#formBuscador\\:panel").replaceWith(resultMarkup);
  return page.html();
}
