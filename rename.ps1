# Get all .ts files in the src directory
$files = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse

foreach ($file in $files) {
    # Get the current filename
    $currentName = $file.Name

    # Check if the first letter is already lowercase
    if ($currentName[0] -cmatch '[a-z]') {
        continue
    }

    # Convert the first letter to lowercase
    $newName = -join ($currentName[0].ToString().ToLower() + $currentName.Substring(1))

    # Debug print the old and new names
    Write-Host "Renaming '$currentName' to '$newName'"

    # Rename the file using git mv
    git mv $file.FullName (Join-Path $file.DirectoryName $newName)
}