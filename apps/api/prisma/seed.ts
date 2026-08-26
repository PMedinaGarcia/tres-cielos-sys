import { PrismaClient, RolUsuario } from "@prisma/client";
import { hashPassword } from "../src/auth/password";
import {
  passwordOmitsEmail,
  passwordPolicySchema,
  SEDE_ID,
  SEDE_NOMBRE,
} from "@tres-cielos/shared";

const prisma = new PrismaClient();

const ORG_ID = "org-tres-cielos";

function assertPassword(password: string, email: string) {
  const parsed = passwordPolicySchema.safeParse(password);
  if (!parsed.success) {
    throw new Error(
      `AUTH_BOOTSTRAP_ADMIN_PASSWORD no cumple política: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
    );
  }
  if (!passwordOmitsEmail(password, email)) {
    throw new Error(
      "AUTH_BOOTSTRAP_ADMIN_PASSWORD no debe contener el correo",
    );
  }
}

async function upsertUser(input: {
  id: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);
  await prisma.usuario.upsert({
    where: { email: input.email },
    create: {
      id: input.id,
      email: input.email,
      nombre: input.nombre,
      rol: input.rol,
      passwordHash,
      organizacionId: ORG_ID,
      activo: true,
      disponible: true,
      sedes: { create: { sedeId: SEDE_ID } },
    },
    update: {
      nombre: input.nombre,
      rol: input.rol,
      passwordHash,
      activo: true,
    },
  });
}

async function main() {
  await prisma.organizacion.upsert({
    where: { id: ORG_ID },
    create: { id: ORG_ID, nombre: "Tres Cielos", activa: true },
    update: { nombre: "Tres Cielos", activa: true },
  });

  await prisma.sede.upsert({
    where: { id: SEDE_ID },
    create: {
      id: SEDE_ID,
      nombre: SEDE_NOMBRE,
      activa: true,
      organizacionId: ORG_ID,
      zonaHoraria: "America/Mexico_City",
    },
    update: { nombre: SEDE_NOMBRE, activa: true },
  });

  const password = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD;
  const adminEmail =
    process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL ?? "admin@trescielos.local";

  if (!password) {
    console.log(
      "Seed identidad: org + sede OK. Sin AUTH_BOOTSTRAP_ADMIN_PASSWORD — no se crean usuarios.",
    );
    return;
  }

  assertPassword(password, adminEmail);

  await upsertUser({
    id: "user-admin-bootstrap",
    email: adminEmail,
    nombre: "Admin",
    rol: RolUsuario.admin,
    password,
  });

  console.log(`Seed identidad: admin ${adminEmail}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
