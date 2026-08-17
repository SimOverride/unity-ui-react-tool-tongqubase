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
    # 发布目录与测试项目位于同一个 UnityTools 工作区，测试项目目录是发布目录的父目录。
    $TestRoot = Split-Path -Parent $ReleaseRoot
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
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $true)][bool]$RemoveAcceptance
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        throw "找不到同步源目录：$Source"
    }

    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    $sourceEditor = Join-Path $Source 'Editor'
    $destinationEditor = Join-Path $Destination 'Editor'
    $sourceTests = Join-Path $Source 'Tests'
    $destinationTests = Join-Path $Destination 'Tests'

    if (-not (Test-Path -LiteralPath $sourceEditor)) {
        throw "工具源目录缺少 Editor：$sourceEditor"
    }
    if (-not (Test-Path -LiteralPath $sourceTests)) {
        throw "工具源目录缺少 Tests：$sourceTests"
    }

    # 发布副本是 UPM 包根目录，清理旧版 Assets/UIReactTool 嵌套结构。
    if ($RemoveAcceptance) {
        $legacyToolRoot = Join-Path $Destination 'Assets\UIReactTool'
        $legacyToolMeta = Join-Path $Destination 'Assets\UIReactTool.meta'
        $legacyAssetsRoot = Join-Path $Destination 'Assets'
        if (Test-Path -LiteralPath $legacyToolRoot) {
            Remove-Item -LiteralPath $legacyToolRoot -Recurse -Force
        }
        if (Test-Path -LiteralPath $legacyToolMeta) {
            Remove-Item -LiteralPath $legacyToolMeta -Force
        }
        if (Test-Path -LiteralPath $legacyAssetsRoot) {
            $legacyAssets = @(Get-ChildItem -LiteralPath $legacyAssetsRoot -Force)
            if ($legacyAssets.Count -eq 0) {
                Remove-Item -LiteralPath $legacyAssetsRoot -Force
            }
        }
        if (Test-Path -LiteralPath $destinationEditor) {
            Remove-Item -LiteralPath $destinationEditor -Recurse -Force
        }
    }
    else {
        # 回灌测试项目时清理旧工具文件，但保留测试专用的 Acceptance 目录。
        if (Test-Path -LiteralPath $destinationEditor) {
            Get-ChildItem -LiteralPath $destinationEditor -Force |
                Where-Object { $_.Name -ne 'Acceptance' -and $_.Name -ne 'Acceptance.meta' } |
                Remove-Item -Recurse -Force
        }
    }

    if (Test-Path -LiteralPath $destinationTests) {
        Remove-Item -LiteralPath $destinationTests -Recurse -Force
    }

    New-Item -ItemType Directory -Path $destinationEditor -Force | Out-Null

    # 验收批处理只属于测试项目，发布包不携带 GameMenu 和 GameLauncher 绑定。
    Get-ChildItem -LiteralPath $sourceEditor -Force |
        Where-Object { $_.Name -ne 'Acceptance' -and $_.Name -ne 'Acceptance.meta' } |
        Copy-Item -Destination $destinationEditor -Recurse -Force

    Copy-Item -LiteralPath $sourceTests -Destination $Destination -Recurse -Force

    $editorMeta = Join-Path $Source 'Editor.meta'
    if (Test-Path -LiteralPath $editorMeta) {
        Copy-Item -LiteralPath $editorMeta -Destination $Destination -Force
    }

    $testsMeta = Join-Path $Source 'Tests.meta'
    if (Test-Path -LiteralPath $testsMeta) {
        Copy-Item -LiteralPath $testsMeta -Destination $Destination -Force
    }
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
$releaseToolRoot = $ReleaseRoot
$testReactRoot = Join-Path $TestRoot 'UIReact'
$releaseReactRoot = Join-Path $ReleaseRoot 'ReactPreview'

if ($Direction -eq 'ToRelease') {
    Copy-UnityTool -Source $testToolRoot -Destination $releaseToolRoot -RemoveAcceptance $true

    foreach ($file in @('index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts')) {
        Copy-FileIfExists -Source (Join-Path $testReactRoot $file) -Destination (Join-Path $releaseReactRoot $file)
    }

    Copy-DirectoryContent -Source (Join-Path $testReactRoot 'src') -Destination (Join-Path $releaseReactRoot 'src')
    Copy-FileIfExists -Source (Join-Path $testReactRoot 'Acceptance\SampleDialog.tsx') -Destination (Join-Path $releaseReactRoot 'Generated\SampleDialog\SampleDialog.tsx')
}
else {
    Copy-UnityTool -Source $releaseToolRoot -Destination $testToolRoot -RemoveAcceptance $false

    foreach ($file in @('index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts')) {
        Copy-FileIfExists -Source (Join-Path $releaseReactRoot $file) -Destination (Join-Path $testReactRoot $file)
    }

    Copy-DirectoryContent -Source (Join-Path $releaseReactRoot 'src') -Destination (Join-Path $testReactRoot 'src')
    Copy-FileIfExists -Source (Join-Path $releaseReactRoot 'Generated\SampleDialog\SampleDialog.tsx') -Destination (Join-Path $testReactRoot 'Acceptance\SampleDialog.tsx')
}

Write-Output "同步完成：$Direction"
Write-Output "测试项目：$TestRoot"
Write-Output "发布目录：$ReleaseRoot"
