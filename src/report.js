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
     //Primero se calculas resistencias acumuladas y se normaliza objeto resistance_history
      resistance_history = HIVResistanceCore.buildAccumulatedResistanceHistory(resistance_history);

      console.log (resistance_history);
  
      StandordResponse=HIVResistanceCore.callSierraService(resistance_history.accumulated_mutations);
      console.log (StandordResponse)
      // Mostrar contenido y ocultar loader
      document.getElementById("loader").classList.add("d-none");
      document.getElementById("reportContent").classList.remove("d-none");
    });