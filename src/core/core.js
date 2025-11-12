
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
   */
   async callSierraService(accumulated_mutations) {
    const url_stanford = "https://hivdb.stanford.edu/graphql";

    // Aplana todas las mutaciones en un solo array
    const mutStandford = []
      .concat(accumulated_mutations?.pr ?? [])
      .concat(accumulated_mutations?.rt ?? [])
      .concat(accumulated_mutations?.in ?? []);

    // Construcción del body GraphQL
    const json_stanfordRequest = {
        operationName: "MutationsAnalysis",
        query:"query MutationsAnalysis($mutations: [String]!, $algorithm: ASIAlgorithm) {\n  currentVersion {\n    text\n    publishDate\n  }\n  currentProgramVersion {\n    text\n    publishDate\n  }\n  mutationsAnalysis(mutations: $mutations) {\n    ...HIVDBReportByMutations\n  }\n}\n\nfragment HIVDBReportByMutations on MutationsAnalysis {\n  validationResults {\n    level\n    message\n  }\n  drugResistance(algorithm: $algorithm) {\n    algorithm {\n      family\n      version\n      publishDate\n    }\n    gene {\n      name\n      drugClasses {\n        name\n        fullName\n      }\n    }\n    levels: drugScores {\n      drugClass {\n        name\n      }\n      drug {\n        name\n        displayAbbr\n        fullName\n      }\n      text\n    }\n    mutationsByTypes {\n      mutationType\n      mutations {\n        text\n        isUnsequenced\n      }\n    }\n    commentsByTypes {\n      commentType\n      comments {\n        name\n        text\n        highlightText\n      }\n    }\n    drugScores {\n      drugClass {\n        name\n      }\n      drug {\n        name\n        displayAbbr\n      }\n      score\n      partialScores {\n        mutations {\n          text\n        }\n        score\n      }\n    }\n  }\n}\n",
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
  }
};