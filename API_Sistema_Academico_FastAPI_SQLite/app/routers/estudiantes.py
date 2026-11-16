
import secrets
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import conexion_lectura, transaccion, hash_clave
from app.helpers import filas_a_lista, obtener_o_404
from app.security import obtener_usuario_actual, exigir_roles
from app.schemas import (
    EstudianteEntrada,
    EstudianteRespuesta,
    EstudianteCreadoRespuesta,
    MensajeRespuesta,
)


router = APIRouter(prefix="/estudiantes", tags=["Estudiantes"])


CONSULTA_BASE = """
    SELECT e.id, e.cuenta, e.nombres, e.apellidos, e.correo, e.telefono,
           e.fecha_nacimiento, e.carrera_id, e.estado,
           c.codigo AS carrera_codigo, c.nombre AS carrera_nombre
    FROM estudiantes e
    JOIN carreras c ON c.id = e.carrera_id
"""


def _validar_carrera(conexion, carrera_id: int) -> None:
    carrera = obtener_o_404(conexion, "carreras", carrera_id, "Carrera")
    if not carrera["activo"]:
        raise HTTPException(409, "No se puede asignar una carrera inactiva")


@router.get("", response_model=list[EstudianteRespuesta])
def listar_estudiantes(
    buscar: str | None = Query(default=None, max_length=100),
    carrera_id: int | None = Query(default=None, gt=0),
    estado: str | None = Query(
        default=None, pattern="^(ACTIVO|INACTIVO|GRADUADO)$"
    ),
    limite: int = Query(default=50, ge=1, le=100),
    desplazamiento: int = Query(default=0, ge=0),
):
    condiciones: list[str] = []
    parametros: list[object] = []
    if buscar:
        condiciones.append(
            "(e.cuenta LIKE ? OR e.nombres LIKE ? OR e.apellidos LIKE ? "
            "OR e.correo LIKE ?)"
        )
        patron = f"%{buscar}%"
        parametros.extend([patron] * 4)
    if carrera_id:
        condiciones.append("e.carrera_id = ?")
        parametros.append(carrera_id)
    if estado:
        condiciones.append("e.estado = ?")
        parametros.append(estado)

    where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""
    parametros.extend([limite, desplazamiento])
    with conexion_lectura() as conexion:
        filas = conexion.execute(
            f"{CONSULTA_BASE} {where} "
            "ORDER BY e.apellidos, e.nombres LIMIT ? OFFSET ?",
            parametros,
        ).fetchall()
    return filas_a_lista(filas)




@router.get("/mi-historial")
def mi_historial_academico(usuario: dict = Depends(obtener_usuario_actual)):
    """Devuelve las asignaturas del estudiante autenticado, sin aceptar IDs ajenos."""
    if usuario.get("rol") != "ESTUDIANTE" or not usuario.get("estudiante_id"):
        raise HTTPException(403, "Este recurso es exclusivo para estudiantes")
    with conexion_lectura() as conexion:
        filas = conexion.execute(
            """
            SELECT m.id AS matricula_id, a.codigo AS asignatura_codigo,
                   a.nombre AS asignatura, s.codigo AS seccion,
                   p.anio || '-P' || p.numero AS periodo,
                   d.nombres || ' ' || d.apellidos AS docente,
                   m.fecha_matricula, m.estado AS estado_matricula,
                   c.primer_parcial, c.segundo_parcial, c.tercer_parcial,
                   c.nota_final,
                   CASE
                     WHEN m.estado = 'CANCELADA' THEN 'Cancelada'
                     WHEN s.estado = 'FINALIZADA' OR m.estado IN ('APROBADA','REPROBADA') THEN 'Terminado'
                     ELSE 'En curso'
                   END AS estado_cursado,
                   CASE WHEN c.nota_final IS NULL THEN 'Pendiente'
                        WHEN c.nota_final >= 65 THEN 'Aprobada' ELSE 'Reprobada' END AS resultado
            FROM matriculas m
            JOIN secciones s ON s.id=m.seccion_id
            JOIN asignaturas a ON a.id=s.asignatura_id
            JOIN periodos p ON p.id=s.periodo_id
            JOIN docentes d ON d.id=s.docente_id
            LEFT JOIN calificaciones c ON c.matricula_id=m.id
            WHERE m.estudiante_id=?
            ORDER BY p.anio DESC, p.numero DESC, a.nombre
            """, (usuario["estudiante_id"],)
        ).fetchall()
    return [dict(f) for f in filas]


@router.get("/{estudiante_id}", response_model=EstudianteRespuesta)
def obtener_estudiante(estudiante_id: int):
    with conexion_lectura() as conexion:
        fila = conexion.execute(
            f"{CONSULTA_BASE} WHERE e.id = ?", (estudiante_id,)
        ).fetchone()

    if fila is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No se encontró ningún estudiante con el ID {estudiante_id}. "
                "Verifica el identificador e inténtalo nuevamente."
            ),
        )
    return dict(fila)



@router.post(
    "",
    response_model=EstudianteCreadoRespuesta,
    status_code=status.HTTP_201_CREATED,
)
def crear_estudiante(datos: EstudianteEntrada, usuario: dict = Depends(exigir_roles("ADMIN"))):

    clave_temporal = secrets.token_urlsafe(9)
    usuario = datos.cuenta

    try:
        with transaccion() as conexion:
            _validar_carrera(conexion, datos.carrera_id)

            cursor = conexion.execute(
                """
                INSERT INTO estudiantes
                    (cuenta, nombres, apellidos, correo, telefono,
                     fecha_nacimiento, carrera_id, estado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    datos.cuenta,
                    datos.nombres,
                    datos.apellidos,
                    str(datos.correo).lower(),
                    datos.telefono,
                    datos.fecha_nacimiento.isoformat(),
                    datos.carrera_id,
                    datos.estado,
                ),
            )

            estudiante_id = cursor.lastrowid

            conexion.execute(
                """
                INSERT INTO usuarios
                    (usuario, nombre_completo, clave_hash, rol,
                     activo, estudiante_id)
                VALUES (?, ?, ?, 'ESTUDIANTE', 1, ?)
                """,
                (
                    usuario,
                    f"{datos.nombres} {datos.apellidos}",
                    hash_clave(clave_temporal),
                    estudiante_id,
                ),
            )

            fila = conexion.execute(
                f"{CONSULTA_BASE} WHERE e.id = ?",
                (estudiante_id,),
            ).fetchone()

            respuesta = dict(fila)
            respuesta["usuario"] = usuario
            respuesta["clave_temporal"] = clave_temporal

            return respuesta

    except sqlite3.IntegrityError as error:
        raise HTTPException(
            409,
            "La cuenta, el usuario o el correo ya estÃ¡n registrados.",
        ) from error

