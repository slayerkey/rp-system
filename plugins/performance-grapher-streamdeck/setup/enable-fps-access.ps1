param(
    [string]$MemberSid = ""
)

$ErrorActionPreference = "Stop"
$PerformanceLogUsersSid = "S-1-5-32-559"

function Test-Member {
    param(
        [string]$GroupSid,
        [string]$UserSid
    )

    $group = Get-LocalGroup -SID $GroupSid -ErrorAction Stop
    $members = @(Get-LocalGroupMember -Group $group.Name -ErrorAction Stop)
    return [bool]($members | Where-Object {
        $_.SID -and [string]$_.SID.Value -eq $UserSid
    })
}

if ([string]::IsNullOrWhiteSpace($MemberSid)) {
    $MemberSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
}

try {
    if (Test-Member -GroupSid $PerformanceLogUsersSid -UserSid $MemberSid) {
        exit 0
    }
}
catch {
    # Continue to the elevated path. Some systems restrict local-group reads.
}

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    $powershell = Join-Path $PSHOME "powershell.exe"
    $arguments = @(
        "-NoLogo",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", ('"' + $PSCommandPath + '"'),
        "-MemberSid", ('"' + $MemberSid + '"')
    ) -join " "

    try {
        $child = Start-Process -FilePath $powershell -Verb RunAs -ArgumentList $arguments -Wait -PassThru
        exit $child.ExitCode
    }
    catch {
        exit 1223
    }
}

$group = Get-LocalGroup -SID $PerformanceLogUsersSid -ErrorAction Stop
$userSid = New-Object System.Security.Principal.SecurityIdentifier($MemberSid)
$account = $userSid.Translate([System.Security.Principal.NTAccount]).Value

if (-not (Test-Member -GroupSid $PerformanceLogUsersSid -UserSid $MemberSid)) {
    Add-LocalGroupMember -Group $group.Name -Member $account -ErrorAction Stop
}

exit 0
