// 3. CONEXIÓN CON EL ARCHIVO GENERADO POR JAVA (delta.json)
async function cargarDatosReales() {
    try {
        const respuesta = await fetch('delta.json');
        const datos = await respuesta.json();

        // Actualizar humedad de Quito (170150) en la Pantalla 1
        if (datos.h && datos.h["170150"]) {
            const humedad = datos.h["170150"];
            const elHumedad = document.getElementById('ui-humedad');
            const elStatus = document.getElementById('ui-status');

            elHumedad.textContent = humedad + "%";

            // Cambiar el Escudo de Estado dinámicamente según el porcentaje real
            if (humedad >= 85) {
                elStatus.textContent = "CRÍTICO";
                elStatus.style.color = "var(--risk-high)";
                elHumedad.style.color = "var(--risk-high)";
            } else if (humedad >= 70) {
                elStatus.textContent = "PRECAUCIÓN";
                elStatus.style.color = "var(--risk-med)";
                elHumedad.style.color = "var(--risk-med)";
            } else {
                elStatus.textContent = "ESTABLE";
                elStatus.style.color = "var(--risk-safe)";
                elHumedad.style.color = "var(--risk-safe)";
            }
        }
    } catch (error) {
        console.log("Esperando archivo delta.json de Java...");
    }
}

// Ejecutar al abrir la app
cargarDatosReales();
