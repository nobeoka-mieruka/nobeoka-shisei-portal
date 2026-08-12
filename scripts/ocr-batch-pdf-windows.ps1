<#
.SYNOPSIS
  ocr-pdf-page-windows.ps1のバッチ版。複数PDF・複数ページをまとめてOCRし、
  号ごとのフォルダにページ単位のテキストファイルを書き出す。
.DESCRIPTION
  ocr-pdf-page-windows.ps1と同じくWindows.Data.Pdf / Windows.Media.Ocr（WinRT）を使う。
  レガシーの Windows PowerShell 5.1（powershell.exe）でのみ動作し、PowerShell 7+（pwsh）
  では型解決に失敗するため、必ず `powershell.exe -ExecutionPolicy Bypass -File ...` で実行する
  こと（詳細はocr-pdf-page-windows.ps1のヘッダコメントを参照）。

  【重要：この出力は生OCR結果であり、確定データではない】
  出力される page-NNN.txt は verificationStatus=raw の生データ。号全体を無条件にOCRする
  前に対象を絞り込み、CPU/メモリを消費しすぎないよう小バッチ（10〜20号程度）で実行すること。
  出力テキストをキーワード検索した結果はreports/koho-ocr-keyword-candidates.json（生成は別スクリプト）
  のようなverificationStatus付きの構造化データに変換し、さらに元PDF画像（pdf-page-to-png-windows.ps1
  で書き出し可能）と目視で照合してからでないと、src/data配下の確定データへは反映しないこと。

.PARAMETER FileListPath
  1行1件、`issueId|絶対パス（バックスラッシュ区切り）` 形式のテキストファイル。
  StorageFile.GetFileFromPathAsyncはフォワードスラッシュのパスだと失敗するため、
  必ずバックスラッシュ区切りで生成すること。
.PARAMETER OutDir
  出力先フォルダ（バックスラッシュ区切り）。$OutDir\$issueId\page-NNN.txt が生成される。
.OUTPUTS
  標準出力に1号1行、`issueId|OK|pageCount|successPages|failPages|totalMs`
  （読み込み自体に失敗した場合は `issueId|LOAD_FAILED|0|0|0`）。
#>
param(
    [Parameter(Mandatory=$true)][string]$FileListPath,
    [Parameter(Mandatory=$true)][string]$OutDir
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine,Windows.Media.Ocr,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language,Windows.Globalization,ContentType=WindowsRuntime]

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

$ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("ja"))

$summary = @()

Get-Content $FileListPath | ForEach-Object {
    $line = $_
    if ([string]::IsNullOrWhiteSpace($line)) { return }
    $parts = $line -split '\|'
    $id = $parts[0]
    $path = $parts[1]
    $issueDir = Join-Path $OutDir $id
    New-Item -ItemType Directory -Force -Path $issueDir | Out-Null

    try {
        $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($path)) ([Windows.Storage.StorageFile])
        $pdfDoc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
    } catch {
        Write-Output "$id|LOAD_FAILED|0|0|0"
        return
    }

    $successPages = 0
    $failPages = 0
    $totalMs = 0

    for ($i = 0; $i -lt $pdfDoc.PageCount; $i++) {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $page = $pdfDoc.GetPage([uint32]$i)
            $stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
            $renderOptions = New-Object Windows.Data.Pdf.PdfPageRenderOptions
            $renderOptions.DestinationWidth = [uint32]($page.Size.Width * 3)
            $renderOptions.DestinationHeight = [uint32]($page.Size.Height * 3)
            AwaitAction ($page.RenderToStreamAsync($stream, $renderOptions))
            $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
            $softwareBitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
            $ocrResult = Await ($ocrEngine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])

            $pageNum = $i + 1
            $outFile = Join-Path $issueDir ("page-{0:D3}.txt" -f $pageNum)
            $ocrResult.Text | Out-File -FilePath $outFile -Encoding utf8
            $successPages++
        } catch {
            $failPages++
        }
        $totalMs += $sw.ElapsedMilliseconds
    }

    Write-Output "$id|OK|$($pdfDoc.PageCount)|$successPages|$failPages|$totalMs"
}
