# Cierra visores/IDE con PDFs abiertos en esta carpeta antes de ejecutar.
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$keep = @(
  'flujo-v4-guion-completo.pdf',
  'flujo-v4-arquitectura-y-copy.html',
  'README.md',
  'cleanup-obsolete-pdfs.ps1'
)
Get-ChildItem -Path $here -Filter '*.pdf' -File | Where-Object { $keep -notcontains $_.Name } | ForEach-Object {
  Remove-Item -LiteralPath $_.FullName -Force
  Write-Host "Eliminado: $($_.Name)"
}
$staging = Join-Path $here '_flujo-v4-guion-completo.pdf'
if (Test-Path $staging) {
  Move-Item -LiteralPath $staging -Destination (Join-Path $here 'flujo-v4-guion-completo.pdf') -Force
  Write-Host 'Renombrado _flujo-v4-guion-completo.pdf -> flujo-v4-guion-completo.pdf'
}
Write-Host 'Listo.'
