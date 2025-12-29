# F:\entomate\tools\scan-settings.ps1
$root = "F:\entomate"
$outDir = Join-Path $root "tools\_scan_output"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$patterns = @(
  "settings",
  "theme|dark|light|appearance|accent|highlight|color",
  "ADMIN_API_KEY|GEMINI|API[_-]?KEY|SAML|SSO|SCIM|OIDC|OAuth",
  "audit[_-]?log|audit trail",
  "retention|export|dlp|compliance|SOC2|GDPR",
  "permissions|RBAC|role|guest",
  "webhook|integration|CRM|Pulse"
)

$include = @("*.ts","*.tsx","*.js","*.jsx","*.json","*.md","*.env*","*.yml","*.yaml","*.sql")

$results = @()
foreach ($p in $patterns) {
  $matches = Get-ChildItem -Path $root -Recurse -File -Include $include -ErrorAction SilentlyContinue |
    Select-String -Pattern $p -List -ErrorAction SilentlyContinue

  foreach ($m in $matches) {
    $results += [PSCustomObject]@{
      pattern = $p
      file = $m.Path
      line = $m.LineNumber
      text = ($m.Line.Trim() -replace "\s+"," ")
    }
  }
}

$results |
  Sort-Object file,line |
  Export-Csv -NoTypeInformation -Path (Join-Path $outDir "settings-scan.csv")

$results |
  Sort-Object file,line |
  Select-Object file,line,text |
  ConvertTo-Json -Depth 4 |
  Out-File -Encoding utf8 (Join-Path $outDir "settings-scan.json")

Write-Host "Done. Output:"
Write-Host (Join-Path $outDir "settings-scan.csv")
Write-Host (Join-Path $outDir "settings-scan.json")
