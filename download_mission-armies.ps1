<#
.SYNOPSIS
    Downloads OPR Army Forge JSON lists for a specific mission based on campaign data.

.DESCRIPTION
    This script reads the campaign.json file to get army IDs and URLs,
    prompts the user for a mission number, constructs a target directory path
    (e.g., ./data/battle-reports/missionX-armies), creates the directory if needed,
    and then downloads the army list JSON for each army from the Army Forge TTS API.
    It saves the files using the 'armyURL' field from campaign.json as the filename base.
    The script checks if a file already exists before downloading and skips if it does.

.NOTES
    Author: Gemini
    Version: 1.0
    Instructions:
    1. Save this script (e.g., as `download_mission_armies.ps1`) in the ROOT
       directory of your 'convergence-protocol2' project (the same level as the 'data' folder).
    2. Ensure your `campaign.json` file is in the `./data/` subdirectory relative to the script.
    3. Open PowerShell.
    4. Navigate to your project's root directory using `cd`.
    5. Run the script: .\download_mission_armies.ps1
    6. Enter the mission number when prompted.
#>

# --- Configuration ---
$ScriptRoot = $PSScriptRoot # Directory where the script is located
$CampaignFilePath = Join-Path $ScriptRoot "data\campaign.json" # Assumes campaign.json is in data subdir
$BaseReportPath = Join-Path $ScriptRoot "data\battle-reports"
$ApiBaseUrl = "https://army-forge.onepagerules.com/api/tts?id="

# --- Functions ---

# Function to sanitize a string for use as a filename
function Format-FileName {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Name
    )
    # Remove characters invalid for Windows filenames and replace spaces
    $invalidChars = [System.IO.Path]::GetInvalidFileNameChars() -join ''
    $sanitized = $Name -replace "[$invalidChars]", "" -replace '\s+', '-' # Replace spaces with hyphens
    return $sanitized.ToLower() # Return lowercase
}

# --- Script Body ---

Write-Host "--- OPR Mission Army List Downloader ---" -ForegroundColor Yellow

# 1. Get Mission Number
$MissionNumber = $null
while ($null -eq $MissionNumber) {
    try {
        $userInput = Read-Host "Please enter the Mission Number to download armies for"
        $MissionNumber = [int]$userInput
        if ($MissionNumber -le 0) {
            Write-Warning "Mission number must be a positive integer."
            $MissionNumber = $null # Reset to loop again
        }
    }
    catch {
        Write-Warning "Invalid input. Please enter a whole number for the mission."
        # $MissionNumber remains $null, loop continues
    }
}

Write-Host "Preparing to download armies for Mission $MissionNumber..."

# 2. Construct and Create Target Directory
$TargetFolderName = "mission$($MissionNumber)-armies"
$TargetDirectory = Join-Path $BaseReportPath $TargetFolderName
Write-Host "Target directory: $TargetDirectory"

if (-not (Test-Path $TargetDirectory -PathType Container)) {
    try {
        New-Item -ItemType Directory -Path $TargetDirectory -ErrorAction Stop | Out-Null
        Write-Host "Created target directory." -ForegroundColor Green
    }
    catch {
        Write-Error "Failed to create target directory '$TargetDirectory'. Please check permissions. Error: $($_.Exception.Message)"
        exit 1
    }
} else {
     Write-Host "Target directory already exists."
}

# 3. Load Campaign Data
if (-not (Test-Path $CampaignFilePath -PathType Leaf)) {
    Write-Error "Campaign file not found at '$CampaignFilePath'."
    exit 1
}

$CampaignData = $null
try {
    $CampaignJson = Get-Content -Path $CampaignFilePath -Raw -Encoding UTF8 -ErrorAction Stop
    $CampaignData = $CampaignJson | ConvertFrom-Json -ErrorAction Stop
}
catch {
    Write-Error "Failed to read or parse campaign file '$CampaignFilePath'. Error: $($_.Exception.Message)"
    exit 1
}

if (-not $CampaignData.armies) {
     Write-Error "Campaign data does not contain an 'armies' array."
     exit 1
}

# 4. Download Army Lists
Write-Host "Processing armies from campaign data..."
$downloadCount = 0
$skipCount = 0

foreach ($army in $CampaignData.armies) {
    $armyId = $army.armyForgeID
    $armyName = $army.armyName
    $armyFileNameBase = $army.armyURL # Prefer armyURL for filename

    if (-not $armyId) {
        Write-Warning "Skipping army '$armyName' - Missing 'armyForgeID'."
        continue
    }

    if (-not $armyFileNameBase) {
        Write-Warning "Army '$armyName' (ID: $armyId) is missing 'armyURL'. Falling back to sanitized 'armyName' for filename."
        $armyFileNameBase = Format-FileName $armyName
        if (-not $armyFileNameBase) {
             Write-Warning "Could not generate a valid filename base for army '$armyName' (ID: $armyId). Skipping."
             continue
        }
    }

    $targetFileName = "$($armyFileNameBase).json"
    $outputFilePath = Join-Path $TargetDirectory $targetFileName
    $downloadUrl = "$($ApiBaseUrl)$($armyId)"

    Write-Host "Checking for: '$targetFileName' (Army: $armyName)"

    # Check if file exists BEFORE downloading
    if (Test-Path $outputFilePath -PathType Leaf) {
        Write-Host "  Skipping - File already exists at '$outputFilePath'." -ForegroundColor Cyan
        $skipCount++
    }
    else {
        Write-Host "  Downloading from $downloadUrl..."
        try {
            # Use Invoke-RestMethod as it handles JSON directly and often works better with APIs
            $jsonData = Invoke-RestMethod -Uri $downloadUrl -Method Get -ErrorAction Stop
            # Convert the resulting object back to formatted JSON for saving
            $jsonOutput = $jsonData | ConvertTo-Json -Depth 99 # Depth 99 for nested objects
            # Save the formatted JSON content with UTF8 encoding
            Set-Content -Path $outputFilePath -Value $jsonOutput -Encoding UTF8 -ErrorAction Stop
            Write-Host "  Successfully downloaded and saved to '$outputFilePath'." -ForegroundColor Green
            $downloadCount++
        }
        catch {
            Write-Warning "  Failed to download or save army '$armyName' (ID: $armyId). Error: $($_.Exception.Message)"
            # Optional: Delete partially downloaded file if it exists? Not strictly necessary.
            # if (Test-Path $outputFilePath -PathType Leaf) { Remove-Item $outputFilePath }
        }
        # Add a small delay to avoid hammering the API too quickly
        Start-Sleep -Milliseconds 500
    }
}

Write-Host "--- Download Complete ---" -ForegroundColor Yellow
Write-Host "Downloaded: $downloadCount file(s)."
Write-Host "Skipped:    $skipCount file(s) (already existed)."
