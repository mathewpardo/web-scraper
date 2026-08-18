import assert from "node:assert/strict";
import test from "node:test";
import { extractFormState, applySearchCommand } from "../jsf";
import { parseDocuments, uniquenessId } from "../parser";

test("construye la solicitud JSF desde el formulario y botón especializado", () => {
  const html = `<form id="formBuscador" action="/search"><input name="javax.faces.ViewState" value="view"/><input name="formBuscador:txtBusqueda" value=""/><select name="formBuscador:buAnio"><option value="2025" selected>2025</option></select><input type="image" src="btn-buscar.png" name="formBuscador:j_idt69" onclick="mojarra.jsfcljs(this,{ 'forward':'buscar','sort':'DESC' },'')"/></form>`;
  const state = extractFormState(html, "https://example.test/home");
  applySearchCommand(html, state, { query: "civil", year: "2024" });
  assert.equal(state.action, "https://example.test/search");
  assert.equal(state.fields.get("javax.faces.ViewState"), "view");
  assert.equal(state.fields.get("formBuscador:txtBusqueda"), "civil");
  assert.equal(state.fields.get("formBuscador:buAnio"), "2024");
  assert.equal(state.fields.get("forward"), "buscar");
});

test("extrae filas y enlaces de PDF", () => {
  const html = `<table><tr><th>Expediente</th></tr><tr><td>123-2025</td><td>Sentencia civil</td><td><a href="/files/a.pdf">PDF</a></td></tr></table>`;
  const records = parseDocuments(html, "https://example.test/results", 1);
  assert.equal(records.length, 1);
  assert.equal(records[0].pdfUrl, "https://example.test/files/a.pdf");
  assert.match(records[0].uniquenessId, /^PE-PJ-123-2025-SENTENCIA-CIVIL-PDF$/);
  assert.equal(uniquenessId("Resolución Nº 10"), "PE-PJ-RESOLUCION-NO-10");
});
