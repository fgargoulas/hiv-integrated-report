

  //cargar fichero configuración de la aplicacion, parámetros
  async function loadAppConfig() {
        const response = await fetch("./src/app_config.json");
        if (!response.ok) throw new Error("No se pudo cargar el fichero de configuración");
        return await response.json();
  }


document.addEventListener("DOMContentLoaded", async () => {
     
      //cargando objeto de configuración en objeto APP_CONFIG
      try {
        APP_CONFIG = await loadAppConfig();
        console.log("Configuración cargada:", APP_CONFIG);
      } catch (err) {
        console.error("Error cargando configuración:", err);
      }
    
      // Recuperar datos del sessionStorage
      const pat_data = JSON.parse(sessionStorage.getItem("patientdata"));
      let resistance_history = JSON.parse(sessionStorage.getItem("resistance_history") || "[]"); 
      const treatment_history = JSON.parse(sessionStorage.getItem("treatment_history") || "[]");

      console.log("pat_data:",JSON.stringify(pat_data));
      console.log("resistance_history:",JSON.stringify(resistance_history));
      console.log("treatment_history:",JSON.stringify(treatment_history));

      if (!pat_data || !resistance_history.length) {
        document.getElementById("loader").innerHTML = "<p class='text-danger'>No hay datos disponibles del paciente o no tiene estudios de resistencias asociados</p>";
        return;
      }

      // Podemos ir llamando a las funciones UX cuyos datos no necesitan conversión y así dar sensación de dinamismo
      HIVResistanceUX.UX_patientData(pat_data,APP_CONFIG);

      
     /// Generar datos del informe con las funciones del core
     //Primero se calculas resistencias acumuladas y se normaliza objeto resistance_history
      resistance_history = HIVResistanceCore.buildAccumulatedResistanceHistory(resistance_history);

      console.log ("acumulado de resistencias");
      console.log (JSON.stringify(resistance_history.accumulated_mutations));
  
      const StandordResponse = await HIVResistanceCore.callSierraService(resistance_history.accumulated_mutations);

      console.log("Respuesta de Stanford recibida. Continuando con el Semáforo...");

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

      console.log("Datos finales listos para la visualización:", JSON.stringify(finalReportData));

      // Paso 4: Renderizado (Llamar a las funciones UX de la Fase 5)
    
      // UX_mutationTable(resistanceModel); 
      // UX_stanfordReport(finalReportData); // Usa finalReportData que ya incluye el semáforo
      // UX_TARGAChart(treatmentHistory); 


      // Mostrar contenido y ocultar loader
      document.getElementById("loader").classList.add("d-none");
      document.getElementById("reportContent").classList.remove("d-none");
    });