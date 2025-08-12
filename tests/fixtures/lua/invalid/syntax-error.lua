-- Lua file with syntax errors for testing
local function broken_function(a, b)
    if a > b then
        return a
    else
        return b
    -- Missing 'end' for the if statement
end

function another_broken()
    local x = 10
    local y = 20
    print(x + y
    -- Missing closing parenthesis
end

-- Function with mismatched quotes
local message = "Hello World'

-- Missing 'do' keyword in for loop
for i = 1, 10
    print(i)
end