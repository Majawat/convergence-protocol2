<#
.SYNOPSIS
    Concatenates specified project files into a single text file for context sharing,
    now including Markdown code fences around each file's content.

.DESCRIPTION
    Recursively searches a project directory for files with specified extensions
    (HTML, CSS, JS, JSON by default) and outputs their content, prefixed with
    a file path delimiter and enclosed in Markdown code fences (```),
    into a single output file (project_context.txt). Excludes the output file
    itself and common directories like .git or node_modules.

.NOTES
    Author: Gemini
    Version: 2.0
    Instructions:
    1. Save this script as 'create_context.ps1' in the ROOT directory of your project.
    2. Open PowerShell (potentially as Administrator if execution policy issues arise).
    3. Navigate to your project's root directory using the 'cd' command.
    4. If needed, run: Set-ExecutionPolicy RemoteSigned -Scope CurrentUser (Answer 'Y'/'A')
    5. Run the script: .\create_context.ps1
    6. Open 'project_context.txt' and copy its entire content.
#>

# --- Configuration ---

$ProjectRoot = $PSScriptRoot
# Or, uncomment and manually set the path if needed:
# $ProjectRoot = "C:\path\to\your\project\convergence-protocol2"

$OutputFile = Join-Path $ProjectRoot "project_context.txt"
$IncludeExtensions = @(".html", ".css", ".js", ".json")
$ExcludeFiles = @( # Files to exclude by name
    "project_context.txt",
    "structure.txt",
    "package-lock.json"
)
$ExcludeDirs = @( # Directory names to exclude
    ".git",
    "node_modules",
    ".vscode",
    "assets" # Exclude assets folder as images aren't useful here
)

# --- Script Body ---

if (-not (Test-Path $ProjectRoot -PathType Container)) {
    Write-Error "Project root directory not found: $ProjectRoot"
    exit 1
}

Write-Host "Starting project concatenation (with code fences)..." -ForegroundColor Green
Write-Host "Project Root: $ProjectRoot"
Write-Host "Output File: $OutputFile"
Write-Host "Including Extensions: $($IncludeExtensions -join ', ')"
Write-Host "Excluding Items/Dirs: $($ExcludeFiles -join ', '), $($ExcludeDirs -join ', ')"

# Clear/Create the output file with UTF8 encoding
Set-Content -Path $OutputFile -Value "Project Context for $($ProjectRoot) - $(Get-Date)" -Encoding UTF8 -ErrorAction SilentlyContinue

try {
    Get-ChildItem -Path $ProjectRoot -Recurse -File | Where-Object {
        $file = $_
        # Condition 1: Extension must be included
        $isIncludedExtension = $IncludeExtensions -contains $file.Extension.ToLower() # Use ToLower() for safety

        # Condition 2: Filename must not be excluded
        $isExcludedFile = $ExcludeFiles -contains $file.Name

        # Condition 3: Directory path must not contain excluded directory names as distinct path components
        $pathSegments = $file.DirectoryName.Split([System.IO.Path]::DirectorySeparatorChar,[System.IO.Path]::AltDirectorySeparatorChar)
        $isInExcludedDir = $pathSegments | Where-Object { $ExcludeDirs -contains $_ } | Select-Object -First 1 # Check if any segment matches an excluded dir name

        # Combine conditions
        $isIncludedExtension -and (-not $isExcludedFile) -and (-not $isInExcludedDir)
    } | ForEach-Object {
        $file = $_
        $relativePath = $file.FullName.Substring($ProjectRoot.Length).TrimStart('\/')
        Write-Host "Adding: $relativePath"

        # Determine language identifier for Markdown fence
        $languageIdentifier = switch ($file.Extension.ToLower()) {
            ".js"   { "javascript" }
            ".html" { "html" }
            ".css"  { "css" }
            ".json" { "json" }
            ".ps1"  { "powershell" }
            ".md"   { "markdown" }
            # Add more mappings as needed
            default { "" } # Default to no identifier
        }

        # Add delimiter
        $delimiter = "--- $($relativePath.Replace('/','\')) ---"
        Add-Content -Path $OutputFile -Value $delimiter -Encoding UTF8

        # Add opening code fence with language ID
        Add-Content -Path $OutputFile -Value "````$languageIdentifier" -Encoding UTF8

        # Add file content
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        Add-Content -Path $OutputFile -Value $content -Encoding UTF8

        # Add closing code fence
        Add-Content -Path $OutputFile -Value "````" -Encoding UTF8

        # Add a blank line for separation
        Add-Content -Path $OutputFile -Value "" -Encoding UTF8
    }
    Write-Host "Concatenation complete. Output saved to: $OutputFile" -ForegroundColor Green
} catch {
    Write-Error "An error occurred: $($_.Exception.Message)"
    Write-Error ($_.Exception | Format-List -Force | Out-String)
    exit 1
}
