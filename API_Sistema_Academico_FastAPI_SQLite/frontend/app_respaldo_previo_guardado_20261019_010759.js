// Sistema AcadÃ©mico â€” frontend (vanilla JS, sin dependencias).
// Como este archivo se sirve desde la misma API (FastAPI + StaticFiles),
// las rutas son relativas: no hay problema de CORS.

const URL_BASE_API = "/api/v1";

const vistaLogin = document.getElementById("vista-login");
const vistaDashboard = document.getElementById("vista-dashboard");

const formularioLogin = document.getElementById("formulario-login");
const campoUsuario = document.getElementById("campo-usuario");
const campoClave = document.getElementById("campo-clave");
const botonEntrar = document.getElementById("boton-entrar");
const mensajeLogin = document.getElementById("mensaje-login");

const tituloBienvenida = document.getElementById("titulo-bienvenida");
const chipUsuario = document.getElementById("chip-usuario");
const botonActualizar = document.getElementById("boton-actualizar");
const botonSalir = document.getElementById("boton-salir");
const filaTarjetas = document.getElementById("fila-tarjetas");
const textoPeriodo = document.getElementById("texto-periodo");
const campoBuscar = document.getElementById("campo-buscar");
const cuerpoTablaEstudiantes = document.getElementById("cuerpo-tabla-estudiantes");
const textoSinResultados = document.getElementById("texto-sin-resultados");

const tituloFormulario = document.getElementById("titulo-formulario");
const formularioEstudiante = document.getElementById("formulario-estudiante");
const campoEstudianteId = document.getElementById("estudiante-id");
const campoNombres = document.getElementById("estudiante-nombres");
const campoApellidos = document.getElementById("estudiante-apellidos");
const campoCuenta = document.getElementById("estudiante-cuenta");
const campoCorreo = document.getElementById("estudiante-correo");
const campoTelefono = document.getElementById("estudiante-telefono");
const campoNacimiento = document.getElementById("estudiante-nacimiento");
const campoCarrera = document.getElementById("estudiante-carrera");
const campoEstado = document.getElementById("estudiante-estado");
const botonGuardarEstudiante = document.getElementById("boton-guardar-estudiante");
const botonCancelarEdicion = document.getElementById("boton-cancelar-edicion");
const mensajeFormulario = document.getElementById("mensaje-formulario");

let usuarioActual = null;
let temporizadorBusqueda = null;
async function apiFetch(url, opciones = {}) {
  const token =
    usuarioActual?.access_token ||
    localStorage.getItem("token_academico");

  const encabezados = new Headers(opciones.headers || {});

  if (token) {
    encabezados.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...opciones,
    headers: encabezados,
  });
}
const TARJETAS_KPI = [
  { clave: "estudiantes_activos", etiqueta: "Estudiantes activos" },
  { clave: "docentes_activos", etiqueta: "Docentes activos" },
  { clave: "carreras_activas", etiqueta: "Carreras activas" },
  { clave: "asignaturas_activas", etiqueta: "Asignaturas activas" },
  { clave: "secciones_abiertas", etiqueta: "Secciones abiertas" },
  { clave: "matriculas_activas", etiqueta: "MatrÃ­culas activas" },
];

// ------------------------- AutenticaciÃ³n -------------------------

formularioLogin.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mensajeLogin.textContent = "";
  botonEntrar.disabled = true;
  botonEntrar.textContent = "Entrando...";

  try {
    const respuesta = await fetch(`${URL_BASE_API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario: campoUsuario.value.trim(),
        clave: campoClave.value,
      }),
    });

    if (!respuesta.ok) {
      mensajeLogin.textContent =
        respuesta.status === 401
          ? "Usuario o contraseÃ±a incorrectos."
          : "No se pudo iniciar sesiÃ³n.";
      return;
    }

    usuarioActual = await respuesta.json();
    localStorage.setItem(
  "token_academico",
  usuarioActual.access_token
);

    mostrarDashboard();
  } catch (error) {
    mensajeLogin.textContent =
      "No se pudo conectar con la API. Â¿EstÃ¡ corriendo uvicorn?";
  } finally {
    botonEntrar.disabled = false;
    botonEntrar.textContent = "Iniciar sesiÃ³n";
  }
});
// Token conservado durante la sesi?n.

botonSalir.addEventListener("click", () => {
  usuarioActual = null;
  formularioLogin.reset();
  vistaDashboard.classList.add("oculto");
  vistaLogin.classList.remove("oculto");
});

// ------------------------- Dashboard -------------------------



function mostrarDashboard() {
  vistaLogin.classList.add("oculto");
  vistaDashboard.classList.remove("oculto");

  const nombre = usuarioActual?.nombre_completo ?? "Usuario";
  const rol = usuarioActual?.rol;
  const esAdmin = rol === "ADMIN";
  const esDocente = rol === "DOCENTE";
  const esEstudiante = rol === "ESTUDIANTE";

  tituloBienvenida.textContent = `Hola, ${nombre}`;

  const navegacionModulos = document.querySelector(".navegacion-modulos");

  if (navegacionModulos) {
    navegacionModulos.classList.toggle("oculto", !esAdmin);
  }

  moduloEstudiantes.classList.toggle("oculto", !esAdmin);
  moduloDocentes.classList.toggle("oculto", true);

  const moduloAsignaturas = document.getElementById("modulo-asignaturas");
  const moduloCalificaciones = document.getElementById("modulo-calificaciones");

  if (moduloAsignaturas) {
    moduloAsignaturas.classList.toggle("oculto", !esAdmin);
  }

  if (moduloCalificaciones) {
    moduloCalificaciones.classList.toggle(
      "oculto",
      !(esAdmin || esDocente || esEstudiante)
    );
  }

  if (esAdmin) {
    moduloActual = "estudiantes";

    botonesModulos.forEach((boton) => {
      const seleccionado = boton.dataset.modulo === "estudiantes";
      boton.classList.toggle("activo", seleccionado);
      boton.setAttribute("aria-pressed", String(seleccionado));
    });

    construirTarjetasVacias();
    cargarDashboard();
    cargarCarreras();
    cargarEstudiantes();
  } else if (esDocente || esEstudiante) {
    moduloActual = "calificaciones";

    filaTarjetas.innerHTML = "";

    textoPeriodo.textContent = esDocente
      ? "Consulta las calificaciones de tus secciones."
      : "Consulta tus calificaciones acadÃ©micas.";

    if (moduloCalificaciones) {
      moduloCalificaciones.classList.remove("oculto");
    }

    cargarCalificaciones();
  } else {
    filaTarjetas.innerHTML = "";
    textoPeriodo.textContent = "El rol de usuario no es vÃ¡lido.";
  }
}


function construirTarjetasVacias() {
  filaTarjetas.innerHTML = "";
  TARJETAS_KPI.forEach(({ clave, etiqueta }) => {
    const tarjeta = document.createElement("article");
    tarjeta.className = "tarjeta-kpi";
    tarjeta.innerHTML = `
      <div class="valor" data-kpi="${clave}">â€”</div>
      <div class="etiqueta-kpi">${etiqueta}</div>
    `;
    filaTarjetas.appendChild(tarjeta);
  });
}

async function cargarDashboard() {
  try {
    const respuesta = await fetch(`${URL_BASE_API}/reportes/dashboard`);
    if (!respuesta.ok) throw new Error("dashboard no disponible");
    const resumen = await respuesta.json();

    TARJETAS_KPI.forEach(({ clave }) => {
      const nodo = filaTarjetas.querySelector(`[data-kpi="${clave}"]`);
      if (nodo) nodo.textContent = resumen[clave] ?? "â€”";
    });

    textoPeriodo.textContent = resumen.periodo_activo
      ? `PerÃ­odo acadÃ©mico activo: ${resumen.periodo_activo}`
      : "No hay un perÃ­odo acadÃ©mico activo.";
  } catch (error) {
    textoPeriodo.textContent = "No se pudieron cargar los indicadores.";
  }
}


// ------------------------- Carreras -------------------------

async function cargarCarreras() {
  try {
    const respuesta = await fetch(
      `${URL_BASE_API}/carreras?solo_activas=true`
    );

    if (!respuesta.ok) {
      throw new Error("No se pudieron cargar las carreras.");
    }

    const carreras = await respuesta.json();

    // Selector del formulario de estudiantes
    const campoCarreraEstudiante = document.getElementById(
      "estudiante-carrera"
    );

    // Selector del formulario de asignaturas
    const campoCarreraAsignatura = document.getElementById(
      "asignatura-carrera"
    );

    const selectores = [
      {
        campo: campoCarreraEstudiante,
        textoInicial: "Seleccione una carrera",
      },
      {
        campo: campoCarreraAsignatura,
        textoInicial: "Seleccione una carrera",
      },
    ];

    selectores.forEach(({ campo, textoInicial }) => {
      if (!campo) return;

      campo.replaceChildren();

      const opcionInicial = document.createElement("option");
      opcionInicial.value = "";
      opcionInicial.textContent = textoInicial;
      campo.appendChild(opcionInicial);

      carreras.forEach((carrera) => {
        const opcion = document.createElement("option");
        opcion.value = carrera.id;
        opcion.textContent = `${carrera.codigo} - ${carrera.nombre}`;
        campo.appendChild(opcion);
      });
    });
  } catch (error) {
    console.error("Error al cargar las carreras:", error);

    const campoCarreraEstudiante = document.getElementById(
      "estudiante-carrera"
    );

    const campoCarreraAsignatura = document.getElementById(
      "asignatura-carrera"
    );

    [campoCarreraEstudiante, campoCarreraAsignatura].forEach((campo) => {
      if (!campo) return;

      campo.replaceChildren();

      const opcion = document.createElement("option");
      opcion.value = "";
      opcion.textContent = "No se pudieron cargar las carreras";
      campo.appendChild(opcion);
    });
  }
}

// ------------------------- Listado de estudiantes -------------------------

async function cargarEstudiantes(buscar = "") {
  try {
    const parametros = buscar ? `?buscar=${encodeURIComponent(buscar)}` : "";
    const respuesta = await fetch(`${URL_BASE_API}/estudiantes${parametros}`);
    if (!respuesta.ok) throw new Error("estudiantes no disponible");
    const estudiantes = await respuesta.json();
    renderizarTablaEstudiantes(estudiantes);
  } catch (error) {
    cuerpoTablaEstudiantes.innerHTML = "";
    textoSinResultados.textContent = "No se pudo cargar la lista de estudiantes.";
    textoSinResultados.classList.remove("oculto");
  }
}

function renderizarTablaEstudiantes(estudiantes) {
  cuerpoTablaEstudiantes.innerHTML = "";

  if (estudiantes.length === 0) {
    textoSinResultados.textContent = "No se encontraron estudiantes con ese criterio.";
    textoSinResultados.classList.remove("oculto");
    return;
  }
  textoSinResultados.classList.add("oculto");

  estudiantes.forEach((estudiante) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${estudiante.cuenta}</td>
      <td>${estudiante.nombres} ${estudiante.apellidos}</td>
      <td>${estudiante.correo}</td>
      <td>${estudiante.carrera_nombre}</td>
      <td>${pastillaEstado(estudiante.estado)}</td>
      <td class="acciones-fila">
        <button type="button" class="boton-icono" data-accion="editar">Editar</button>
        <button type="button" class="boton-icono peligro" data-accion="eliminar">Eliminar</button>
      </td>
    `;
    fila.querySelector('[data-accion="editar"]').addEventListener("click", () =>
      editarEstudiante(estudiante)
    );
    fila.querySelector('[data-accion="eliminar"]').addEventListener("click", () =>
      eliminarEstudiante(estudiante)
    );
    cuerpoTablaEstudiantes.appendChild(fila);
  });
}

function pastillaEstado(estado) {
  if (estado === "ACTIVO") {
    return `<span class="pastilla-estado pastilla-activo">Activo</span>`;
  }
  const etiquetas = { INACTIVO: "Inactivo", GRADUADO: "Graduado" };
  return `<span class="pastilla-estado pastilla-neutral">${etiquetas[estado] ?? estado}</span>`;
}

campoBuscar.addEventListener("input", () => {
  clearTimeout(temporizadorBusqueda);
  temporizadorBusqueda = setTimeout(() => {
    cargarEstudiantes(campoBuscar.value.trim());
  }, 300);
});
 

/* =============== NAVEGACIÃ“N DE MÃ“DULOS =============== */
const botonesModulos = document.querySelectorAll(".boton-modulo");
const moduloEstudiantes = document.getElementById("modulo-estudiantes");
const moduloDocentes = document.getElementById("modulo-docentes");
const moduloAsignaturas = document.getElementById("modulo-asignaturas");
const moduloCalificaciones = document.getElementById("modulo-calificaciones");

let moduloActual = "estudiantes";
let temporizadorBusquedaDocente = null;

botonesModulos.forEach((boton) => {
  boton.addEventListener("click", () => {
    moduloActual = boton.dataset.modulo;

    botonesModulos.forEach((item) => {
      const seleccionado = item === boton;
      item.classList.toggle("activo", seleccionado);
      item.setAttribute("aria-pressed", String(seleccionado));
    });

    moduloEstudiantes.classList.toggle(
      "oculto", moduloActual !== "estudiantes"
    );

    moduloDocentes.classList.toggle(
      "oculto", moduloActual !== "docentes"
    );

    moduloAsignaturas.classList.toggle(
      "oculto", moduloActual !== "asignaturas"
    );

    moduloCalificaciones.classList.toggle(
      "oculto", moduloActual !== "calificaciones"
    );

    if (moduloActual === "estudiantes") {
      cargarEstudiantes(campoBuscar.value.trim());
    }

    if (moduloActual === "docentes") {
      cargarDocentes(campoBuscarDocente.value.trim());
    }
  });
});



/* =================== REFERENCIAS DOCENTES =================== */

const formularioDocente = document.getElementById("formulario-docente");
const campoDocenteId = document.getElementById("docente-id");
const campoDocenteNumero = document.getElementById("docente-numero");
const campoDocenteNombres = document.getElementById("docente-nombres");
const campoDocenteApellidos = document.getElementById("docente-apellidos");
const campoDocenteCorreo = document.getElementById("docente-correo");
const campoDocenteEspecialidad = document.getElementById("docente-especialidad");
const campoDocenteEstado = document.getElementById("docente-estado");

const tituloFormularioDocente =
  document.getElementById("titulo-formulario-docente");
const botonGuardarDocente =
  document.getElementById("boton-guardar-docente");
const botonCancelarDocente =
  document.getElementById("boton-cancelar-docente");
const mensajeFormularioDocente =
  document.getElementById("mensaje-formulario-docente");
const campoBuscarDocente =
  document.getElementById("campo-buscar-docente");
const cuerpoTablaDocentes =
  document.getElementById("cuerpo-tabla-docentes");
const textoSinDocentes =
  document.getElementById("texto-sin-docentes");


/* ================== LISTAR DOCENTES ================== */

async function cargarDocentes(buscar = "") {
  try {
    const parametros = buscar
      ? `?buscar=${encodeURIComponent(buscar)}`
      : "";

    const respuesta = await fetch(
      `${URL_BASE_API}/docentes${parametros}`
    );

    if (!respuesta.ok) {
      throw new Error("No se pudieron cargar los docentes");
    }

    const docentes = await respuesta.json();
    renderizarTablaDocentes(docentes);
  } catch (error) {
    cuerpoTablaDocentes.innerHTML = "";
    textoSinDocentes.textContent =
      "No se pudo cargar la lista. Verifique que la API estÃ© funcionando.";
    textoSinDocentes.classList.remove("oculto");
  }
}


/* ================== DIBUJAR TABLA ================== */

function renderizarTablaDocentes(docentes) {
  cuerpoTablaDocentes.innerHTML = "";

  if (docentes.length === 0) {
    textoSinDocentes.textContent = "No hay docentes para mostrar.";
    textoSinDocentes.classList.remove("oculto");
    return;
  }

  textoSinDocentes.classList.add("oculto");

  docentes.forEach((docente) => {
    const fila = document.createElement("tr");

    // Usar textContent evita interpretar los datos como HTML.
    const valores = [
      docente.numero_empleado,
      `${docente.nombres} ${docente.apellidos}`,
      docente.correo,
      docente.especialidad,
    ];

    valores.forEach((valor) => {
      const celda = document.createElement("td");
      celda.textContent = valor ?? "";
      fila.appendChild(celda);
    });

    const celdaEstado = document.createElement("td");
    celdaEstado.innerHTML = pastillaEstado(docente.estado);
    fila.appendChild(celdaEstado);

    const celdaAcciones = document.createElement("td");
    celdaAcciones.className = "acciones-fila";

    const botonEditar = document.createElement("button");
    botonEditar.type = "button";
    botonEditar.className = "boton-icono";
    botonEditar.textContent = "Editar";
    botonEditar.addEventListener("click", () => editarDocente(docente));

    const botonEliminar = document.createElement("button");
    botonEliminar.type = "button";
    botonEliminar.className = "boton-icono peligro";
    botonEliminar.textContent = "Eliminar";
    botonEliminar.addEventListener("click", () => eliminarDocente(docente));

    celdaAcciones.append(botonEditar, botonEliminar);
    fila.appendChild(celdaAcciones);
    cuerpoTablaDocentes.appendChild(fila);
  });
}


/* ================= CREAR / EDITAR DOCENTE ================= */

formularioDocente.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  mensajeFormularioDocente.textContent = "";
  mensajeFormularioDocente.className = "mensaje-error";

  const datos = {
    numero_empleado: campoDocenteNumero.value.trim(),
    nombres: campoDocenteNombres.value.trim(),
    apellidos: campoDocenteApellidos.value.trim(),
    correo: campoDocenteCorreo.value.trim(),
    especialidad: campoDocenteEspecialidad.value.trim(),
    estado: campoDocenteEstado.value,
  };

  const id = campoDocenteId.value;
  const esEdicion = Boolean(id);

  botonGuardarDocente.disabled = true;
  botonGuardarDocente.textContent = "Guardando...";

  try {
    const respuesta = await fetch(
      `${URL_BASE_API}/docentes${esEdicion ? `/${id}` : ""}`,
      {
        method: esEdicion ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      }
    );

    if (!respuesta.ok) {
      const detalle = await respuesta.json().catch(() => null);
      mensajeFormularioDocente.textContent =
        detalle?.detail ?? "No se pudo guardar el docente.";
      return;
    }

    
const resultado = await respuesta.json();

if (esEdicion) {
  mensajeFormularioDocente.textContent =
    "Docente actualizado correctamente.";
} else {
  mensajeFormularioDocente.textContent =
    `Docente registrado correctamente.\n\n` +
    `Usuario: ${resultado.usuario}\n` +
    `ContraseÃ±a temporal: ${resultado.clave_temporal}\n\n` +
    `Guarde estas credenciales para entregÃ¡rselas al docente.`;
}

mensajeFormularioDocente.className = "mensaje-exito";


    cancelarEdicionDocente();
    await cargarDocentes(campoBuscarDocente.value.trim());

    // Actualiza el indicador de docentes activos.
    await cargarDashboard();
  } catch (error) {
    mensajeFormularioDocente.textContent =
      "No se pudo conectar con la API.";
  } finally {
    botonGuardarDocente.disabled = false;
    botonGuardarDocente.textContent = "Guardar docente";
  }
});


/* =================== EDITAR DOCENTE =================== */

function editarDocente(docente) {
  campoDocenteId.value = docente.id;
  campoDocenteNumero.value = docente.numero_empleado;
  campoDocenteNombres.value = docente.nombres;
  campoDocenteApellidos.value = docente.apellidos;
  campoDocenteCorreo.value = docente.correo;
  campoDocenteEspecialidad.value = docente.especialidad;
  campoDocenteEstado.value = docente.estado;

  tituloFormularioDocente.textContent =
    `Editar docente â€” ${docente.nombres} ${docente.apellidos}`;

  botonGuardarDocente.textContent = "Guardar cambios";
  botonCancelarDocente.classList.remove("oculto");
  mensajeFormularioDocente.textContent = "";

  formularioDocente.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}


/* ================= CANCELAR EDICIÃ“N ================= */

function cancelarEdicionDocente() {
  formularioDocente.reset();
  campoDocenteId.value = "";
  tituloFormularioDocente.textContent = "Nuevo docente";
  botonGuardarDocente.textContent = "Guardar docente";
  botonCancelarDocente.classList.add("oculto");
}

botonCancelarDocente.addEventListener(
  "click",
  cancelarEdicionDocente
);


/* =================== ELIMINAR DOCENTE =================== */

async function eliminarDocente(docente) {
  const confirmado = window.confirm(
    `Â¿Eliminar a ${docente.nombres} ${docente.apellidos}?`
  );

  if (!confirmado) return;

  try {
    const respuesta = await fetch(
      `${URL_BASE_API}/docentes/${docente.id}`,
      { method: "DELETE" }
    );

    if (!respuesta.ok) {
      const detalle = await respuesta.json().catch(() => null);
      window.alert(
        detalle?.detail ?? "No se pudo eliminar el docente."
      );
      return;
    }

    await cargarDocentes(campoBuscarDocente.value.trim());
    await cargarDashboard();
  } catch (error) {
    window.alert("No se pudo conectar con la API.");
  }
}


/* ================= BUSCAR DOCENTES ================= */

campoBuscarDocente.addEventListener("input", () => {
  clearTimeout(temporizadorBusquedaDocente);

  temporizadorBusquedaDocente = setTimeout(() => {
    cargarDocentes(campoBuscarDocente.value.trim());
  }, 300);
});


/* ============= ACTUALIZAR AMBOS MÃ“DULOS ============= */

// Sustituye el listener anterior de botonActualizar por este
// para que el botÃ³n Actualizar respete el mÃ³dulo seleccionado.
botonActualizar.addEventListener("click", async () => {
  try {
    const moduloDocentes = document.getElementById("modulo-docentes");

    if (moduloDocentes && !moduloDocentes.classList.contains("oculto")) {
      await cargarDocentes();
    } else {
      await cargarDashboard();

      const campoBuscar = document.getElementById("campo-buscar");

      if (campoBuscar) {
        await cargarEstudiantes(campoBuscar.value.trim());
      } else {
        await cargarEstudiantes("");
      }
    }

    console.log("ActualizaciÃ³n completada.");
  } catch (error) {
    console.error("Error al actualizar:", error);
    alert("OcurriÃ³ un error al actualizar. Presiona F12 y revisa la consola.");
  }
});

/* ============== MÃ“DULO DE CALIFICACIONES ============== */

async function cargarCalificaciones() {
  const cuerpoTabla = document.getElementById("cuerpo-tabla-calificaciones");
  const textoSinResultados = document.getElementById("texto-sin-calificaciones");

  if (!cuerpoTabla || !textoSinResultados) {
    console.error("No se encontraron los elementos de calificaciones.");
    return;
  }

  cuerpoTabla.replaceChildren();
  textoSinResultados.classList.add("oculto");

  const esDocente = usuarioActual?.rol === "DOCENTE";
  const esAdmin = usuarioActual?.rol === "ADMIN";

  try {
    const endpoint = (esDocente || esAdmin)
      ? `${URL_BASE_API}/calificaciones/listado-docente`
      : `${URL_BASE_API}/calificaciones`;

    const respuesta = await apiFetch(endpoint);

    if (!respuesta.ok) {
      throw new Error(`No se pudieron cargar las calificaciones (${respuesta.status}).`);
    }

    const calificaciones = await respuesta.json();

    if (!Array.isArray(calificaciones) || calificaciones.length === 0) {
      textoSinResultados.textContent = esDocente
        ? "No hay estudiantes matriculados en tus secciones asignadas."
        : "No hay calificaciones registradas para mostrar.";
      textoSinResultados.classList.remove("oculto");
      return;
    }

    calificaciones.forEach((calificacion) => {
      const fila = document.createElement("tr");

      const estudiante = document.createElement("td");
      estudiante.textContent = calificacion.estudiante || "Sin nombre";

      const asignatura = document.createElement("td");
      asignatura.textContent = calificacion.asignatura || "Sin asignatura";

      const nota = document.createElement("td");
      nota.textContent = calificacion.nota_final == null
        ? "Pendiente"
        : Number(calificacion.nota_final).toFixed(2);

      const resultado = document.createElement("td");
      resultado.textContent = calificacion.resultado || "Pendiente";
      resultado.className = calificacion.resultado === "APROBADA"
        ? "estado estado-activo"
        : calificacion.resultado === "REPROBADA"
          ? "estado estado-inactivo"
          : "";

      const acciones = document.createElement("td");

      if (esDocente || esAdmin) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = calificacion.nota_final == null
          ? "Registrar notas"
          : "Editar notas";

        boton.addEventListener("click", async () => {
          const pedirNota = (nombre, valor) => prompt(
            `${calificacion.estudiante} ? ${nombre} (0 a 100):`,
            valor == null ? "" : String(valor)
          );

          const primero = pedirNota("Primer parcial", calificacion.primer_parcial);
          if (primero === null) return;

          const segundo = pedirNota("Segundo parcial", calificacion.segundo_parcial);
          if (segundo === null) return;

          const tercero = pedirNota("Tercer parcial", calificacion.tercer_parcial);
          if (tercero === null) return;

          const notas = [primero, segundo, tercero].map((valor) => valor.trim());

          if (notas.some((valor) => valor === "" || !Number.isFinite(Number(valor)) ||
              Number(valor) < 0 || Number(valor) > 100)) {
            alert("Ingresa los tres parciales con valores entre 0 y 100.");
            return;
          }

          const observacion = prompt(
            "Observaci?n (opcional):",
            calificacion.observacion || ""
          );
          if (observacion === null) return;

          try {
            const guardado = await apiFetch(
              `${URL_BASE_API}/calificaciones/matricula/${calificacion.matricula_id}`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  primer_parcial: Number(primero),
                  segundo_parcial: Number(segundo),
                  tercer_parcial: Number(tercero),
                  observacion: observacion.trim() || null
                })
              }
            );

            if (!guardado.ok) {
              const error = await guardado.json().catch(() => ({}));
              throw new Error(error.detail || `Error ${guardado.status}`);
            }

            alert("Calificaciones guardadas correctamente.");
            await cargarCalificaciones();
          } catch (error) {
            alert(`No se pudieron guardar las notas: ${error.message}`);
          }
        });

        acciones.appendChild(boton);
      } else {
        acciones.textContent = "Consulta";
      }

      fila.append(estudiante, asignatura, nota, resultado, acciones);
      cuerpoTabla.appendChild(fila);
    });
  } catch (error) {
    console.error("Error al cargar calificaciones:", error);
    textoSinResultados.textContent =
      "No se pudieron cargar las calificaciones. Verifica tu sesi?n e int?ntalo de nuevo.";
    textoSinResultados.classList.remove("oculto");
  }
}


/* ============== ACTUALIZAR CALIFICACIONES ============== */

const botonActualizarCalificaciones = document.getElementById(
  "boton-actualizar-calificaciones"
);

if (botonActualizarCalificaciones) {
  botonActualizarCalificaciones.addEventListener("click", () => {
    cargarCalificaciones();
  });
}



// =============== LISTADO DE ASIGNATURAS ===============

async function cargarAsignaturas(buscar = '') {
  const cuerpo = document.getElementById("cuerpo-tabla-asignaturas");
  const mensaje = document.getElementById("texto-sin-asignaturas");

  if (!cuerpo || !mensaje) return;

  cuerpo.replaceChildren();
  mensaje.textContent = "Cargando asignaturas...";
  mensaje.classList.remove("oculto");

  try {
    const parametros = buscar
      ? `?buscar=${encodeURIComponent(buscar)}`
      : "";

    const respuesta = await apiFetch(
      `${URL_BASE_API}/asignaturas${parametros}`
    );

    if (!respuesta.ok) {
      if (respuesta.status === 401) {
        throw new Error("Tu sesi?n no est? activa. Inicia sesi?n nuevamente.");
      }
      if (respuesta.status === 403) {
        throw new Error("No tienes permiso para consultar las asignaturas.");
      }
      throw new Error(`Error al consultar asignaturas (${respuesta.status}).`);
    }

    const asignaturas = await respuesta.json();
    cuerpo.replaceChildren();

    if (!asignaturas.length) {
      mensaje.textContent = buscar
        ? "No se encontraron asignaturas con ese criterio."
        : "No hay asignaturas para mostrar.";
      mensaje.classList.remove("oculto");
      return;
    }

    mensaje.classList.add("oculto");

    asignaturas.forEach((asignatura) => {
      const fila = document.createElement("tr");

      const valores = [
        asignatura.codigo,
        asignatura.nombre,
        asignatura.carrera_nombre,
        asignatura.unidades_valorativas,
        Number(asignatura.activo) === 1 ? "Activa" : "Inactiva",
        "?"
      ];

      valores.forEach((valor) => {
        const celda = document.createElement("td");
        celda.textContent = valor ?? "";
        fila.appendChild(celda);
      });

      cuerpo.appendChild(fila);
    });
  } catch (error) {
    cuerpo.replaceChildren();
    mensaje.textContent = error.message ||
      "No se pudo cargar la lista de asignaturas.";
    mensaje.classList.remove("oculto");
    console.error("Error al cargar asignaturas:", error);
  }
}

// Cargar el listado al entrar en el m?dulo de Asignaturas.
document.querySelectorAll('.boton-modulo[data-modulo="asignaturas"]')
  .forEach((boton) => {
    boton.addEventListener("click", () => {
      cargarAsignaturas(
        document.getElementById("campo-buscar-asignatura")?.value.trim() || ""
      );
    });
  });

// Buscar asignaturas mientras se escribe.
const campoBuscarAsignatura = document.getElementById(
  "campo-buscar-asignatura"
);

if (campoBuscarAsignatura) {
  let temporizadorBusquedaAsignatura;

  campoBuscarAsignatura.addEventListener("input", () => {
    clearTimeout(temporizadorBusquedaAsignatura);
    temporizadorBusquedaAsignatura = setTimeout(() => {
      cargarAsignaturas(campoBuscarAsignatura.value.trim());
    }, 300);
  });
}
