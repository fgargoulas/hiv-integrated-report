
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
    

    // ✅ Añadir el resultado al propio objeto
    return { history: resistanceHistory, accumulated_mutations: accumulated };
    }

};