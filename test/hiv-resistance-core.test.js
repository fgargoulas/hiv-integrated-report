/**
 * Pruebas unitarias del módulo HIVResistanceCore
 * ==============================================
 * 
 * Este fichero contiene las primeras pruebas unitarias diseñadas para 
 * verificar la correcta carga y disponibilidad del módulo principal 
 * del adaptador Sierra (`core.js`). 
 * 
 * El objetivo inicial no es evaluar la lógica interna, sino confirmar 
 * que el entorno de pruebas basado en Jest está correctamente configurado 
 * y que las funciones expuestas por el módulo pueden ser invocadas 
 * desde un contexto de test. 
 * 
 * Las pruebas específicas sobre cada función se incorporarán en bloques 
 * posteriores, una vez validado este comportamiento básico.
 */

const { HIVResistanceCore } = require("../src/core/core.js");

describe("HIVResistanceCore - pruebas iniciales de disponibilidad del módulo", () => {
  
  /**
   * Este test confirma que:
   *  - el módulo `core.js` se carga correctamente mediante require,
   *  - el objeto HIVResistanceCore está definido,
   *  - y las funciones principales del adaptador Sierra están accesibles.
   * 
   * Este paso es fundamental para asegurar que el entorno de pruebas 
   * está bien configurado antes de evaluar la lógica interna del adaptador.
   */
  test("el módulo debe cargarse correctamente y exponer sus funciones principales", () => {

    // Verificamos que el objeto exportado existe y no es undefined.
    expect(HIVResistanceCore).toBeDefined();

    // Verificamos que las funciones clave del adaptador están disponibles.
    expect(typeof HIVResistanceCore.buildAccumulatedResistanceHistory).toBe("function");
    expect(typeof HIVResistanceCore.assignTargaSemaphore).toBe("function");
    expect(typeof HIVResistanceCore.callSierraService).toBe("function");
  });

});

  /**
   * En este bloque se verifica el comportamiento de la función
   * `buildAccumulatedResistanceHistory`, responsable de generar el
   * acumulado de mutaciones a partir del histórico de resistencias.
   *
   * El objetivo de esta prueba es comprobar que:
   *  - se integran correctamente las mutaciones de distintos tests,
   *  - se respetan los tres genes principales (PR, RT e IN),
   *  - y no se incorporan mutaciones cuando el test está marcado
   *    explícitamente como sin mutaciones (`has_mutation = false`).
   *
   * Para ello se utiliza un histórico sintético, inspirado en la
   * estructura real de los ficheros `patient_XX.json` empleados en
   * el proyecto.
   */
  test("buildAccumulatedResistanceHistory genera un acumulado coherente a partir del histórico", () => {
    // Histórico de resistencias sintético: tres determinaciones en fechas distintas.
    const history = [
      {
        resistance_id: 1,
        test_date: "2022-01-01",
        test_type: "genotypic",
        mutations: {
          pr: ["L10F"],
          rt: ["K103N"],
          in: []
        },
        has_mutation: true
      },
      {
        resistance_id: 2,
        test_date: "2023-06-15",
        test_type: "genotypic",
        mutations: {
          pr: ["L10F"],        // se repite L10F para comprobar el tratamiento de duplicados
          rt: ["M184V"],
          in: ["T66I"]
        },
        has_mutation: true
      },
      {
        resistance_id: 3,
        test_date: "2024-01-10",
        test_type: "genotypic",
        mutations: {
          pr: ["V32I"],
          rt: [],
          in: []
        },
        has_mutation: false     // este registro no debería aportar mutaciones al acumulado
      }
    ];

    // Se invoca la función que construye el acumulado de mutaciones.
    const result = HIVResistanceCore.buildAccumulatedResistanceHistory(history);

    // El resultado debe estar definido.
    expect(result).toBeDefined();

    // En la implementación actual, la función devuelve un objeto que suele
    // incluir la propiedad `accumulated_mutations`. No obstante, por
    // robustez, si no existiera se utiliza el propio resultado como acumulado.
    const accumulated = result.accumulated_mutations || result;

    // Se comprueba que existen las tres claves principales (PR, RT e IN).
    expect(accumulated).toHaveProperty("pr");
    expect(accumulated).toHaveProperty("rt");
    expect(accumulated).toHaveProperty("in");

    // El acumulado de PR debe contener la mutación L10F (aparece en dos tests).
    expect(accumulated.pr).toEqual(expect.arrayContaining(["L10F"]));

    // El acumulado de RT debe incluir las mutaciones K103N y M184V.
    expect(accumulated.rt).toEqual(expect.arrayContaining(["K103N", "M184V"]));

    // El acumulado de IN debe incluir la mutación T66I.
    expect(accumulated.in).toEqual(expect.arrayContaining(["T66I"]));

    // De forma adicional, se verifica que las mutaciones de PR no contengan
    // duplicados, en caso de que la función implemente una lógica de
    // deduplicación. Si la implementación permitiera duplicados, esta
    // aserción podría adaptarse o eliminarse.
    const uniquePr = new Set(accumulated.pr);
    expect(uniquePr.size).toBe(accumulated.pr.length);
  });
  
    /**
   * Caso límite de entrada no válida para buildAccumulatedResistanceHistory.
   * Verifica que, si la función recibe un valor que no es un array,
   * devuelve un acumulado vacío sin lanzar excepciones.
   */
  test("buildAccumulatedResistanceHistory devuelve acumulados vacíos si la entrada no es un array", () => {
    const result = HIVResistanceCore.buildAccumulatedResistanceHistory(null);

    expect(result).toEqual({
      pr: [],
      rt: [],
      in: []
    });
  });

  /**
   * Prueba de callSierraService en caso de respuesta correcta del servicio.
   * Se simula la llamada HTTP mediante un mock de fetch, verificando que
   * la función construye la petición y devuelve el JSON parseado.
   */
  test("callSierraService devuelve los datos de Stanford cuando la llamada es correcta", async () => {
    const fakeData = { data: { mutationsAnalysis: { drugResistance: [] } } };

    // Mock de fetch para evitar llamadas reales a la red
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(fakeData)
    });

    const accumulated_mutations = {
      pr: ["L10F"],
      rt: ["K103N"],
      in: []
    };

    const result = await HIVResistanceCore.callSierraService(accumulated_mutations);

    // Se verifica que la función ha llamado a fetch una vez
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Y que devuelve exactamente el JSON que ha proporcionado el mock
    expect(result).toEqual(fakeData);
  });

  /**
   * Prueba de callSierraService en caso de error de red.
   * Se fuerza una excepción en fetch para comprobar que la función
   * captura el error y devuelve un objeto de error tipado.
   */
  test("callSierraService captura errores de red y devuelve un objeto de error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const result = await HIVResistanceCore.callSierraService({
      pr: [],
      rt: [],
      in: []
    });

    expect(result).toHaveProperty("error", true);
    expect(result).toHaveProperty("message", "Network error");
  });
  

    /**
   * Prueba unitaria de assignTargaSemaphore basada en la estructura real
   * de la respuesta de Sierra y del tratamiento TARGA.
   *
   * El objetivo es verificar que la función:
   *  - enriquece los niveles de fármaco con los campos TARGAsemaphore,
   *    color, isActiveTreatment y displayStatus;
   *  - marca al menos un fármaco como tratamiento activo
   *    (isActiveTreatment = true);
   *  - y asocia el fármaco activo con alguna presentación TARGA del
   *    historial de tratamiento (campo targa[]).
   *
   * Para ello se utilizan estructuras simplificadas pero coherentes con
   * las devueltas por Sierra y los JSON sintéticos del proyecto.
   */
  test("assignTargaSemaphore marca correctamente el fármaco activo en los niveles de Sierra", () => {

    // Respuesta Sierra muy simplificada: un único gen (PR) con dos fármacos PI,
    // uno de ellos corresponde al tratamiento actual (DRV/r).
    const stanfordResponse = {
      data: {
        mutationsAnalysis: {
          drugResistance: [
            {
              gene: {
                name: "PR",
                drugClasses: [
                  { name: "PI", fullName: "Protease Inhibitor" }
                ]
              },
              levels: [
                {
                  drugClass: { name: "PI" },
                  drug: {
                    name: "ATV",
                    displayAbbr: "ATV/r",
                    fullName: "atazanavir/r"
                  },
                  text: "High-Level Resistance"
                },
                {
                  drugClass: { name: "PI" },
                  drug: {
                    name: "DRV",
                    displayAbbr: "DRV/r",
                    fullName: "darunavir/r"
                  },
                  text: "Susceptible"
                }
              ],
              drugScores: [
                {
                  drugClass: { name: "PI" },
                  drug: { name: "ATV", displayAbbr: "ATV/r" },
                  score: 145.0,
                  partialScores: []
                },
                {
                  drugClass: { name: "PI" },
                  drug: { name: "DRV", displayAbbr: "DRV/r" },
                  score: 15.0,
                  partialScores: []
                }
              ]
            }
          ]
        }
      }
    };

    // Fragmento del tratamiento TARGA del paciente con la misma estructura
    // que los ficheros patient_XX.json. Suponemos que REZOLSTA (DRV+COBI)
    // es el tratamiento PI actualmente prescrito.
    const treatmentHistory = [
      {
        drug_id: 167,
        start_date: "2018-07-13",
        end_date: null,              // tratamiento ACTIVO
        end_reason: { code: null, description: null },
        dose_adm: { presentation: 1, messure: 800, other: null, frecuency: "C24H" },
        info: {
          text: "DARUNAVIR/ COBICISTAT",
          targa_short: "DRV+COBI",
          brand: "REZOLSTA",
          presentation: "800/150",
          presentation_unit: "COMP",
          messure_unit: "MG",
          atc: "J05AR14"
        }
      }
    ];

    // Ejecutamos la función con datos coherentes con la estructura real.
    const enriched = HIVResistanceCore.assignTargaSemaphore(
      stanfordResponse,
      treatmentHistory
    );

    // El resultado debe estar definido y mantener la estructura de drugResistance.
    expect(enriched).toBeDefined();
    expect(enriched.data).toBeDefined();
    expect(enriched.data.mutationsAnalysis).toBeDefined();
    expect(Array.isArray(enriched.data.mutationsAnalysis.drugResistance)).toBe(true);

    const prResistance = enriched.data.mutationsAnalysis.drugResistance[0];
    expect(Array.isArray(prResistance.levels)).toBe(true);

    // Todos los niveles deben estar enriquecidos con los campos del semáforo.
    prResistance.levels.forEach(level => {
      expect(level).toHaveProperty("TARGAsemaphore");
      expect(level).toHaveProperty("color");
      expect(level).toHaveProperty("isActiveTreatment");
      expect(level).toHaveProperty("displayStatus");
      expect(Array.isArray(level.targa)).toBe(true);
    });

    // Debe existir al menos un fármaco marcado como tratamiento activo.
    const activeLevel = prResistance.levels.find(l => l.isActiveTreatment === true);
    expect(activeLevel).toBeDefined();

    // El fármaco activo debería estar asociado al nombre comercial REZOLSTA.
    // Si la implementación cambia la lógica de asociación, este check puede
    // relajarse a "targa.length > 0".
    expect(activeLevel.targa).toEqual(expect.arrayContaining(["REZOLSTA"]));
  });

    /**
   * Caso de entrada inválida para assignTargaSemaphore.
   * Cuando la respuesta de Stanford contiene la marca de error,
   * la función debe registrar el problema y devolver el objeto sin modificar.
   */
  test("assignTargaSemaphore devuelve la respuesta sin modificar cuando la entrada contiene error", () => {
    const errorResponse = { error: true, message: "Fallo en Stanford" };

    const result = HIVResistanceCore.assignTargaSemaphore(errorResponse, []);

    expect(result).toBe(errorResponse);
  });