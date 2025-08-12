-- Simple Lua module with common patterns
local M = {}

function M.greet(name)
    return "Hello, " .. name .. "!"
end

function M.calculate(a, b)
    return a + b
end

local function private_helper(x)
    return x * 2
end

function M.transform(data)
    local result = {}
    for i, value in ipairs(data) do
        result[i] = private_helper(value)
    end
    return result
end

-- Table with mixed types
M.config = {
    version = "1.0",
    debug = false,
    max_items = 100,
    features = {
        "logging",
        "validation",
        "caching"
    }
}

return M