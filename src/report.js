
async function generateIntegratedReport() {
    // 1. Recolección de datos (Simulando la obtención desde el sistema huésped o sessionStorage)
   
          // Recuperar datos del sessionStorage
      const pat_data = JSON.parse(sessionStorage.getItem("pat_data") || "{}");
      let treatmentHistory = JSON.parse(sessionStorage.getItem("resistance_history") || "[]"); 
      const resistanceHistory = JSON.parse(sessionStorage.getItem("treatment_history") || "[]");

    //el tratamiento no ha de ser obligatorio
    if (!resistanceHistory ||resistanceHistory==[] || !pat_data|| pat_data==[]) {
        console.error("report.js: Datos de historial de resistencia o paciente no disponibles.");
        // [Llamar a UX_showError o similar para notificar al usuario]
        return;
    }

    // Paso 1 del Core (SÍNCRONO): Calcular el acumulado de mutaciones
    const resistanceModel = HIVResistanceCore.buildAccumulatedResistanceHistory(resistanceHistory);
    const accumulatedMutations = resistanceModel.accumulated_mutations;

    // Paso 2 del Core (ASÍNCRONO): Llamada a Stanford
    console.log("Iniciando llamada a Stanford. Se necesita 'await'...");
    
    // *** CLAVE: Usamos AWAIT para obtener el JSON de respuesta real (no la Promesa) ***
    const stanfordResponse = await HIVResistanceCore.callSierraService(accumulatedMutations);
    
    console.log("Respuesta de Stanford recibida. Continuando con el Semáforo...");

    // Si la llamada falló o devolvió un objeto de error (manejo de errores)
    if (stanfordResponse.error) {
        // Manejar el error, mostrar un mensaje de fallo en la interfaz de usuario.
        console.error("Error fatal en la conexión a Stanford. No se puede continuar.", stanfordResponse);
        // [Llamar aquí a una función UX para mostrar error: UX_showError(stanfordResponse.message)]
        return; 
    }

    // Paso 3 del Core (SÍNCRONO): Asignación del Semáforo
    // La función SÍNCRONA asigna el semáforo al JSON de Stanford usando el historial de tratamientos activos.
    const finalReportData = HIVResistanceCore.assignTargaSemaphore(
        stanfordResponse, 
        treatmentHistory
    );

    console.log("Datos finales listos para la visualización:", finalReportData);

    // Paso 4: Renderizado (Llamar a las funciones UX de la Fase 5)
    // Aquí es donde llamarías a tus funciones UX, que ya consumirían los datos finales:
    // UX_patientData(patientData);
    // UX_mutationTable(resistanceModel); 
    // UX_stanfordReport(finalReportData); // Usa finalReportData que ya incluye el semáforo
    // UX_TARGAChart(treatmentHistory); 
}

// Iniciar la generación del informe (ejecución asíncrona)
generateIntegratedReport();




document.addEventListener("DOMContentLoaded", async () => {
      // Recuperar datos del sessionStorage
      const pat_data = JSON.parse(sessionStorage.getItem("pat_data") || "{}");
      let resistance_history = JSON.parse(sessionStorage.getItem("resistance_history") || "[]"); 
      const treatment_history = JSON.parse(sessionStorage.getItem("treatment_history") || "[]");

      if (!pat_data || !resistance_history.length) {
        document.getElementById("loader").innerHTML = "<p class='text-danger'>No hay datos disponibles del paciente o no tiene estudios de resistencias asociados</p>";
        return;
      }

     /// Generar datos del informe con las funciones del core
     //Primero se calculas resistencias acumuladas y se normaliza objeto resistance_history
      resistance_history = HIVResistanceCore.buildAccumulatedResistanceHistory(resistance_history);

      console.log (resistance_history);
  
      const StandordResponse = await HIVResistanceCore.callSierraService(resistance_history.accumulated_mutations);
      const finalReportData = HIVResistanceCore.assignTargaSemaphore(StandordResponse,treatment_history);
      // Mostrar contenido y ocultar loader
      document.getElementById("loader").classList.add("d-none");
      document.getElementById("reportContent").classList.remove("d-none");
    });