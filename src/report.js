

  //cargar fichero configuración y maestros de la aplicacion, parámetros
  async function loadAppConfig() {
        const response = await fetch("./src/app_config.json");
        if (!response.ok) throw new Error("No se pudo cargar el fichero de configuración");
        return await response.json();
  }

 //cargar fichero configuración y maestros de la aplicacion, parámetros
  async function loadMutDictionary() {
        const response = await fetch("./src/ui/master_mutation_colors.json");
        if (!response.ok) throw new Error("No se pudo cargar el maestro de mutaciones");
        return await response.json();
  }

document.addEventListener("DOMContentLoaded", async () => {
     
      //cargando objeto de configuración en objeto APP_CONFIG
      try {
        APP_CONFIG = await loadAppConfig();
        console.info("Configuración cargada:", APP_CONFIG);
      } catch (err) {
        console.error("Error cargando configuración app_config_json:", err);
      }
      //cargando objeto del maestro de mutaciones en objeto MASTER_MUTATION_COLORS
      try {
        MASTER_MUTATION_COLORS  = await loadMutDictionary();
        console.info("Maestro mutaciones cargada:", MASTER_MUTATION_COLORS);
      } catch (err) {
        console.error("Error cargando maestro de mutaciones:", err);
      }
    
      // Recuperar datos del sessionStorage
      const pat_data = JSON.parse(sessionStorage.getItem("patientdata"));
      let resistance_history = JSON.parse(sessionStorage.getItem("resistance_history") || "[]"); 
      const treatment_history = JSON.parse(sessionStorage.getItem("treatment_history") || "[]");


      if (!pat_data || !resistance_history.length) {
        document.getElementById("loader").innerHTML = "<p class='text-danger'>No hay datos disponibles del paciente o no tiene estudios de resistencias asociados</p>";
        return;
      }

      // Podemos ir llamando a las funciones UX cuyos datos no necesitan conversión y así dar sensación de dinamismo
      HIVResistanceUX.UX_patientData(pat_data,APP_CONFIG);

      
     /// Generar datos del informe con las funciones del core
     //Primero se calculas resistencias acumuladas y se normaliza objeto resistance_history
      resistance_history = HIVResistanceCore.buildAccumulatedResistanceHistory(resistance_history);



      //antes de llamar standford mostramos el acumulado de resistencias elementos UX
      HIVResistanceUX.UX_mutationTable (resistance_history, MASTER_MUTATION_COLORS);

      //antes de llamar standford mostramos la gráfica de tratamiento
      HIVResistanceUX.UX_targachart("chartARV",treatment_history,resistance_history);

      console.log(resistance_history);
  
      const StandordResponse = await HIVResistanceCore.callSierraService(resistance_history.accumulated_mutations);


      // Si la llamada falló o devolvió un objeto de error (manejo de errores)
      if (StandordResponse.error) {
          // Manejar el error, mostrar un mensaje de fallo en la interfaz de usuario.
          console.error("Error fatal en la conexión a Stanford. No se puede continuar.", stanfordResponse);
          // [Llamar aquí a una función UX para mostrar error: UX_showError(stanfordResponse.message)]
          return; 
      }
      // Paso 3 del Core (SÍNCRONO): Asignación del Semáforo
      // La función SÍNCRONA asigna el semáforo al JSON de Stanford usando el historial de tratamientos activos.
      const finalReportData = HIVResistanceCore.assignTargaSemaphore(
          StandordResponse, 
          treatment_history
      );

      //console.info("Datos finales listos para la visualización:", JSON.stringify(finalReportData));


       HIVResistanceUX.UX_stanfordReport(finalReportData,resistance_history.accumulated_mutations); // Usa finalReportData que ya incluye el semáforo


      // Mostrar contenido y ocultar loader
      document.getElementById("loader").classList.add("d-none");
      document.getElementById("reportContent").classList.remove("d-none");

      //activamos tootips de bootstrap
      var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.map(function(el) {
          return new bootstrap.Tooltip(el);
      });

    });


