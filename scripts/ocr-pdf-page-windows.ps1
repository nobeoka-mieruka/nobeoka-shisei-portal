<#
.SYNOPSIS
  Windows標準搭載のWinRT API（Windows.Data.Pdf + Windows.Media.Ocr）でPDFの
  1ページをOCRし、抽出テキストをファイルへ保存する。

.DESCRIPTION
  tesseract等の追加インストール・管理者権限は一切不要（Windows 10/11に標準搭載の
  日本語OCRエンジンを使用）。ただし本スクリプトはレガシーの Windows PowerShell 5.1
  （powershell.exe）でのみ動作する。PowerShell 7+（pwsh）はWinRTのネイティブ
  プロジェクション構文（[Namespace.Type,Assembly,ContentType=WindowsRuntime]）を
  サポートしないため、必ず `powershell.exe -File ...` で実行すること。

  【重要：この出力は生OCR結果であり、確定データではない】
  数字・固有名詞の誤認識（例：全角「7」が「乙」等の類似字形に化ける）が発生しうる。
  本サイトのデータへ登録する前に、必ず元PDFの該当ページと目視で照合すること
  （raw OCR → 候補抽出 → 元PDF照合 → verified → 本番データ、という工程を経ること。
  TASKS.md TASK-087参照）。

.PARAMETER PdfPath
  対象PDFファイルの絶対パス。

.PARAMETER PageIndex
  0始まりのページ番号。

.PARAMETER OutTextPath
  抽出テキストの出力先ファイルパス（UTF-8）。

.EXAMPLE
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ocr-pdf-page-windows.ps1 `
    -PdfPath "C:\path\to\koho-2020-06.pdf" -PageIndex 5 -OutTextPath "C:\path\to\out.txt"
#>
param(
    [Parameter(Mandatory=$true)][string]$PdfPath,
    [Parameter(Mandatory=$true)][int]$PageIndex,
    [Parameter(Mandatory=$true)][string]$OutTextPath
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine,Windows.Media.Ocr,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime]

# WinRTの非同期呼び出し（IAsyncOperation/IAsyncAction）をPowerShellから同期的に
# 待ち受けるためのヘルパー。PowerShell 5.1にはWinRT非同期メソッドをネイティブに
# 待つ構文が無いため、System.WindowsRuntimeSystemExtensions.AsTask()をリフレクション
# 経由で呼び出す（コミュニティで広く使われている定石パターン）。
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $task = $asTask.Invoke($null, @($WinRtTask))
    $task.Wait() | Out-Null
    return $task.Result
}

function AwaitAction($WinRtAction) {
    $asTaskMethod = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
    })[0]
    $task = $asTaskMethod.Invoke($null, @($WinRtAction))
    $task.Wait() | Out-Null
}

$sw = [System.Diagnostics.Stopwatch]::StartNew()

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($PdfPath)) ([Windows.Storage.StorageFile])
$pdfDoc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
Write-Output "PageCount=$($pdfDoc.PageCount)"

if ($PageIndex -ge $pdfDoc.PageCount) {
    Write-Output "ERROR: PageIndex out of range"
    exit 1
}

# 3倍解像度でレンダリングする（等倍だと文字が小さく認識率が落ちるため）。
$page = $pdfDoc.GetPage([uint32]$PageIndex)
$stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
$renderOptions = New-Object Windows.Data.Pdf.PdfPageRenderOptions
$renderOptions.DestinationWidth = [uint32]($page.Size.Width * 3)
$renderOptions.DestinationHeight = [uint32]($page.Size.Height * 3)
AwaitAction ($page.RenderToStreamAsync($stream, $renderOptions))

$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$softwareBitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

$renderMs = $sw.ElapsedMilliseconds
$sw.Restart()

$ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("ja"))
if ($null -eq $ocrEngine) {
    Write-Output "ERROR: could not create OCR engine for ja (日本語言語パックが端末に無い可能性があります)"
    exit 1
}
$ocrResult = Await ($ocrEngine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])

$ocrMs = $sw.ElapsedMilliseconds

$ocrResult.Text | Out-File -FilePath $OutTextPath -Encoding utf8
Write-Output "RenderMs=$renderMs OcrMs=$ocrMs TextLength=$($ocrResult.Text.Length)"
