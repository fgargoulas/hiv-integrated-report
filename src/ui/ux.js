

// ==========================================================================================
//  ux.js  —  Módulo UX para pintar los elementos visuales del informe
// ==========================================================================================

(function () {

  // -------------------------------------------------
  // calculateTimeDiff: calcular tiempo entre fechas
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

  // -------------------------------------------------
  // getBaseMutation: Devuelve la "base" de la mutación: K103N -> K103, M36I -> M36
  // -------------------------------------------------

  function getBaseMutation(code) {
    if (!code) return '';

    // Casos tipo 69Insertion u otros especiales: los dejamos tal cual
    if (/Insertion$/i.test(code)) return code;

    if (code.length > 2) {
      return code.slice(0, -1); // quitamos la última letra
    }
    return code;
  }

  // -------------------------------------------------
  // extractCodonNumberFromCode: Extrae el número de codón para ordenar: "K103" -> 103
  // -------------------------------------------------

  function extractCodonNumberFromCode(code) {
  if (!code) return Number.MAX_SAFE_INTEGER;
  const m = String(code).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

  // -------------------------------------------------
  // ordena las mutaciones por codon
  // -------------------------------------------------

  function sortMutationArrayByCodon(mutations = []) {
    return [...mutations].sort((a, b) => {
      const na = extractCodonNumberFromCode(a);
      const nb = extractCodonNumberFromCode(b);
      if (na !== nb) return na - nb;
      return String(a).localeCompare(String(b));
    });
  }

  // -------------------------------------------------
  // Normaliza el JSON de entrada para tener un array válido para datatables y más fácil de manipular
  // la primera fila es el acumulado, ordena el resto por fecha descendente y se asegura que las mutaciones estén ordenadas por codon ya que no tienen porque venir ordenadas
  // -------------------------------------------------


  function normalizeResistanceDataForTable(data) {
        if (!data) return { history: [] };

        const history = Array.isArray(data.history) ? data.history : [];
        const accumulated = data.accumulated_mutations || { pr: [], rt: [], in: [] };

        // 1) Entrada "acumulada" tal cual, respetando el orden ya preprocesado
        const accumulatedEntry = {
          resistance_id: -1,
          test_date: "",
          test_type: "accumulated", 
          mutations: {
            pr: [...(accumulated.pr || [])],
            rt: [...(accumulated.rt || [])],
            in: [...(accumulated.in || [])]
          },
          has_mutation:
            (accumulated.pr?.length || 0) +
            (accumulated.rt?.length || 0) +
            (accumulated.in?.length || 0) > 0
        };

        // 2) Ordenamos SOLO la historia por fecha y por codón
        const sortedHistory = history
          .map(h => ({
            ...h,
            mutations: {
              pr: sortMutationArrayByCodon(h.mutations?.pr || []),
              rt: sortMutationArrayByCodon(h.mutations?.rt || []),
              in: sortMutationArrayByCodon(h.mutations?.in || [])
            }
          }))
          .sort((a, b) => {
            const da = a.test_date ? new Date(a.test_date) : new Date(0);
            const db = b.test_date ? new Date(b.test_date) : new Date(0);
            return db - da; // más reciente primero
          });

       
        // --- 3) Devolvemos SOLO history como array, quitamos el accumulated_mutations ---
        return {
          ...data, 
          history: [accumulatedEntry, ...sortedHistory],
          accumulated_mutations: undefined // ELIMINAMOS el objeto original
        };

          
      }

  // ===============================================
  //  NAMESPACE GLOBAL PÚBLICO DE UX
  // ===============================================

  window.HIVResistanceUX = window.HIVResistanceUX || {};

  // ------------------------------------------------------
  //  MÉTODO PÚBLICO: UX_patientData()
  // ------------------------------------------------------

   /**
     * Función para pintar la cabecera del informe con la información del paciente
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

  /**
     * Función para pintar la tabla con el histórico de estudios de resistencias y la evolución de las mutaciones
     *
     * @param {<Object>} resistance_history  Objeto Json con el histórico de resistencias del paciente incluyendo ya el cálculo del acumulado.
     * @param {<Object>} MutDictionary Objeto con el diccionario de las mutaciones (colores)
     */
  HIVResistanceUX.UX_mutationTable = function (resistance_history, MutDictionary) {

	$('#res_total').html('');
  const norm_resistance_history=normalizeResistanceDataForTable(resistance_history);
  console.log("norm_resistance_history ",JSON.stringify(norm_resistance_history));

	let $table = $("#datatable-resStudies");
  const array_rtMeta=norm_resistance_history.history[0].mutations.rt;
  const array_prMeta=norm_resistance_history.history[0].mutations.pr;
  const array_inMeta=norm_resistance_history.history[0].mutations.in;

	$table.dataTable({
			destroy: true,
			dom: 't',
			bProcessing: true,
			searching: true,
			ordering: true,
			order: [[7, "desc"]],
			paging: true,
			pageLength: -1,
			autoWidth: false,
			info: true,
			data: norm_resistance_history.history,
			columnDefs: [
				{
					"targets": 0,
					"orderable": false,
					"class": "text-left",
					"data": null,
					"render": function (data, type, row, meta) {
						let new_data = '';
						if (data.resistance_id == '-1') {
							new_data += '<span class="badge mutation bg-info ms-1" title="Acumulado">ACUMULADO</span>';
						} else {
							new_data += data.test_date;
						}

						return new_data;
					}

				},
				{
					"targets": 1,
					"orderable": false,
					"class": "text-left",
					"data": null,
					"render": function (data, type, row, meta) {
						let new_data = '';
            let res = data.mutations.rt||[];
            if (data.resistance_id == '-1') {
								$.each(res, function (k, v) {
                  const basemut=getBaseMutation(v);
                  let color = MASTER_MUTATION_COLORS["rt"][basemut];
                  new_data+='<span class="badge mutation ms-1" title="'+v+'" style="background-color:' + color + ';">'+v+'</span>';
								});
						} 
            else {
								$.each(array_rtMeta, function (kmeta, vmeta) {
									let exists = false;
									$.each(res, function (k, v) {
									if (vmeta==v) {
											exists = true;
                      const basemut=getBaseMutation(v);
                      let color = MASTER_MUTATION_COLORS["rt"][basemut];
                      new_data+='<span class="badge mutation ms-1" title="'+v+'" style="background-color:' + color + ';">'+v+'</span>';										}
									});
									if (!exists) {
										new_data += '<span class="badge mutation ms-1 bg-gray-100" style="background-color:#ccc;width:40px;" >---</span>';
									}
								});
							}
						return new_data;
					}

				},
				{
					"targets": 2,
					"orderable": false,
					"class": "text-left",
					"data": null,
					"render": function (data, type, row, meta) {
						let new_data = '';
            let res = data.mutations.pr||[];
            if (data.resistance_id == '-1') {
								$.each(res, function (k, v) {
                  const basemut=getBaseMutation(v);
                  let color = MASTER_MUTATION_COLORS["pr"][basemut];
                  new_data+='<span class="badge mutation ms-1" title="'+v+'" style="background-color:' + color + ';">'+v+'</span>';
								});
						} 
            else {
								$.each(array_prMeta, function (kmeta, vmeta) {
									let exists = false;
									$.each(res, function (k, v) {
										if (vmeta==v) {
											exists = true;
                      const basemut=getBaseMutation(v);
                      let color = MASTER_MUTATION_COLORS["pr"][basemut];
                      new_data+='<span class="badge mutation ms-1" title="'+v+'" style="background-color:' + color + ';">'+v+'</span>';										}
								  	});
                    if (!exists) {
                      new_data += '<span class="badge mutation ms-1 bg-gray-100" style="background-color:#ccc;width:40px;" >---</span>';
                    }
								});
							}

						  return new_data;
					}

				},
				{
					"targets": 3,
					"orderable": false,
					"class": "text-left",
					"data": null,
					"render": function (data, type, row, meta) {
						let new_data = '';
            let res = data.mutations.in||[];
            if (data.resistance_id == '-1') {
								$.each(res, function (k, v) {
                  const basemut=getBaseMutation(v);
                  let color = MASTER_MUTATION_COLORS["in"][basemut];
                  new_data+='<span class="badge mutation ms-1" title="'+v+'" style="background-color:' + color + ';">'+v+'</span>';
								});
						} 
            else {
								$.each(array_inMeta, function (kmeta, vmeta) {
									let exists = false;
									$.each(res, function (k, v) {
										if (vmeta==v) {
											exists = true;
                      const basemut=getBaseMutation(v);
                      let color = MASTER_MUTATION_COLORS["in"][basemut];
                      new_data+='<span class="badge mutation ms-1" title="'+v+'" style="background-color:' + color + ';">'+v+'</span>';										}
								  	});
                    if (!exists) {
                      new_data += '<span class="badge mutation ms-1 bg-gray-100" style="background-color:#ccc;width:40px;" >---</span>';
                    }
								});
							}

						  return new_data;
					}
				}
			]
			, drawCallback: function (settings) {

		
				let api = this.api();
				let info = api.page.info();
				let total= (info.recordsTotal == 0)? 0 : info.recordsTotal-1; //se descuenta la fila de acumulado

				$('#res_total').html('Evolución de estudios de resistencia <span class="badge bg-info ms-1"> ' + total + ' estudios </span>');

				//solo se pliega en la carga inicial
				if (info.recordsTotal == 0 && $("#dom_ctrl_loadCompleted.Form_DashBoard").val()==0) $("#res_caretDown").trigger("click");

			}
		});


  };
})(); 
