document.addEventListener("DOMContentLoaded", () => {
      // Recuperar datos del sessionStorage
      const pat_data = JSON.parse(sessionStorage.getItem("pat_data") || "{}");
      const resistance_history = JSON.parse(sessionStorage.getItem("resistance_history") || "[]");
      const treatment_history = JSON.parse(sessionStorage.getItem("treatment_history") || "[]");

      if (!pat_data || !resistance_history.length) {
        document.getElementById("loader").innerHTML = "<p class='text-danger'>No hay datos disponibles del paciente o no tiene estudios de resistencias asociados</p>";
        return;
      }

     /// Generar datos del informe con las funciones del core
     //Primero se calculas resistencias acumuladas
      const accumulated = HIVResistanceCore.buildAccumulatedResistanceHistory(resistance_history);
      console.log (accumulated);
      
      /*
      const drugMatrix = HIVResistanceCore.mergeWithTreatmentHistory(accumulated, treatment_history);
      const hivdbReport = HIVResistanceCore.buildStanfordSection(drugMatrix);

      // Renderizar con la capa UX
      HIVUX.renderHeader(pat_data);
      HIVUX.renderMutationTable(accumulated);
      HIVUX.renderStanfordSection(hivdbReport);
      HIVUX.renderResistanceChart(resistance_history, treatment_history);
     */

      // Mostrar contenido y ocultar loader
      document.getElementById("loader").classList.add("d-none");
      document.getElementById("reportContent").classList.remove("d-none");
    });