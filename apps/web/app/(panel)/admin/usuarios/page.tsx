"use client";

import { ConfirmDeleteDialog } from "@/components/crm/confirm-delete";
import { GlassPanel } from "@/components/glass-panel";
import {
  createUser,
  deleteUser,
  listSedes,
  listUsers,
  patchUser,
  setCredentials,
} from "@/lib/auth-api";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/http";
import type { RolUsuario, SedeDto, UserDto } from "@tres-cielos/shared";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const ROLES: RolUsuario[] = ["asesor", "coordinador", "admin"];

const ROL_LABEL: Record<RolUsuario, string> = {
  asesor: "Asesor",
  coordinador: "Coordinador",
  admin: "Administrador",
};

const ROL_AYUDA: Record<RolUsuario, string> = {
  asesor: "Atiende solo los clientes que tiene asignados.",
  coordinador: "Ve la sede, reasigna leads y consulta la carga del equipo.",
  admin: "Además administra usuarios, catálogo y conocimiento.",
};

export default function AdminUsuariosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [sedes, setSedes] = useState<SedeDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<RolUsuario>("asesor");
  const [sedeIds, setSedeIds] = useState<string[]>([]);

  const [credUserId, setCredUserId] = useState<string | null>(null);
  const [credPassword, setCredPassword] = useState("");
  const [permUser, setPermUser] = useState<UserDto | null>(null);
  const [permRol, setPermRol] = useState<RolUsuario>("asesor");
  const [permSedes, setPermSedes] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<UserDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || user.rol !== "admin") {
      router.replace("/");
    }
  }, [loading, user, router]);

  async function reload() {
    const [u, s] = await Promise.all([listUsers(), listSedes()]);
    setUsers(u);
    setSedes(s);
    if (s.length && sedeIds.length === 0) {
      setSedeIds(s.filter((x) => x.activa).map((x) => x.id));
    }
  }

  useEffect(() => {
    if (!user || user.rol !== "admin") return;
    void reload().catch((e) =>
      setError(e instanceof Error ? e.message : "Error al cargar"),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createUser({ nombre, email, password, rol, sedeIds });
      setNombre("");
      setEmail("");
      setPassword("");
      await reload();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActivo(target: UserDto) {
    setError(null);
    try {
      await patchUser(target.id, { activo: !target.activo });
      await reload();
    } catch (err) {
      setError(messageFrom(err));
    }
  }

  async function onDelete() {
    if (!pendingDelete) return;
    setDeleteError(null);
    setBusy(true);
    try {
      await deleteUser(pendingDelete.id);
      if (credUserId === pendingDelete.id) {
        setCredUserId(null);
        setCredPassword("");
      }
      if (permUser?.id === pendingDelete.id) setPermUser(null);
      setPendingDelete(null);
      await reload();
    } catch (err) {
      setDeleteError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }

  function openPermisos(target: UserDto) {
    setError(null);
    setCredUserId(null);
    setPermUser(target);
    setPermRol(target.rol);
    setPermSedes(target.sedeIds);
  }

  async function onSavePermisos(e: FormEvent) {
    e.preventDefault();
    if (!permUser) return;
    setError(null);
    setBusy(true);
    try {
      const saved = await patchUser(permUser.id, {
        rol: permRol,
        sedeIds: permSedes,
      });
      setPermUser(saved);
      setPermRol(saved.rol);
      setPermSedes(saved.sedeIds);
      await reload();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSetCredentials(e: FormEvent) {
    e.preventDefault();
    if (!credUserId) return;
    setError(null);
    setBusy(true);
    try {
      await setCredentials(credUserId, credPassword);
      setCredUserId(null);
      setCredPassword("");
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || user.rol !== "admin") {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-ink/50">
        Cargando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <GlassPanel className="px-8 py-8">
        <h1 className="font-display text-3xl text-ink">Usuarios</h1>
        <p className="mt-1 text-sm text-ink/60">
          Alta, permisos, credenciales y baja definitiva. No hay registro público.
        </p>
      </GlassPanel>

      {error && (
        <p className="rounded-xl bg-red-50/80 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      <GlassPanel className="px-8 py-8">
        <h2 className="font-display text-xl text-teal">Crear usuario</h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-xs font-medium text-ink/70">
            Nombre
            <input
              className="glass-input mt-1"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-ink/70">
            Correo
            <input
              className="glass-input mt-1"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-ink/70">
            Contraseña inicial
            <input
              className="glass-input mt-1"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="mt-1 block font-normal text-ink/45">
              Mínimo 12, mayúscula, minúscula y dígito.
            </span>
          </label>
          <label className="text-xs font-medium text-ink/70">
            Rol
            <select
              className="glass-input mt-1"
              value={rol}
              onChange={(e) => setRol(e.target.value as RolUsuario)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROL_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="md:col-span-2">
            <legend className="text-xs font-medium text-ink/70">Sedes</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {sedes.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sedeIds.includes(s.id)}
                    onChange={(e) => {
                      setSedeIds((prev) =>
                        e.target.checked
                          ? [...prev, s.id]
                          : prev.filter((id) => id !== s.id),
                      );
                    }}
                  />
                  {s.nombre}
                  {!s.activa ? " (inactiva)" : ""}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="md:col-span-2">
            <button type="submit" disabled={busy} className="btn-teal">
              {busy ? "Guardando…" : "Crear y credencializar"}
            </button>
          </div>
        </form>
      </GlassPanel>

      <GlassPanel className="overflow-x-auto px-8 py-8">
        <h2 className="font-display text-xl text-teal">Directorio</h2>
        <table className="mt-4 w-full min-w-[40rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink/45">
            <tr>
              <th className="py-2">Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/50">
                <td className="py-3">{u.nombre}</td>
                <td>{u.email}</td>
                <td>{ROL_LABEL[u.rol]}</td>
                <td>{u.activo ? "activo" : "inactivo"}</td>
                <td className="space-x-2 text-right">
                  <button
                    type="button"
                    className="text-xs text-teal underline"
                    onClick={() => void toggleActivo(u)}
                    disabled={u.id === user.id}
                  >
                    {u.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-teal underline"
                    onClick={() => openPermisos(u)}
                  >
                    Permisos
                  </button>
                  <button
                    type="button"
                    className="text-xs text-teal underline"
                    onClick={() => {
                      setPermUser(null);
                      setCredUserId(u.id);
                      setCredPassword("");
                    }}
                  >
                    Credenciales
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-800 underline disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => {
                      setDeleteError(null);
                      setPendingDelete(u);
                    }}
                    disabled={u.id === user.id}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassPanel>

      {permUser && (
        <GlassPanel strong className="px-8 py-8">
          <h2 className="font-display text-xl text-teal">
            Permisos de {permUser.nombre}
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            El rol define qué puede hacer. Las sedes definen qué jardines ve.
            El acceso nuevo aplica de inmediato; si ya tiene sesión, el menú
            se actualiza al recargar.
          </p>
          <form onSubmit={onSavePermisos} className="mt-4 space-y-4">
            <label className="block max-w-sm text-xs font-medium text-ink/70">
              Rol
              <select
                className="glass-input mt-1"
                value={permRol}
                disabled={permUser.id === user.id}
                onChange={(e) => setPermRol(e.target.value as RolUsuario)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROL_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-ink/70">{ROL_AYUDA[permRol]}</p>
            {permUser.id === user.id ? (
              <p className="text-sm text-ink/55">No puedes cambiar tu propio rol.</p>
            ) : null}
            <fieldset>
              <legend className="text-xs font-medium text-ink/70">Sedes</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {sedes.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={permSedes.includes(s.id)}
                      onChange={(e) => {
                        setPermSedes((prev) =>
                          e.target.checked
                            ? [...prev, s.id]
                            : prev.filter((id) => id !== s.id),
                        );
                      }}
                    />
                    {s.nombre}
                    {!s.activa ? " (inactiva)" : ""}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={busy || permSedes.length === 0}
                className="btn-teal"
              >
                {busy ? "Guardando…" : "Guardar permisos"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setPermUser(null)}
              >
                Cerrar
              </button>
            </div>
          </form>
        </GlassPanel>
      )}

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title="Eliminar usuario"
        description={
          pendingDelete
            ? `Se borra de la base la cuenta de ${pendingDelete.nombre} (${pendingDelete.email}). Pierde el acceso y el correo queda libre para otra cuenta. Los clientes que tenía asignados quedan sin asesor. Las notas que escribió se conservan. Esta acción no se puede deshacer.`
            : ""
        }
        busy={busy}
        error={deleteError}
        onCancel={() => {
          if (busy) return;
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={() => void onDelete()}
      />

      {credUserId && (
        <GlassPanel strong className="px-8 py-8">
          <h2 className="font-display text-xl text-teal">Rotar contraseña</h2>
          <p className="mt-1 text-sm text-ink/60">
            Invalida sesiones vigentes de ese usuario.
          </p>
          <form onSubmit={onSetCredentials} className="mt-4 flex flex-wrap gap-3">
            <input
              className="glass-input max-w-sm"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              placeholder="Nueva contraseña"
              value={credPassword}
              onChange={(e) => setCredPassword(e.target.value)}
            />
            <button type="submit" disabled={busy} className="btn-teal">
              Guardar
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setCredUserId(null)}
            >
              Cancelar
            </button>
          </form>
        </GlassPanel>
      )}
    </div>
  );
}

function messageFrom(err: unknown): string {
  if (err instanceof ApiError) {
    try {
      const parsed = JSON.parse(err.message) as {
        message?: string | string[];
      };
      if (Array.isArray(parsed.message)) return parsed.message.join(". ");
      if (parsed.message) return parsed.message;
    } catch {
      /* raw */
    }
    return err.message || `Error ${err.status}`;
  }
  return err instanceof Error ? err.message : "Error inesperado";
}
