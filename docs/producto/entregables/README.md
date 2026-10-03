# Entregables de producto

## Flujo v4 ù guion completo + matriz de copys

| Archivo | Uso |
|---------|-----|
| `flujo-v4-guion-completo.pdf` | PDF definitivo (ù1 diagrama, ù2 capturas sandbox, ù3ùù4 matrices) |
| `flujo-v4-arquitectura-y-copy.html` | Fuente editable (UTF-8) |
| `capturas/*.png` | Screenshots del Chat sandbox referenciados en el HTML |

Regenerar PDF (cierra el PDF si estù abierto en el IDE):

```powershell
$bin  = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $bin)) { $bin = "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe" }
$dir  = Resolve-Path "."
$html = Join-Path $dir "flujo-v4-arquitectura-y-copy.html"
$pdf  = Join-Path $dir "flujo-v4-guion-completo.pdf"
& $bin --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="$pdf" ([uri]::new($html.Path).AbsoluteUri)
```

Si el PDF definitivo est· abierto en el IDE, imprime a `_flujo-v4-guion-completo.pdf` y luego ejecuta `cleanup-obsolete-pdfs.ps1`.
