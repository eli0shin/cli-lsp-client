#!/usr/bin/env fish

function greet
    set name $argv[1]
    if test -n "$name"
        echo "Hello, $name!"
    else
        echo "Hello, World!"
    end
end

function calculate_sum
    set -l result 0
    for num in $argv
        set result (math $result + $num)
    end
    echo $result
end

# Main execution
greet "Fish"
calculate_sum 1 2 3 4 5