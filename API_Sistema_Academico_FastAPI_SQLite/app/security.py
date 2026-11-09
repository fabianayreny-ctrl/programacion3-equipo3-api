
from secrets import token_urlsafe
from threading import Lock

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

esquema_bearer = HTTPBearer(auto_error=False)

_sesiones = {}
_bloqueo = Lock()


def crear_sesion(usuario: dict) -> str:
    token = token_urlsafe(32)

    with _bloqueo:
        _sesiones[token] = usuario

    return token


def cerrar_sesion(token: str) -> None:
    with _bloqueo:
        _sesiones.pop(token, None)


def obtener_usuario_actual(
    credenciales: HTTPAuthorizationCredentials | None = Depends(
        esquema_bearer
    ),
):
    if credenciales is None:
        raise HTTPException(
            status_code=401,
            detail="Debe iniciar sesión para acceder a este recurso",
        )

    with _bloqueo:
        usuario = _sesiones.get(credenciales.credentials)

    if usuario is None:
        raise HTTPException(
            status_code=401,
            detail="La sesión no es válida o ha expirado",
        )

    return usuario


def exigir_roles(*roles_permitidos: str):
    def verificar_rol(usuario: dict = Depends(obtener_usuario_actual)):
        if usuario["rol"] not in roles_permitidos:
            raise HTTPException(
                status_code=403,
                detail="No tiene permisos para realizar esta operación",
            )
        return usuario

    return verificar_rol
