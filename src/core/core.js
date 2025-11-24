
const HIVResistanceCore = {
    /**
     * Función para calcular el conjunto acumulado de mutaciones únicas por gen,
     * eliminando duplicados y ordenando por el número del codón.
     *
     * @param {Array<Object>} resistanceHistory  Array con los tests de resistencias.
     * @returns {Object}  { pr: string[], rt: string[], in: string[] } con mutaciones ordenadas.
     */
    buildAccumulatedResistanceHistory(resistanceHistory) {
    if (!Array.isArray(resistanceHistory)) {
        return { pr: [], rt: [], in: [] };
    }

    const acc = { pr: new Set(), rt: new Set(), in: new Set() };

    for (const entry of resistanceHistory) {
        if (!entry || typeof entry !== "object") continue;

        const mutations = entry.mutations || {};

        const prMut = Array.isArray(mutations.pr) ? mutations.pr : [];
        const rtMut = Array.isArray(mutations.rt) ? mutations.rt : [];
        const inMut = Array.isArray(mutations.in) ? mutations.in : [];

        prMut.filter(Boolean).forEach(m => acc.pr.add(m));
        rtMut.filter(Boolean).forEach(m => acc.rt.add(m));
        inMut.filter(Boolean).forEach(m => acc.in.add(m));
    }

    // Función auxiliar para extraer número del codón (ej. “M41L” → 41)
    const codonNumber = m => {
        const match = m.match(/\d+/);
        return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
    };

    // Ordenamos cada array por número de codón ascendente
    const sortByCodon = set =>
        Array.from(set).sort((a, b) => codonNumber(a) - codonNumber(b));

     const accumulated =  {
        pr: sortByCodon(acc.pr),
        rt: sortByCodon(acc.rt),
        in: sortByCodon(acc.in)
    };
    
    //creamos el objeto final con el histórico y el acumulado.
    return { history: resistanceHistory, accumulated_mutations: accumulated };
    },


   /**
   * Función core que llama al servicio de Standform y envía las mutaciones acumuladas 
   * y devuelve el JSON de respuesta.
   *     
   * @param {Array<Object>} accumulated_mutations  Array con el acumulado de mutaciones.
   * @returns {Object}  JSON devuelto por el servicio de Standford.
   */
   async callSierraService(accumulated_mutations) {
    const url_stanford = "https://hivdb.stanford.edu/graphql";

    //Normaliza las mutaciones acumuladas al formato que requiere standford 
    //Aplana todas las mutaciones en un solo array en el formato que requiere el servicio sierra
    //(...)spread operator aplana el contenido dle array y para cada array a cada elemento le pone el prefijo correspondiente
        const mutStandford = [
        ...(Array.isArray(accumulated_mutations?.pr)
            ? accumulated_mutations.pr.map(m => `PR:${m}`)
            : []),
        ...(Array.isArray(accumulated_mutations?.rt)
            ? accumulated_mutations.rt.map(m => `RT:${m}`)
            : []),
        ...(Array.isArray(accumulated_mutations?.in)
            ? accumulated_mutations.in.map(m => `IN:${m}`)
            : [])
        ];

    // Construcción del body GraphQL
    const json_stanfordRequest = {
        operationName: "MutationsAnalysis",
        query:"query MutationsAnalysis($mutations: [String]!, $algorithm: ASIAlgorithm) {\n  currentVersion {\n    text\n    publishDate\n  }\n  currentProgramVersion {\n    text\n    publishDate\n  }\n  mutationsAnalysis(mutations: $mutations) {\n    ...HIVDBReportByMutations\n  }\n}\n\nfragment HIVDBReportByMutations on MutationsAnalysis {\n  validationResults {\n    level\n    message\n  }\n  drugResistance(algorithm: $algorithm) {\n    algorithm {\n      family\n      version\n      publishDate\n    }\n    gene {\n      name\n      drugClasses {\n        name\n        fullName\n      }\n    }\n    levels: drugScores {\n      drugClass {\n        name\n      }\n      drug {\n        name\n        displayAbbr\n        fullName\n      }\n      text\n    }\n    mutationsByTypes {\n      mutationType\n      mutations {\n        text\n        isUnsequenced\n  isUnusual\n isDRM\n isApobecMutation\n     }\n    }\n    commentsByTypes {\n      commentType\n      comments {\n        name\n        text\n        highlightText\n      }\n    }\n    drugScores {\n      drugClass {\n        name\n      }\n      drug {\n        name\n        displayAbbr\n      }\n      score\n      partialScores {\n        mutations {\n          text\n        }\n        score\n      }\n    }\n  }\n}\n",
        variables: { mutations: mutStandford }
    };

    try {
      const response = await fetch(url_stanford, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json_stanfordRequest)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      return data; // devuelve directamente la respuesta de Stanford

    } catch (err) {
      console.error("Error llamando a Stanford:", err);
      return { error: true, message: err.message };
    }
  },

  /**
   * Función crítica del core: Normaliza la salida de Stanford, la enriquece con el Semáforo TARGA 
   * (color, estado activo y nombres de fármacos prescritos coincidentes).
   *
   * @param {Object} stanfordResponse - JSON de respuesta RAW del servicio Sierra.
   * @param {Array<Object>} treatmentHistory - Histórico de tratamientos del paciente (JSON Contrato).
   * @returns {Object} stanfordResponse - El JSON de Stanford modificado y enriquecido.
   */
  assignTargaSemaphore(stanfordResponse, treatmentHistory) {

    if (!stanfordResponse || !treatmentHistory || stanfordResponse.error) {
        console.error("assignTargaSemaphore: Datos de entrada inválidos.");
        return stanfordResponse;
    }

    // 1. Diccionario de mapeo de niveles de resistencia a colores (RF7)
    // Se añade el color hexadecimal para la capa UI
    const SEMAPHORE_MAPPING = {
        "Susceptible": { name: "VERDE", color: "#28a745" }, // Verde
        "Low-Level Resistance": { name: "AZUL", color: "#17a2b8" }, // Azul (Moderada/Baja)
        "Potential Low-Level Resistance": { name: "AZUL", color: "#17a2b8" },
        "Intermediate-Level Resistance": { name: "AMARILLO", color: "#ffc107" }, // Amarillo
        "High-Level Resistance": { name: "ROJO", color: "#dc3545" }, // Rojo
        "No Resistance": { name: "VERDE", color: "#28a745" }, 
    };
    
    const DEFAULT_SEMAPHORE = { name: "GRIS", color: "#6c757d" }; // Gris para fallo o desconocido

    // 2. Identificar abreviaturas y nombres de tratamientos activos
    // Estructura para almacenar { abreviatura: [nombre_completo1, nombre_completo2, ...] }
    const activeDrugDetails = new Map();
    
    // Filtrar tratamientos activos (end_date es null o no existe)
    const activeTreatments = treatmentHistory.filter(tx => 
        !tx.end_date || tx.end_date === null
    );

    activeTreatments.forEach(tx => {
        const targaShort = tx.info?.targa_short;
        const brandName = tx.info?.brand || tx.info?.text; // Usar marca o texto completo
        
        if (targaShort && brandName) {
            // Dividir por '+' para manejar combinaciones (ej. "DRV+COBI")
            targaShort.split('+').forEach(abbr => {
                const cleanedAbbr = abbr.trim().toUpperCase();
                if (cleanedAbbr) {
                    if (!activeDrugDetails.has(cleanedAbbr)) {
                        activeDrugDetails.set(cleanedAbbr, new Set());
                    }
                    activeDrugDetails.get(cleanedAbbr).add(brandName);
                }
            });
        }
    });

    // Función auxiliar para comparar abreviaturas (ej. 'DRV' vs 'DRV/r')
    const matchAbbreviation = (stanfordAbbr, activeAbbrMap) => {
        if (!stanfordAbbr) return null;
        
        const stanfordUpper = stanfordAbbr.toUpperCase();
        
        // 1. Intentar coincidir con la abreviatura exacta de Stanford
        if (activeAbbrMap.has(stanfordUpper)) {
            return stanfordUpper;
        }

        // 2. Limpiar el displayAbbr de Stanford (ej. 'DRV/r' -> 'DRV') y buscar
        const cleanStanfordAbbr = stanfordUpper.replace(/\/R|\/C/g, ''); // Ignorar /R o /C
        if (activeAbbrMap.has(cleanStanfordAbbr)) {
            return cleanStanfordAbbr;
        }

        return null;
    };


    // 3. Iterar y mutar la respuesta de Stanford con el semáforo y estado activo
    const drugResistanceBlocks = stanfordResponse.data?.mutationsAnalysis?.drugResistance;

    if (Array.isArray(drugResistanceBlocks)) {
        for (const block of drugResistanceBlocks) {
            if (Array.isArray(block.levels)) {
                for (const level of block.levels) {
                    // Mapear el texto de resistencia a un color de semáforo
                    const resistanceText = level.text || "No Resistance";
                    const semaphore = SEMAPHORE_MAPPING[resistanceText] || DEFAULT_SEMAPHORE;
                    
                    // Añadir nombre y color
                    level.TARGAsemaphore = semaphore.name;
                    level.color = semaphore.color; 

                    // Comprobar si es un tratamiento activo
                    const stanfordDisplayAbbr = level.drug?.displayAbbr;
                    const matchedAbbr = matchAbbreviation(stanfordDisplayAbbr, activeDrugDetails);

                    level.isActiveTreatment = !!matchedAbbr;
                    
                    // Añadir detalle de los fármacos coincidentes (RF7)
                    if (matchedAbbr) {
                        level.displayStatus = "PRESCRIBED";
                        // Convertir el Set de nombres de fármacos a Array para el JSON de salida
                        level.targa = Array.from(activeDrugDetails.get(matchedAbbr)); 
                    } else {
                        level.displayStatus = "INACTIVE";
                        level.targa = [];
                    }
                }
            }
        }
    }

    return stanfordResponse;
  }


};