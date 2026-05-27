# Run this script as Administrator to fix the EPERM issue
Add-MpPreference -ExclusionPath 'C:\Users\ACER\.kiro'
Add-MpPreference -ExclusionPath 'D:\aromai-qualsense-starter\.kiro'
Write-Host 'Windows Defender exclusions added successfully!' -ForegroundColor Green
Write-Host 'You can now close this window and continue working in Kiro.'
pause