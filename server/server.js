"use strict";

/**
 * server.js
 * =========
 * Servidor HTTP mínimo en Node.js para el TFG.
 *
 * Objetivo:
 *   Exponer un endpoint REST que permita generar el informe VIH completo
 *   para un paciente sintético, reutilizando:
 *     - Los ficheros JSON de /simulation/jsondata (patient_XX.json)
 *     - La lógica de negocio implementada en HIVResistanceCore (core.js)
 *
 * Este servidor NO forma parte del front-end del proyecto. Es un
 * "harness" técnico que se utilizará para:
 *   - Pruebas de rendimiento (con JMeter u otras herramientas)
 *   - Pruebas de integración extremo a extremo
 */

const http = require("http");   // Módulo nativo de Node para crear servidores HTTP
const fs = require("fs");       // Para leer ficheros del sistema
const path = require("path");   // Para construir rutas de forma portable
// IMPORTANTE: ya no usamos require("url"); ahora usamos la API WHATWG URL estándar

// Importamos el núcleo de la lógica de negocio del proyecto
// (el fichero src/core/core.js debe exportar HIVResistanceCore)
const { HIVResistanceCore } = require("../src/core/core.js");

// Puerto local en el que va a escuchar la API durante las pruebas
const PORT = 3003;

/**
 * loadPatientById
 * ---------------
 * Carga desde disco los datos sintéticos de un paciente a partir de su id.
 *
 * En la carpeta:
 *   /simulation/jsondata
 * existen ficheros del tipo:
 *   patient_76.json, patient_101.json, etc.
 *
 * @param {string|number} patId - Identificador del paciente (ej. "76")
 * @returns {Object|null}       - Objeto JSON del paciente o null si no existe
 */
function loadPatientById(patId) {
  // Construimos la ruta absoluta al fichero patient_{id}.json
  // Partimos de /server (__dirname) y subimos un nivel (..)
  const filePath = path.join(
    __dirname,
    "..",
    "simulation",
    "jsondata",
    `patient_${patId}.json`
  );

  // Si el fichero no existe, devolvemos null y que la API responda 404
  if (!fs.existsSync(filePath)) {
    return null;
  }

  // Leemos el contenido del fichero en formato texto (UTF-8)
  const raw = fs.readFileSync(filePath, "utf8");

  // Parseamos el texto JSON a objeto JavaScript
  return JSON.parse(raw);
}

/**
 * runFullAnalysis
 * ---------------
 * Función de orquestación "técnica" que encapsula el flujo completo
 * de análisis a partir de:
 *   - resistanceHistory (histórico de resistencias)
 *   - treatmentHistory  (histórico de tratamientos)
 *
 * Esta función NO vive en el core ni en la UI porque su misión principal
 * es facilitar las pruebas desde el servidor (renderizado del informe
 * sin pasar por el navegador).
 *
 * Pasos:
 *   1. Calcular el acumulado de mutaciones con HIVResistanceCore.buildAccumulatedResistanceHistory(...)
 *   2. Llamar al servicio Sierra/Stanford con HIVResistanceCore.callSierraService(...)
 *   3. Enriquecer la respuesta con el semáforo TARGA usando HIVResistanceCore.assignTargaSemaphore(...)
 *
 * @param {Array<Object>} resistanceHistory
 * @param {Array<Object>} treatmentHistory
 * @returns {Promise<Object>} Informe enriquecido o JSON de error
 */
async function runFullAnalysis(resistanceHistory, treatmentHistory) {
  // Paso 1: construir el acumulado de mutaciones a partir del histórico
  const accumulatedResult =
    HIVResistanceCore.buildAccumulatedResistanceHistory(resistanceHistory);

  // buildAccumulatedResistanceHistory suele devolver:
  //   { history, accumulated_mutations }
  // pero por robustez cogemos la propiedad si existe, o el resultado entero.
  const accumulated_mutations =
    accumulatedResult.accumulated_mutations || accumulatedResult;

  // Paso 2: llamada al servicio Sierra de Stanford con el acumulado
  const stanfordResponse =
    await HIVResistanceCore.callSierraService(accumulated_mutations);

  // Si la llamada ha devuelto un error (por ejemplo fallo de red),
  // devolvemos ese error tal cual para que la capa cliente pueda gestionarlo.
  if (stanfordResponse && stanfordResponse.error) {
    return stanfordResponse;
  }

  // Paso 3: enriquecer la respuesta con el semáforo TARGA y tratamientos activos
  const enriched =
    HIVResistanceCore.assignTargaSemaphore(stanfordResponse, treatmentHistory);

  return enriched;
}

/**
 * Creación del servidor HTTP
 * --------------------------
 * Para mantener el ejemplo sencillo y didáctico no se utiliza ningún
 * framework (como Express). Trabajamos directamente con el módulo http
 * de Node.js, que es suficiente para:
 *   - recibir peticiones GET
 *   - leer parámetros de la URL
 *   - devolver respuestas JSON
 *
 * IMPORTANTE:

 *
 *   En su lugar utilizamos la API WHATWG URL:
 *     const parsed = new URL(req.url, `http://${req.headers.host}`);
 *   que es más robusta y consistente entre clientes (Chrome, Firefox, JMeter...)
 */
const server = http.createServer(async (req, res) => {
  // Construimos un objeto URL estándar a partir de la URL de la petición.
  // El segundo parámetro es la "base" (obligatoria en Node) y depende de si usamos HTTP o HTTPS.
  // Aquí usamos HTTP puro:
  const parsed = new URL(req.url, `http://${req.headers.host}`);

  /**
   * ENDPOINT PRINCIPAL DEL TFG:
   *   GET /api/hiv-report?pat_id=76
   *
   * Recibe el identificador de un paciente sintético y devuelve
   * el informe VIH completo, construido a partir de:
   *   - patient_{id}.json (resistencias y tratamientos)
   *   - HIVResistanceCore (lógica de negocio)
   */
  if (req.method === "GET" && parsed.pathname === "/api/hiv-report") {
    // Con la API moderna, los parámetros se obtienen con searchParams:
    //   ?pat_id=76  → parsed.searchParams.get("pat_id")
    const patId = parsed.searchParams.get("pat_id"); // Ej.: "76"

    // Validación mínima: si no se envía pat_id se devuelve 400 (Bad Request)
    if (!patId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({ error: true, message: "Falta el parámetro pat_id" })
      );
    }

    // Cargamos los datos del paciente desde el JSON sintético
    const patient = loadPatientById(patId);

    // Si no existe el fichero para ese paciente, devolvemos 404 (Not Found)
    if (!patient) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          error: true,
          message: `Paciente con id ${patId} no encontrado en simulation/jsondata`
        })
      );
    }

    try {
      // El contrato asumido para patient_{id}.json incluye:
      //   - patient.resistance_history → Array de test de resistencias
      //   - patient.treatment_history  → Array de tratamientos TARGA
      const resistanceHistory = patient.resistance_history || [];
      const treatmentHistory = patient.treatment_history || [];

      // Ejecutamos el flujo completo de análisis sobre el paciente
      const result = await runFullAnalysis(resistanceHistory, treatmentHistory);

      // Respuesta correcta → 200 OK + informe en JSON
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(result));
    } catch (err) {
      // Cualquier excepción (error de lógica, fallo en la llamada HTTP, etc.)
      // provoca una respuesta 500 (Internal Server Error)
      console.error("Error en la API /api/hiv-report:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          error: true,
          message: err.message || "Error interno en el servidor"
        })
      );
    }
  }

  // Para cualquier otra ruta o método HTTP devolvemos 404 genérico
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: true, message: "Not found" }));
});

/**
 * Arranque del servidor
 * ---------------------
 * El servidor se ejecuta en localhost:3001.
 * Durante el desarrollo y las pruebas, se puede invocar por ejemplo:
 *   http://localhost:3001/api/hiv-report?pat_id=76
 *
 * donde "76" deberá corresponderse con un fichero real:
 *   /simulation/jsondata/patient_76.json
 */
server.listen(PORT, () => {
  console.log(
    `API de HIVResistanceCore escuchando en http://localhost:${PORT}/api/hiv-report?pat_id=76`
  );
});
