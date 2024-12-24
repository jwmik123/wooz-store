#!/bin/bash

# Base path for assets
BASE_PATH="public/assets"

# Directories to process
directories=("hoodie" "longsleeve" "polo" "splatter")

# Function to rename files in a directory
rename_files() {
    local dir="$BASE_PATH/$1"
    echo "Processing directory: $dir"
    
    # Check if directory exists
    if [ ! -d "$dir" ]; then
        echo "Directory $dir does not exist, skipping..."
        return
    fi
    
    # Find all image files in the directory (case-insensitive)
    find "$dir" -type f -iname "*.jpg" -o -iname "*.png" -o -iname "*.jpeg" -o -iname "*.gif" | while read file; do
        # Get the directory and filename
        filename=$(basename "$file")
        dirname=$(dirname "$file")
        
        # Convert filename to lowercase
        lowercase_name=$(echo "$filename" | tr '[:upper:]' '[:lower:]')
        
        # Skip if filename is already lowercase
        if [ "$filename" = "$lowercase_name" ]; then
            continue
        fi
        
        echo "Renaming: $filename -> $lowercase_name"
        
        # Use git mv with temporary name to handle case-sensitivity
        temp_name="${filename}_temp_$$"
        git mv "$file" "$dirname/$temp_name"
        git mv "$dirname/$temp_name" "$dirname/$lowercase_name"
    done
}

# Process each directory
for dir in "${directories[@]}"; do
    rename_files "$dir"
done

echo "All directories processed. Please review changes and then commit with:"
echo "git commit -m \"Fix image filename casing\""
echo "git push"