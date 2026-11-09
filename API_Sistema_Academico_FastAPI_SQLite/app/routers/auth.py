from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.database import conexion_lectura, hash_clave
from app.schemas import UsuarioLogin, UsuarioRespuesta
from app.security import (
    crear_sesion,
    cerrar_sesion,
    esquema_bearer,
)


router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=UsuarioRespuesta)
def iniciar_sesion(datos: UsuarioLogin):
    with conexion_lectura() as conexion:
        fila = conexion.execute(
            """
            SELECT *
            FROM usuarios
            WHERE usuario = ?
            """,
            (datos.usuario,),
        ).fetchone()

    if fila is None or fila["clave_hash"] != hash_clave(datos.clave):
        raise HTTPException(
            status_code=401,
            detail="Usuario o contraseña incorrectos",
        )

    if not fila["activo"]:
        raise HTTPException(
            status_code=403,
            detail="Este usuario está inactivo",
        )

    usuario = {
        "id": fila["id"],
        "usuario": fila["usuario"],
        "nombre_completo": fila["nombre_completo"],
        "rol": fila["rol"],
        "docente_id": fila["docente_id"],
        "estudiante_id": fila["estudiante_id"],
    }

    token = crear_sesion(usuario)

    return {
        "id": usuario["id"],
        "usuario": usuario["usuario"],
        "nombre_completo": usuario["nombre_completo"],
        "rol": usuario["rol"],
        "docente_id": usuario.get("docente_id"),
        "estudiante_id": usuario.get("estudiante_id"),
        "access_token": token,
        "token_type": "bearer",
    }


@router.post("/logout")
def cerrar_sesion_usuario(
    credenciales: HTTPAuthorizationCredentials | None = Depends(
        esquema_bearer
    ),
):
    if credenciales is not None:
        cerrar_sesion(credenciales.credentials)

    return {"mensaje": "Sesión cerrada"}
