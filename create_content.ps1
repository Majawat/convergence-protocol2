<#
.SYNOPSIS
    Concatenates specified project files into a single text file for context sharing,
    including a project tree view and using triple-backtick Markdown code fences.

.DESCRIPTION
    Generates a project overview file ('project_context.txt').
    First, it attempts to capture the project's directory structure using 'tree /F /A'
    and includes it at the top within a ```text code block.
    Then, it recursively searches the project directory for files with specified extensions
    (HTML, CSS, JS, JSON by default) and outputs their content, prefixed with
    a file path delimiter and enclosed in triple-backtick Markdown code fences (```),
    into the output file. Excludes the output file itself, the structure file (if generated separately),
    and common directories like .git or node_modules.

.NOTES
    Author: Gemini
    Version: 3.1
    Dependencies: Requires 'tree.com' to be available in the system's PATH for the directory structure feature.
                  If 'tree.com' is not found, the structure section will be skipped.
    Instructions:
    1. Save this script as 'create_context.ps1' in the ROOT directory of your project.
    2. Open PowerShell.
    3. Navigate to your project's root directory using the 'cd' command.
    4. Execution Policy: If you encounter issues running the script, you might need to adjust
       your execution policy. Run PowerShell as Administrator and execute:
       Set-ExecutionPolicy RemoteSigned -Scope CurrentUser (Answer 'Y' or 'A').
       You can revert this later with: Set-ExecutionPolicy Restricted -Scope CurrentUser
    5. Run the script: .\create_context.ps1
    6. Open 'project_context.txt' and copy its entire content.
#>

# --- Configuration ---

# The root directory of the project. $PSScriptRoot makes it the directory where the script itself is saved.
$ProjectRoot = $PSScriptRoot
# Or, uncomment and manually set the path if needed:
# $ProjectRoot = "C:\path\to\your\project\your-project-name"

$OutputFile = Join-Path $ProjectRoot "project_context.txt"
$IncludeExtensions = @(".html", ".css", ".js", ".json", ".py", ".sh", ".ps1", ".md", ".sql", ".yaml", ".yml", ".ts", ".tsx", ".jsx", ".java", ".cs", ".go", ".php", ".rb") # Added more common types
$ExcludeFiles = @( # Files to exclude by name (case-insensitive)
    "project_context.txt",
    "package-lock.json",
    "yarn.lock"
    # Add other specific files you want to exclude by name
)
$ExcludeDirs = @( # Directory names to exclude (matches anywhere in the path, case-insensitive)
    ".git",
    "node_modules",
    ".vscode",
    "dist",
    "build",
    "out",
    "coverage",
    "__pycache__",
    ".venv",
    "venv",
    "env",
    ".env",
    "logs",
    "temp",
    "tmp",
    "bin", # Often contains compiled outputs
    "obj"   # Often contains intermediate compile outputs (.NET)
    #"assets" # Uncomment if image/binary assets aren't useful context
)

# --- Script Body ---

if (-not (Test-Path $ProjectRoot -PathType Container)) {
    Write-Error "Project root directory not found: $ProjectRoot"
    exit 1
}

Write-Host "Starting project context generation..." -ForegroundColor Green
Write-Host "Project Root: $ProjectRoot"
Write-Host "Output File:  $OutputFile"
Write-Host "Including Extensions: $($IncludeExtensions -join ', ')"
Write-Host "Excluding Files:    $($ExcludeFiles -join ', ')"
Write-Host "Excluding Dirs:     $($ExcludeDirs -join ', ')"

# Clear/Create the output file with UTF8 encoding
$InitialContent = "Project Context for $($ProjectRoot) - $(Get-Date)"
Set-Content -Path $OutputFile -Value $InitialContent -Encoding UTF8 -ErrorAction SilentlyContinue

# --- Add Project Structure (Tree) ---
Write-Host "Attempting to generate project structure using 'tree.com'..."
$treeCommand = Get-Command tree -ErrorAction SilentlyContinue
if ($treeCommand) {
    try {
        Write-Host "Found 'tree.com'. Generating structure..."
        # Run tree command, show files (/F), use ASCII lines (/A)
        # Redirect stderr to null in case of minor errors that don't stop execution
        # Use Start-Process to better handle potential encoding issues from external commands
        $processInfo = New-Object System.Diagnostics.ProcessStartInfo
        $processInfo.FileName = $treeCommand.Source
        $processInfo.Arguments = "/F /A"
        $processInfo.RedirectStandardOutput = $true
        $processInfo.RedirectStandardError = $true
        $processInfo.UseShellExecute = $false
        $processInfo.CreateNoWindow = $true
        # Set encoding for output; UTF8 is a good default, but tree.com might use OEM
        $processInfo.StandardOutputEncoding = [System.Text.Encoding]::UTF8
        # $processInfo.StandardOutputEncoding = [System.Text.Encoding]::GetEncoding([System.Globalization.CultureInfo]::CurrentCulture.TextInfo.OEMCodePage) # Alternative if UTF8 fails

        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $processInfo
        $process.Start() | Out-Null # Start and don't wait for exit here
        $treeOutput = $process.StandardOutput.ReadToEnd()
        $stderr = $process.StandardError.ReadToEnd() # Capture error output too
        $process.WaitForExit() # Wait for the process to finish

        if ($process.ExitCode -ne 0) {
            Write-Warning "tree.com exited with code $($process.ExitCode)."
            if ($stderr) { Write-Warning "Tree stderr: $stderr" }
        }

        # Add tree structure to the output file using SINGLE QUOTES for ```
        Add-Content -Path $OutputFile -Value "`n--- Project Structure (tree /F /A) ---" -Encoding UTF8
        Add-Content -Path $OutputFile -Value '```text' -Encoding UTF8 # Use 'text' for generic tree output & SINGLE QUOTES
        Add-Content -Path $OutputFile -Value $treeOutput.Trim() -Encoding UTF8 # Trim leading/trailing whitespace
        Add-Content -Path $OutputFile -Value '```' -Encoding UTF8            # Use SINGLE QUOTES
        Add-Content -Path $OutputFile -Value "" -Encoding UTF8               # Blank line separator
        Write-Host "Project structure added." -ForegroundColor Cyan

    }
    catch {
        Write-Warning "Error executing 'tree.com': $($_.Exception.Message). Skipping structure generation."
        # Add placeholder using SINGLE QUOTES
        Add-Content -Path $OutputFile -Value "`n--- Project Structure (Error during generation) ---" -Encoding UTF8
        Add-Content -Path $OutputFile -Value '```text' -Encoding UTF8
        Add-Content -Path $OutputFile -Value "($_.Exception.Message)" -Encoding UTF8
        Add-Content -Path $OutputFile -Value '```' -Encoding UTF8
        Add-Content -Path $OutputFile -Value "" -Encoding UTF8
    }
}
else {
    Write-Warning "'tree.com' not found in PATH. Skipping project structure generation."
    # Add placeholder using SINGLE QUOTES
    Add-Content -Path $OutputFile -Value "`n--- Project Structure (tree.com not found) ---" -Encoding UTF8
    Add-Content -Path $OutputFile -Value '```text' -Encoding UTF8
    Add-Content -Path $OutputFile -Value "[tree.com executable was not found in your system's PATH]" -Encoding UTF8
    Add-Content -Path $OutputFile -Value '```' -Encoding UTF8
    Add-Content -Path $OutputFile -Value "" -Encoding UTF8
}

# --- Add File Contents ---
Write-Host "Processing project files..."
try {
    Get-ChildItem -Path $ProjectRoot -Recurse -File | Where-Object {
        $file = $_
        # Condition 1: Extension must be included (case-insensitive)
        $isIncludedExtension = $IncludeExtensions -contains $file.Extension.ToLower()

        # Condition 2: Filename must not be excluded (case-insensitive)
        $isExcludedFile = $ExcludeFiles -contains $file.Name.ToLower()

        # Condition 3: File path must not contain any excluded directory names as distinct path components (case-insensitive)
        $relativePathForExclusionCheck = $file.FullName.Substring($ProjectRoot.Length).TrimStart('\/')
        $pathSegments = $relativePathForExclusionCheck.Split([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
        $isInExcludedDir = $false
        foreach ($segment in $pathSegments) {
            # Check if the lowercase version of the segment exists in the lowercase exclude list
            if ($ExcludeDirs.ToLower() -contains $segment.ToLower()) {
                $isInExcludedDir = $true
                break
            }
        }

        # Combine conditions: Must be included extension AND not excluded file AND not in excluded dir
        $isIncludedExtension -and (-not $isExcludedFile) -and (-not $isInExcludedDir)
    } | ForEach-Object {
        $file = $_
        # Get path relative to the project root for display
        $relativePath = $file.FullName.Substring($ProjectRoot.Length).TrimStart('\/')
        Write-Host "Adding: $relativePath" -ForegroundColor Gray

        # Determine language identifier for Markdown fence (more robust)
        $languageIdentifier = switch ($file.Extension.ToLower()) {
            ".js" { "javascript" }
            ".jsx" { "javascript" } # Or "jsx"
            ".ts" { "typescript" }
            ".tsx" { "typescript" } # Or "tsx"
            ".html" { "html" }
            ".css" { "css" }
            ".json" { "json" }
            ".py" { "python" }
            ".sh" { "bash" }       # or "shell"
            ".ps1" { "powershell" }
            ".md" { "markdown" }
            ".sql" { "sql" }
            ".yaml" { "yaml" }
            ".yml" { "yaml" }
            ".java" { "java" }
            ".cs" { "csharp" } # Common identifier for C#
            ".go" { "go" }
            ".php" { "php" }
            ".rb" { "ruby" }
            # Add more mappings as needed
            default { "" } # Default to no identifier (plain text)
        }

        # Add delimiter using backslashes for readability in the text file
        $delimiter = "--- $($relativePath.Replace('/','\')) ---"
        Add-Content -Path $OutputFile -Value $delimiter -Encoding UTF8

        # Add opening code fence with language ID using SINGLE QUOTES for ``` and concatenation
        # This ensures ``` is treated literally and $languageIdentifier is appended.
        Add-Content -Path $OutputFile -Value ('```' + $languageIdentifier) -Encoding UTF8

        # Add file content (handle potential read errors gracefully)
        try {
            $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8 -ErrorAction Stop # Use Stop to trigger the catch block on read error
            Add-Content -Path $OutputFile -Value $content -Encoding UTF8
        }
        catch {
            Write-Warning "Could not read content from '$($file.FullName)': $($_.Exception.Message)"
            Add-Content -Path $OutputFile -Value "[Error reading file content: $($_.Exception.Message)]" -Encoding UTF8
        }

        # Add closing code fence using SINGLE QUOTES
        Add-Content -Path $OutputFile -Value '```' -Encoding UTF8

        # Add a blank line for separation
        Add-Content -Path $OutputFile -Value "" -Encoding UTF8
    }
    Write-Host "Project context generation complete." -ForegroundColor Green
    Write-Host "Output saved to: $OutputFile" -ForegroundColor Green
}
catch {
    # Catch errors from Get-ChildItem or the main loop logic
    Write-Error "An error occurred during file processing: $($_.Exception.Message)"
    Write-Error ($_.ScriptStackTrace) # Show where in the script the error occurred
    Write-Error ($_.Exception.ToString()) # Full exception details
    exit 1
}