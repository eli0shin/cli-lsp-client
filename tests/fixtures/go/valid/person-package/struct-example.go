package person

import "fmt"

type Person struct {
	Name string
	Age  int
}

func (p Person) Greet() string {
	return fmt.Sprintf("Hi, I'm %s and I'm %d years old", p.Name, p.Age)
}

func NewPerson(name string, age int) Person {
	return Person{Name: name, Age: age}
}