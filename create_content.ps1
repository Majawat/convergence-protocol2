<#
.SYNOPSIS
    Concatenates specified project files into a single text file for context sharing.

.DESCRIPTION
    Recursively searches a project directory for files with specified extensions
    (HTML, CSS, JS, JSON by default) and outputs their content, prefixed with
    a file path delimiter, into a single output file (project_context.txt).
    Excludes the output file itself and common directories like .git or node_modules.

.NOTES
    Author: Gemini
    Version: 1.0
    Instructions:
    1. Save this script as 'create_context.ps1' in the ROOT directory of your project.
    2. Open PowerShell (potentially as Administrator if execution policy issues arise).
    3. Navigate to your project's root directory using the 'cd' command.
    4. If you haven't run PowerShell scripts before, you might need to set the execution policy:
       Run: Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
       (Answer 'Y' or 'A' if prompted). You usually only need to do this once.
    5. Run the script: .\create_context.ps1
    6. A file named 'project_context.txt' will be created in the root directory.
    7. Open 'project_context.txt' and copy its entire content.
#>

# --- Configuration ---

# Set the root directory of your project. $PSScriptRoot assumes the script
# is saved and run from the project's root folder.
$ProjectRoot = $PSScriptRoot
# Or, uncomment and manually set the path if needed:
# $ProjectRoot = "C:\path\to\your\project\convergence-protocol2"

# Name of the output file
$OutputFile = Join-Path $ProjectRoot "project_context.txt"

# File extensions to include in the output
$IncludeExtensions = @(".html", ".css", ".js", ".json")
# Example: Add Markdown -> $IncludeExtensions = @(".html", ".css", ".js", ".json", ".md")

# Files or Folder names to exclude completely
$ExcludeItems = @(
    "project_context.txt", # Exclude the output file itself
    "structure.txt", # Exclude the structure file if you have one
    ".git", # Exclude git directory/files
    "node_modules", # Exclude node_modules if applicable
    "package-lock.json", # Exclude package lock
    ".vscode"              # Exclude VS Code settings folder
    # Add other specific files or folder names here if necessary
)

# --- Script Body ---

# Check if root directory exists
if (-not (Test-Path $ProjectRoot -PathType Container)) {
    Write-Error "Project root directory not found: $ProjectRoot"
    exit 1
}

Write-Host "Starting project concatenation..." -ForegroundColor Green
Write-Host "Project Root: $ProjectRoot"
Write-Host "Output File: $OutputFile"
Write-Host "Including Extensions: $($IncludeExtensions -join ', ')"
Write-Host "Excluding Items: $($ExcludeItems -join ', ')"

# Clear/Create the output file
# Use Out-File initially to create/overwrite with UTF8 encoding by default
Set-Content -Path $OutputFile -Value "Project Context for $($ProjectRoot) - $(Get-Date)" -ErrorAction SilentlyContinue
# Clear-Content $OutputFile -ErrorAction SilentlyContinue # Alternative if encoding isn't an issue
# if (-not (Test-Path $OutputFile)) {
#     New-Item -Path $OutputFile -ItemType File | Out-Null
# }

# Get files recursively, filter by extension, exclude specified items/paths

# ... (Script Body Start) ...
try {
    Get-ChildItem -Path $ProjectRoot -Recurse -File | Where-Object {
        $file = $_
        # Condition 1: Extension must be included
        $isIncludedExtension = $IncludeExtensions -contains $file.Extension

        # Condition 2: Filename must not be excluded
        $isExcludedFile = $ExcludeFiles -contains $file.Name

        # Condition 3: Directory path must not contain excluded directory names as distinct path components
        $pathSegments = $file.DirectoryName.Split([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
        $isInExcludedDir = $pathSegments | Where-Object { $_ -in $ExcludeDirs } | Select-Object -First 1

        # Combine conditions
        $isIncludedExtension -and (-not $isExcludedFile) -and (-not $isInExcludedDir)
    } | ForEach-Object {
        # ... (Rest of ForEach loop same as V1/V2 - Add delimiter, content, blank line) ...
        $file = $_
        $relativePath = $file.FullName.Substring($ProjectRoot.Length).TrimStart('\/')
        Write-Host "Adding: $relativePath"
        $delimiter = "--- $($relativePath.Replace('/','\')) ---"
        Add-Content -Path $OutputFile -Value $delimiter -Encoding UTF8 # Ensure UTF8 for Add-Content too
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        Add-Content -Path $OutputFile -Value $content -Encoding UTF8
        Add-Content -Path $OutputFile -Value "" -Encoding UTF8
    }
    Write-Host "Concatenation complete. Output saved to: $OutputFile" -ForegroundColor Green
}
catch {
    Write-Error "An error occurred: $($_.Exception.Message)"
    Write-Error ($_.Exception | Format-List -Force | Out-String)
    exit 1
}

