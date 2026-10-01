# Entregables de producto

## Flujo v4 — guion completo + matriz de copys

| Archivo | Uso |
|---------|-----|
| `flujo-v4-guion-completo.pdf` | PDF definitivo (§1 diagrama, §2 referencia #1–#31, §3 matriz cliente) |
| `flujo-v4-arquitectura-y-copy.html` | Fuente editable (UTF-8) |

Regenerar PDF:

```powershell
$bin  = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$dir  = Resolve-Path "."
$html = Join-Path $dir "flujo-v4-arquitectura-y-copy.html"
$pdf  = Join-Path $dir "flujo-v4-guion-completo.pdf"
& $bin --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="$pdf" ([uri]::new($html).AbsoluteUri)
```
