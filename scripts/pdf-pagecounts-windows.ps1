<#
.SYNOPSIS
  複数PDFのページ数のみを取得する軽量ヘルパー（WinRT Windows.Data.Pdf使用）。
  OCRバッチ実行前に、対象PDFが読み込み可能かどうかの事前スクリーニングに使う。
.PARAMETER FileListPath
  1行1件、`issueId|絶対パス（バックスラッシュ区切り）` 形式のテキストファイル。
.OUTPUTS
  標準出力に1件1行、`issueId|pageCount`（読み込み失敗時は `issueId|ERROR`）。
#>
param([string]$FileListPath)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $task = $asTask.Invoke($null, @($WinRtTask))
    $task.Wait() | Out-Null
    return $task.Result
}

Get-Content $FileListPath | ForEach-Object {
    $line = $_
    if ([string]::IsNullOrWhiteSpace($line)) { return }
    $parts = $line -split '\|'
    $id = $parts[0]
    $path = $parts[1]
    try {
        $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
        $pdfDoc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
        Write-Output "$id|$($pdfDoc.PageCount)"
    } catch {
        Write-Output "$id|ERROR"
    }
}
