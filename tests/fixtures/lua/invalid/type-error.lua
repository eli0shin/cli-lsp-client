-- Lua file with type-related issues for testing
local function get_string()
    return 42  -- Should return string but returns number
end

local function calculate(a, b)
    return a .. b  -- String concatenation on numbers
end

-- Calling function with wrong number of arguments
local result = calculate(5)
print(result)

-- Undefined variable usage
local x = undefined_variable + 10

-- Trying to index a non-table value
local num = 42
local value = num.field

-- Function that expects table but gets number
local function process_table(tbl)
    for k, v in pairs(tbl) do
        print(k, v)
    end
end

process_table(123)  -- Passing number instead of table