-- Lua file with unused variables and functions for testing
local function unused_function(a, b)
    return a + b
end

local function main()
    local unused_var = 42
    local another_unused = "hello"
    local x = 10
    local y = 20
    
    -- Only use one variable
    print(x)
    
    -- Unused parameters in function
    local function helper(param1, param2, param3)
        return param1  -- param2 and param3 are unused
    end
    
    helper(1, 2, 3)
end

main()