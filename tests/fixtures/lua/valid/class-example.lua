-- Object-oriented Lua example using metatables
local Person = {}
Person.__index = Person

function Person.new(name, age)
    local self = setmetatable({}, Person)
    self.name = name
    self.age = age
    return self
end

function Person:introduce()
    return string.format("Hi, I'm %s and I'm %d years old", self.name, self.age)
end

function Person:birthday()
    self.age = self.age + 1
    print(self.name .. " is now " .. self.age .. " years old!")
end

-- Inheritance example
local Student = setmetatable({}, {__index = Person})
Student.__index = Student

function Student.create(name, age, school)
    local self = Person.new(name, age)
    setmetatable(self, Student)
    self.school = school
    return self
end

function Student:study(subject)
    return string.format("%s is studying %s at %s", self.name, subject, self.school)
end

-- Usage
local john = Person.new("John", 30)
local mary = Student.create("Mary", 20, "MIT")

print(john:introduce())
print(mary:study("Computer Science"))

return {
    Person = Person,
    Student = Student
}