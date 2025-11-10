// simulation/searcher/simulator.js

document.addEventListener("DOMContentLoaded", () => {
    const SUMMARY_URL = "./simulation/jsondata/patient-sumary.json";
    const PATIENT_DETAIL_BASE_URL = "./simulation/jsondata";

    const form = document.getElementById("patientSearchForm");
    const searchInput = document.getElementById("patientSearchInput");
    const caseFilter = document.getElementById("patientCaseFilter");
    const patientSelect = document.getElementById("patientResultSelect");
    const loadingIndicator = document.getElementById("loadingIndicator");
    const resultMessage = document.getElementById("resultMessage");

    const CASE_TYPE_MAP = {
        "Basal_Low": "Caso Basal <=3mut",
        "Basal_High": "Caso Basal >3mut",
        "Complex_Low": "Caso Complejo <=3mut",
        "Complex_High": "Caso Complejo >3mut",
        "Complex_Failure": "Caso Complejo Fallo TARGA"
    };

    let patientSummary = [];

    // --- Utilidades --------------------------------------------------------

    const normalize = (str) => {
        return (str || "")
            .toString()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .trim();
    };

    const clearSessionPatientData = () => {
        sessionStorage.setItem("patientdata", JSON.stringify({}));
        sessionStorage.setItem("resistance_history", JSON.stringify([]));
        sessionStorage.setItem("treatment_history", JSON.stringify([]));
    };

    const showMessage = (html, type = "info") => {
        resultMessage.innerHTML = `<div class="alert alert-${type}" role="alert">${html}</div>`;
    };

    const showLoading = (isLoading) => {
        if (isLoading) {
            loadingIndicator.classList.remove("d-none");
        } else {
            loadingIndicator.classList.add("d-none");
        }
    };

    // --- Carga del sumario --------------------------------------------------

    const loadPatientSummary = async () => {
        if (patientSummary.length > 0) return;

        const response = await fetch(SUMMARY_URL);
        if (!response.ok) {
            throw new Error(`No se pudo cargar patient-sumary.json (${response.status})`);
        }
        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Formato inesperado en patient-sumary.json");
        }
        patientSummary = data;
    };

    // --- Rellenar el select dinámico ---------------------------------------

    const updatePatientOptions = () => {
        if (patientSummary.length === 0) {
            // Aún no cargado
            return;
        }

        const term = (searchInput.value || "").trim();
        const normalizedTerm = normalize(term);
        const caseValue = caseFilter.value || "";
        const expectedCaseType = caseValue ? CASE_TYPE_MAP[caseValue] || null : null;

        // Limpiar select
        patientSelect.innerHTML = "";

        const matches = patientSummary.filter((p) => {
            // Filtro por tipo de caso
            if (expectedCaseType && p.case_type !== expectedCaseType) {
                return false;
            }

            if (!term) {
                // Si no hay término, mostramos todos los del tipo seleccionado (o todos)
                return true;
            }

            const idMatches = p.patient_id.includes(term);
            const nameMatches = normalize(p.full_name).includes(normalizedTerm);

            return idMatches || nameMatches;
        });

        if (matches.length === 0) {
            const opt = document.createElement("option");
            opt.disabled = true;
            opt.textContent = "Sin coincidencias";
            patientSelect.appendChild(opt);
            return;
        }

        matches.forEach((p) => {
            const opt = document.createElement("option");
            opt.value = p.patient_id;
            opt.textContent = `${p.patient_id} - ${p.full_name} (${p.case_type})`;
            patientSelect.appendChild(opt);
        });

        // Dejar seleccionado el primero
        patientSelect.selectedIndex = 0;
    };

    // --- Carga del JSON concreto del paciente ------------------------------

    const loadPatientDetailIntoSession = async (patientId) => {
        const url = `${PATIENT_DETAIL_BASE_URL}/patient_${patientId}.json`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(
                `No se pudo cargar el detalle del paciente ${patientId} (${response.status})`
            );
        }

        const data = await response.json();

        const patData = data.pat_data || {};
        const resistanceHistory = Array.isArray(data.resistance_history)
            ? data.resistance_history
            : [];
        const treatmentHistory = Array.isArray(data.treatment_history)
            ? data.treatment_history
            : [];

        //se cargan los datos en el sessionStorage para pasarlo al report.html
        sessionStorage.setItem("patientdata", JSON.stringify(patData));
        sessionStorage.setItem("resistance_history", JSON.stringify(resistanceHistory));
        sessionStorage.setItem("treatment_history", JSON.stringify(treatmentHistory));


    };

    // --- Eventos -----------------------------------------------------------

    // Al teclear en el buscador: actualizar coincidencias
    searchInput.addEventListener("input", () => {
        updatePatientOptions();
    });

    // Al cambiar el filtro de caso: actualizar coincidencias
    caseFilter.addEventListener("change", () => {
        updatePatientOptions();
    });

    // Envío del formulario: cargar el paciente seleccionado
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        resultMessage.innerHTML = "";

        const selectedOption = patientSelect.value;

        if (!selectedOption) {
            showMessage(
                "Debes seleccionar un paciente del listado de coincidencias.",
                "warning"
            );
            return;
        }

        showLoading(true);

        try {
            await loadPatientDetailIntoSession(selectedOption);

            showMessage(
                `
                Paciente <strong>${selectedOption}</strong> cargado correctamente en la sesión.
                <br>
                Los objetos <code>patientdata</code>, <code>resistance_history</code> y 
                <code>treatment_history</code> están disponibles en <code>sessionStorage</code>.
                `,
                "success"
            );
            window.location.href = `report.html?patientId=${selectedOption}`;
        } catch (error) {
            console.error(error);
            clearSessionPatientData();
            showMessage(
                "Se ha producido un error al cargar los datos del paciente. Revisa la consola.",
                "danger"
            );
        } finally {
            showLoading(false);
        }
    });

    // Inicialización
    (async () => {
        clearSessionPatientData();
        try {
            await loadPatientSummary();
            // Al inicio mostramos todos (sin término y sin filtro → todo)
            updatePatientOptions();
        } catch (error) {
            console.error(error);
            showMessage(
                "No se pudieron cargar los datos de pacientes sintéticos.",
                "danger"
            );
        }
    })();
});
