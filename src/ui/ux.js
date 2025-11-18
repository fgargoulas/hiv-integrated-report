

// ==========================================================================================
//  ux.js  —  Módulo UX para pintar los elementos visuales del informe
// ==========================================================================================

(function () {

  // -------------------------------------------------
  // 🔒 FUNCIÓN PRIVADA: calcular tiempo entre fechas
  // -------------------------------------------------
  function calculateTimeDiff(fromDate, toDate = new Date()) {
    try {
      const start = new Date(fromDate);
      const end = new Date(toDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { years: null, months: null, days: null, label: "-" };
      }

      let years = end.getFullYear() - start.getFullYear();
      let months = end.getMonth() - start.getMonth();
      let days = end.getDate() - start.getDate();

      if (days < 0) {
        months--;
        const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
        days += prevMonth.getDate();
      }

      if (months < 0) {
        years--;
        months += 12;
      }

      let label;
      if (years > 0)       label = `${years} año${years > 1 ? "s" : ""}`;
      else if (months > 0) label = `${months} mes${months > 1 ? "es" : ""}`;
      else                 label = `${days} día${days > 1 ? "s" : ""}`;

      return { years, months, days, label };

    } catch (e) {
      console.error("Error en calculateTimeDiff()", e);
      return { years: null, months: null, days: null, label: "-" };
    }
  }

  // ===============================================
  //  NAMESPACE GLOBAL PÚBLICO DE UX
  // ===============================================

  window.HIVResistanceUX = window.HIVResistanceUX || {};

  // ------------------------------------------------------
  //  MÉTODO PÚBLICO: UX_patientData()
  // ------------------------------------------------------

   /**
     * Función para calcular el conjunto acumulado de mutaciones únicas por gen,
     * eliminando duplicados y ordenando por el número del codón.
     *
     * @param {<Object>} pat_data  Objeto Json con los datos del paciente
     * @param {<Object>} appconfig Objeto con los parámetros estáticos de la aplicación
     */

  HIVResistanceUX.UX_patientData = function (pat_data, appconfig) {


        //asignamos los valore a las constantes dentro de la función
    const {
        mrn,
        national_health_id,
        full_name,
        sex,
        birth_date,
        hiv_type,
        hiv_date,
        hla_b57: {
          value: hlaValue = null,
          date: hlaDate = null
        } = {}
      } = pat_data;


    //normalizamos valores
    let hlaText = null;
    if (hlaValue) {
      hlaText = `${hlaValue}`;
      if (hlaDate) {
        hlaText += ` (${hlaDate})`;
      }
    }
    const sexText = sex === "M" ? "Hombre" : sex === "F" ? "Mujer"  :"Desconocido";

    // Cálculos de tiempo usando la función privada
    const actualAge       = calculateTimeDiff(birth_date).label;
    const diagAge  = calculateTimeDiff(birth_date, hiv_date).label;
    const timeHIV     = calculateTimeDiff(hiv_date).label;

    //configuramos logos
    const upImg   = document.getElementById("logo_up");
    const downImg = document.getElementById("logo_down");

    const upLink   = document.getElementById("logo_up_link");
    const downLink = document.getElementById("logo_down_link");

    if (!upImg || !downImg || !upLink || !downLink) {
      console.warn("UX_loadBranding: elementos de logos no encontrados");
      return;
    }

    // Logo superior
    if (appconfig.logo_up?.img) {
      upImg.src = appconfig.logo_up.img;
    }
    if (appconfig.logo_up?.link) {
      upLink.href = appconfig.logo_up.link;
    } else {
      upLink.removeAttribute("href");   // sin link → imagen no clicable
    }

    // Logo inferior
    if (appconfig.logo_down?.img) {
      downImg.src = appconfig.logo_down.img;
    }
    if (APP_CONFIG.logo_down?.link) {
      downLink.href = appconfig.logo_down.link;
    } else {
      downLink.removeAttribute("href");
    }
  

    //1) nombre del paciente
    
    document.getElementById("patientbox_name").textContent =    full_name || "Paciente sin nombre";
    // 2) Identificadores le damos formato si vienen rellenados o no
    const identifiers = [
      mrn
        ? `<label class="patient-label">NHC:</label> <span class="patient-value">${mrn}</span>`
        : null,
      national_health_id
        ? `<label class="patient-label">CIP:</label> <span class="patient-value">${national_health_id}</span>`
        : null
  ]
  .filter(Boolean)
  .join(" · ");

    document.getElementById("patientbox_identifiers").innerHTML = identifiers;

    // 2) Identificadores datos demográficos

    const infoDemo = [
    pat_data.birth_date ? `<label class="patient-label">Nacimiento:</label> <span class="patient-value"> ${birth_date}</span>` : null,
    actualAge ? `<label class="patient-label">Edad actual:</label> <span class="patient-value"> ${actualAge}</span>` : null,
    pat_data.sex ? `<label class="patient-label">Sexo Biológico:</label> <span class="patient-value"> ${sexText}</span>` : `<label class="patient-label">Sexo Biológico:</label><span class="patient-value">Desconocido</span>` 
    ].filter(Boolean).join(" · ");
    
    document.getElementById("patientbox_info_dem").innerHTML = infoDemo;

    // 3) datos HIV 1 linea
    const infoHIV= [
      hiv_date ? `<label class="patient-label">Diagnóstico VIH:</label> <span class="patient-value"> ${hiv_date}</span>` : 'Desconocido',
      diagAge ? `<label class="patient-label">Edad al diagnóstico:</label> <span class="patient-value"> ${diagAge}</span>` : null,
      timeHIV ? `<label class="patient-label">Tiempo con VIH:</label> <span class="patient-value"> ${timeHIV}</span>` : null,
    ].filter(Boolean).join(" · ");

    document.getElementById("patientbox_info_hiv").innerHTML = infoHIV;

    // 4) datos HIV 2 linea
    const infoHIV2 = [
      hiv_type ? `<label class="patient-label">Tipo VIH:</label> <span class="patient-value"> ${hiv_type}</span>` : `<label class="patient-label">Tipo VIH:</label><span class="patient-value">Desconocido</span>`,
      hlaText  ? `<label class="patient-label">HLA-B*57</label> <span class="patient-value">${hlaText}</span>` : null,
    ].filter(Boolean).join(" · ");

    document.getElementById("patientbox_info_hiv2").innerHTML = infoHIV2;


    //  5) Info institución 
    if (appconfig) {
      const institutionText = [
        appconfig.center_name,
        appconfig.department_name
      ]
        .filter(Boolean)
        .join(" · ");

    document.getElementById("institution_info").textContent = institutionText;
  }

  };

})(); 
