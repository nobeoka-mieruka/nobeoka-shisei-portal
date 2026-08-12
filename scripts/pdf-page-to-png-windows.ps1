<#
.SYNOPSIS
  PDFの1ページをPNG画像として書き出す（WinRT Windows.Data.Pdf使用、追加インストール不要）。
  OCR結果のクロスチェック用に、元画像をRead toolで目視確認するために使う。
.PARAMETER PdfPath
  バックスラッシュ区切りのWindowsパスであること（フォワードスラッシュだと
  StorageFile.GetFileFromPathAsyncが失敗する）。
#>
param(
    [Parameter(Mandatory=$true)][string]$PdfPath,
    [Parameter(Mandatory=$true)][int]$PageIndex,
    [Parameter(Mandatory=$true)][string]$OutPngPath
)

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
function AwaitAction($WinRtAction) {
    $asTaskMethod = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
    })[0]
    $task = $asTaskMethod.Invoke($null, @($WinRtAction))
    $task.Wait() | Out-Null
}

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($PdfPath)) ([Windows.Storage.StorageFile])
$pdfDoc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
$page = $pdfDoc.GetPage([uint32]$PageIndex)

$outFolder = Split-Path $OutPngPath -Parent
$outFile = Await ([Windows.Storage.StorageFolder]::GetFolderFromPathAsync($outFolder)) ([Windows.Storage.StorageFolder])
$pngFile = Await ($outFile.CreateFileAsync((Split-Path $OutPngPath -Leaf), [Windows.Storage.CreationCollisionOption]::ReplaceExisting)) ([Windows.Storage.StorageFile])
$stream = Await ($pngFile.OpenAsync([Windows.Storage.FileAccessMode]::ReadWrite)) ([Windows.Storage.Streams.IRandomAccessStream])

$renderOptions = New-Object Windows.Data.Pdf.PdfPageRenderOptions
$renderOptions.DestinationWidth = [uint32]($page.Size.Width * 2.5)
$renderOptions.DestinationHeight = [uint32]($page.Size.Height * 2.5)
AwaitAction ($page.RenderToStreamAsync($stream, $renderOptions))
$stream.Dispose()

Write-Output "OK|$OutPngPath"
