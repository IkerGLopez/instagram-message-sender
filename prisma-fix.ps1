$dir = "D:\dev\instagram-message-sender\node_modules\.pnpm\@prisma+client@6.19.3_prism_d64af47a59fcb41d9af9f9685cee22aa\node_modules\.prisma\client"
$dll = "$dir\query_engine-windows.dll.node"

# Start prisma generate in background
$process = Start-Process -FilePath "pnpm" -ArgumentList "prisma", "generate" -NoNewWindow -PassThru -RedirectStandardError "$dir\gen.log"

# Monitor for tmp files and copy them immediately
$maxAttempts = 50
for ($i = 0; $i -lt $maxAttempts; $i++) {
    $tmpFiles = Get-ChildItem "$dir\*.tmp*" -Force -ErrorAction SilentlyContinue
    if ($tmpFiles) {
        foreach ($tmp in $tmpFiles) {
            if (Test-Path $dll) {
                # DLL exists, try to replace it
                Remove-Item $dll -Force -ErrorAction SilentlyContinue
            }
            Start-Sleep -Milliseconds 500
            Copy-Item $tmp.FullName $dll -Force -ErrorAction SilentlyContinue
            if (Test-Path $dll) {
                Write-Host "DLL copied successfully!"
                break
            }
        }
    }
    Start-Sleep -Milliseconds 200
}

$process | Wait-Process -Timeout 60 -ErrorAction SilentlyContinue
Write-Host "Generation process finished"
