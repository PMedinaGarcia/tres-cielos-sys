# GitHub — Índice

Documentación de operación y gobierno del repositorio remoto **[`PMedinaGarcia/tres-cielos-sys`](https://github.com/PMedinaGarcia/tres-cielos-sys)** para Event Master System (Tres Cielos / Medina Systems). Complementa el índice general en [../README.md](../README.md) y el setup en [../setup/00-indice.md](../setup/00-indice.md).

**Estado del remoto (2026-07-27):** repo **público**, rama `main` sin protección, sin Environments/secrets/workflows; Dependabot security updates y secret scanning (+ push protection) activos. El workspace local concentra la documentación en `docs/`; el remoto aún puede contener solo `README.md` hasta el sync/scaffold.

| # | Documento | Alcance |
|---|---|---|
| 01 | [Repositorio y clonado](01-repositorio-y-clonado.md) | Identidad del repo, visibilidad, clone, estructura remota vs workspace, onboarding Git |
| 02 | [Flujo de trabajo y PRs](02-flujo-trabajo-y-prs.md) | Ramas, commits, plantillas, code review, branch protection en el proceso diario |
| 03 | [Actions CI/CD](03-actions-ci-cd.md) | Pipelines objetivo, triggers, checks required, deploy staging/prod, troubleshooting CI |
| 04 | [Entornos, secretos y gobierno](04-entornos-secretos-gobierno.md) | Environments, inventario de secretos (nombres), OIDC, rulesets, seguridad, releases, acceso, go-live |

## Cómo usar esta carpeta

1. **01 — Repositorio y clonado:** primer contacto (clonar, qué hay en el remoto, cómo encaja con `docs/` local).
2. **02 — Flujo y PRs:** contribuir código/docs sin romper `main` (convenciones y reviews).
3. **03 — Actions CI/CD:** qué debe correr en cada PR/push y cómo desplegar con Environments.
4. **04 — Gobierno:** secretos, protección, seguridad automatizada y checklist antes de go-live Jardín 1.

Ante conflicto entre esta carpeta y el runtime cloud, gana el aislamiento de entornos de [../infrastructure/01-stack-y-entornos.md](../infrastructure/01-stack-y-entornos.md) y los criterios [../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md) (NF-S, INF, §8 CI, §10). **Nunca** documentar ni commitear valores de secretos.

## Lectura recomendada

1. [01-repositorio-y-clonado.md](01-repositorio-y-clonado.md) — contexto del remoto  
2. [02-flujo-trabajo-y-prs.md](02-flujo-trabajo-y-prs.md) — cómo mergear con seguridad  
3. [03-actions-ci-cd.md](03-actions-ci-cd.md) — gates técnicos  
4. [04-entornos-secretos-gobierno.md](04-entornos-secretos-gobierno.md) — Environments, secretos, GH-G-*, checklist go-live  
5. En paralelo: [../setup/03-infraestructura-setup.md](../setup/03-infraestructura-setup.md) (§6 CI, §7 secretos) y [../setup/04-criterios-de-exito.md](../setup/04-criterios-de-exito.md) (§8, §10)
