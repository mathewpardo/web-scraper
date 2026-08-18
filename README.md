# Web Scraper — Jurisprudencia PJ Perú

Scraper HTTP en TypeScript para el portal de [Jurisprudencia del Poder Judicial del Perú](https://jurisprudencia.pj.gob.pe/jurisprudenciaweb/faces/page/resultado.xhtml). No utiliza Puppeteer, Playwright, Selenium ni ningún navegador automatizado.

El portal está construido con JavaServer Faces (JSF/RichFaces). El proyecto mantiene la cookie de sesión, obtiene el `javax.faces.ViewState`, envía el formulario de búsqueda y sigue las respuestas HTTP y redirecciones HTTPS.

## Requisitos

- Node.js 20 o superior.
- Acceso de red/VPN a Perú cuando el portal lo requiera.
- Respetar los términos de uso del sitio y ejecutar cargas moderadas.

## Instalación y uso

```bash
npm install
npm run typecheck
npm run dev -- --limit 10
```

`--limit 10` es el modo seguro por defecto. Para recorrer el catálogo completo se debe usar explícitamente `--limit 0`; la ejecución puede durar mucho tiempo.

Opciones disponibles:

```text
--limit <n>             Máximo de documentos; 0 significa sin límite (por defecto: 10)
--query <texto>         Texto para la búsqueda del portal
--year <AAAA>           Año de resolución
--no-download-pdfs      Extrae metadatos sin descargar PDFs
--resume                Reanuda desde output/checkpoint.json
--output-dir <ruta>     Directorio de salida (por defecto: output)
```

Si no se indica `--query`, se usa `civil` como búsqueda de demostración reproducible. Para una cobertura histórica se debe ejecutar una o varias consultas definidas por el alcance requerido y usar `--resume` entre ejecuciones.

Ejemplo de reanudación:

```bash
npm run dev -- --limit 0 --resume --output-dir output
```

## Salida

- `output/documents.jsonl`: un registro JSON por documento con los campos publicados, identificador estable, enlaces y ruta local del PDF.
- `output/failures.jsonl`: errores por documento para reprocesarlos posteriormente.
- `output/checkpoint.json`: páginas y documentos completados para reanudar sin duplicar registros.
- `output/pdfs/`: PDFs descargados con un nombre descriptivo y seguro.

El directorio de salida está excluido de Git para no publicar datos descargados, cookies ni archivos voluminosos.

## Rate limiting y resiliencia

El scraper espera al menos 1,2 segundos entre solicitudes y procesa PDFs uno por uno. Para HTTP 429, utiliza `Retry-After` cuando el servidor lo entrega; en caso contrario reintenta cinco veces con backoff exponencial de 2, 4, 8, 16 y 32 segundos, más un pequeño jitter. Si no se recupera, registra el fallo en JSONL y continúa con el siguiente documento.

Los errores de detalle, parsing o PDF se aíslan por documento. Errores de sesión, formulario o paginación se muestran como fallo de ejecución para evitar declarar una cobertura incompleta como exitosa.

## Desarrollo y validación

```bash
npm test
npm run build
npm start -- --limit 10
```

Las pruebas cubren la construcción de solicitudes JSF, extracción de filas/enlaces y normalización de identificadores. Antes de una ejecución completa, validar una búsqueda limitada con VPN y revisar `documents.jsonl` y `failures.jsonl`.
