
$ErrorActionPreference = "Stop"

$archivo = Join-Path $PSScriptRoot "frontend\app.js"

if (-not (Test-Path $archivo)) {
    Write-Host "No se encontró frontend\app.js" -ForegroundColor Red
    exit 1
}

$codigo = Get-Content $archivo -Raw -Encoding UTF8

if ($codigo.Contains('formularioAsignatura.addEventListener("submit"')) {
    Write-Host "El controlador de asignaturas ya existe." -ForegroundColor Yellow
    exit 0
}

$bloque = @'

// =============== GUARDAR ASIGNATURAS ===============
const formularioAsignatura = document.getElementById("formulario-asignatura");
const mensajeFormularioAsignatura = document.getElementById("mensaje-formulario-asignatura");
const botonGuardarAsignatura = document.getElementById("boton-guardar-asignatura");

if (formularioAsignatura && mensajeFormularioAsignatura && botonGuardarAsignatura) {
  formularioAsignatura.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const obtener = (id) => document.getElementById(id)?.value ?? "";
    const datos = {
      codigo: obtener("asignatura-codigo").trim(),
      nombre: obtener("asignatura-nombre").trim(),
      unidades_valorativas: Number(obtener("asignatura-unidades")),
      carrera_id: Number(obtener("asignatura-carrera")),
      requisito_id: obtener("asignatura-requisito")
        ? Number(obtener("asignatura-requisito"))
        : null,
      activo: ["1", "true", "activo"].includes(
        obtener("asignatura-activo").toLowerCase()
      )
    };

    mensajeFormularioAsignatura.textContent = "";
    mensajeFormularioAsignatura.className = "mensaje-error";

    if (
      !datos.codigo || !datos.nombre ||
      !Number.isInteger(datos.unidades_valorativas) ||
      datos.unidades_valorativas < 1 ||
      datos.unidades_valorativas > 8 ||
      !Number.isInteger(datos.carrera_id) ||
      datos.carrera_id <= 0
    ) {
      mensajeFormularioAsignatura.textContent =
        "Completa los campos y selecciona una carrera válida.";
      return;
    }

    botonGuardarAsignatura.disabled = true;
    const textoOriginal = botonGuardarAsignatura.textContent;
    botonGuardarAsignatura.textContent = "Guardando...";

    try {
      const respuesta = await apiFetch(`${URL_BASE_API}/asignaturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos)
      });

      if (!respuesta.ok) {
        const error = await respuesta.json().catch(() => ({}));
        const detalle = Array.isArray(error.detail)
          ? error.detail.map((item) => item.msg).join(", ")
          : error.detail;

        mensajeFormularioAsignatura.textContent =
          respuesta.status === 401
            ? "La sesión no está activa. Inicia sesión nuevamente."
            : respuesta.status === 403
              ? "Tu usuario no tiene permiso ADMIN para crear asignaturas."
              : detalle || `Error al guardar (HTTP ${respuesta.status}).`;
        return;
      }

      mensajeFormularioAsignatura.textContent =
        "Asignatura registrada correctamente.";
      mensajeFormularioAsignatura.className = "mensaje-exito";

      formularioAsignatura.reset();

      const id = document.getElementById("asignatura-id");
      if (id) id.value = "";

      await cargarAsignaturas(
        document.getElementById("campo-buscar-asignatura")?.value.trim() || ""
      );
    } catch (error) {
      console.error("Error al guardar asignatura:", error);
      mensajeFormularioAsignatura.textContent =
        "No se pudo conectar con la API. Comprueba que esté iniciada.";
    } finally {
      botonGuardarAsignatura.disabled = false;
      botonGuardarAsignatura.textContent = textoOriginal || "Guardar asignatura";
    }
  });
}
'@

$marca = "// =============== GUARDAR ASIGNATURAS ==============="

if ($codigo.Contains($marca)) {
    Write-Host "Ya existe la marca del controlador; revisa el archivo antes de modificarlo." -ForegroundColor Yellow
    exit 1
}

$respaldo = Join-Path (Split-Path $archivo) "app_respaldo_previo_guardado_$(Get-Date -Format 'yyyyMMdd_HHmmss').js"
Copy-Item $archivo $respaldo

Add-Content -Path $archivo -Value $bloque -Encoding UTF8

Write-Host "Controlador agregado correctamente." -ForegroundColor Green
Write-Host "Copia de seguridad: $respaldo"
