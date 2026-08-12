param(
    [ValidateSet('ToRelease', 'ToTest')]
    [string]$Direction = 'ToRelease',
    [string]$TestRoot,
    [string]$ReleaseRoot
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($ReleaseRoot)) {
    $ReleaseRoot = Split-Path -Parent $scriptRoot
}

if ([string]::IsNullOrWhiteSpace($TestRoot)) {
    $parentRoot = Split-Path -Parent $ReleaseRoot
    $TestRoot = Join-Path $parentRoot 'UnityTools'
}

$ReleaseRoot = [System.IO.Path]::GetFullPath($ReleaseRoot)
$TestRoot = [System.IO.Path]::GetFullPath($TestRoot)

function Copy-DirectoryContent {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        throw "找不到同步源目录：$Source"
    }

    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Copy-Item -Path (Join-Path $Source '*') -Destination $Destination -Recurse -Force
}

function Copy-UnityTool {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        throw "找不到同步源目录：$Source"
    }

    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    $sourceEditor = Join-Path $Source 'Editor'
    $destinationEditor = Join-Path $Destination 'Editor'
    New-Item -ItemType Directory -Path $destinationEditor -Force | Out-Null

    # 验收批处理只属于测试项目，发布副本不携带 GameMenu 和 GameLauncher 绑定。
    Get-ChildItem -LiteralPath $sourceEditor -Force |
        Where-Object { $_.Name -ne 'Acceptance' -and $_.Name -ne 'Acceptance.meta' } |
        Copy-Item -Destination $destinationEditor -Recurse -Force

    Get-ChildItem -LiteralPath $Source -Force |
        Where-Object { $_.Name -ne 'Editor' } |
        Copy-Item -Destination $Destination -Recurse -Force
}

function Copy-FileIfExists {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        throw "找不到同步源文件：$Source"
    }

    New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

$testToolRoot = Join-Path $TestRoot 'Tools\Assets\UIReactTool'
$releaseToolRoot = Join-Path $ReleaseRoot 'Assets\UIReactTool'
$testReactRoot = Join-Path $TestRoot 'UIReact'
$releaseReactRoot = Join-Path $ReleaseRoot 'ReactPreview'

if ($Direction -eq 'ToRelease') {
    Copy-UnityTool -Source $testToolRoot -Destination $releaseToolRoot

    foreach ($file in @('index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts')) {
        Copy-FileIfExists -Source (Join-Path $testReactRoot $file) -Destination (Join-Path $releaseReactRoot $file)
    }

    Copy-DirectoryContent -Source (Join-Path $testReactRoot 'src') -Destination (Join-Path $releaseReactRoot 'src')
    Copy-FileIfExists -Source (Join-Path $testReactRoot 'Acceptance\SampleDialog.tsx') -Destination (Join-Path $releaseReactRoot 'Generated\SampleDialog\SampleDialog.tsx')
}
else {
    Copy-UnityTool -Source $releaseToolRoot -Destination $testToolRoot

    foreach ($file in @('index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts')) {
        Copy-FileIfExists -Source (Join-Path $releaseReactRoot $file) -Destination (Join-Path $testReactRoot $file)
    }

    Copy-DirectoryContent -Source (Join-Path $releaseReactRoot 'src') -Destination (Join-Path $testReactRoot 'src')
    Copy-FileIfExists -Source (Join-Path $releaseReactRoot 'Generated\SampleDialog\SampleDialog.tsx') -Destination (Join-Path $testReactRoot 'Acceptance\SampleDialog.tsx')
}

Write-Output "同步完成：$Direction"
Write-Output "测试项目：$TestRoot"
Write-Output "发布目录：$ReleaseRoot"
