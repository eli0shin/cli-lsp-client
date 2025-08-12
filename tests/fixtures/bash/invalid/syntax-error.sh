#!/bin/bash

# Shell script with syntax errors
echo "Hello World"

# Unclosed string
echo "This string is not closed

# Missing closing bracket
if [ -f "file.txt" ; then
    echo "File exists"
# fi is missing

# Invalid command
invalid_command_that_doesnt_exist

# Wrong syntax for variable assignment
$invalid_var = "value"

# Unclosed function
function broken_function() {
    echo "This function is not closed"
# Missing closing brace